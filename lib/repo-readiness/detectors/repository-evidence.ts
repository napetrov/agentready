import { readFileSync } from 'fs'
import path from 'path'
import type { InstructionSurfaceEvidence } from './instruction-surface'
import type {
  ArchitectureBoundaryEvidence,
  ArchitectureBoundaryRole,
  CiEvidence,
  CommandEvidence,
  CiCommandKind,
  DesignStateInsight,
  DesignStateSummary,
  DocumentRole,
  DocumentSurfaceEvidence,
  EvidenceClaim,
  EvidenceConfidence,
  EvidenceSource,
  GeneratedPressureEvidence,
  LocalReadinessFile,
  ReadinessFinding,
  RepositoryEvidence,
  RepositoryRootEvidence,
  RepositoryRootKind,
  RepositoryTopologyEvidence,
  SafetySignalEvidence,
  VerificationSurfaceEvidence,
} from '../core/types'
import { uniqueSorted } from '../core/util'

const DETECTOR = 'repository-evidence'
const MAX_DOCUMENT_BYTES_PARSED = 128_000
const MAX_HEADINGS_PER_DOCUMENT = 80
const MAX_LINKS_PER_DOCUMENT = 200
const MAX_COMMAND_BLOCKS_PER_DOCUMENT = 40
const MAX_COMMAND_BLOCK_BYTES = 4_000

const MANIFEST_ROOTS: Record<string, { rootKind: RepositoryRootKind; language?: string; source: EvidenceSource['kind'] }> = {
  'package.json': { rootKind: 'package', language: 'TypeScript', source: 'manifest' },
  'pyproject.toml': { rootKind: 'package', language: 'Python', source: 'manifest' },
  'setup.cfg': { rootKind: 'package', language: 'Python', source: 'manifest' },
  'go.mod': { rootKind: 'package', language: 'Go', source: 'manifest' },
  'Cargo.toml': { rootKind: 'package', language: 'Rust', source: 'manifest' },
  'pom.xml': { rootKind: 'package', language: 'Java', source: 'manifest' },
  'build.gradle': { rootKind: 'package', language: 'Java', source: 'manifest' },
  'build.gradle.kts': { rootKind: 'package', language: 'Kotlin', source: 'manifest' },
  'CMakeLists.txt': { rootKind: 'package', language: 'C/C++', source: 'manifest' },
}

const extensionLanguages: Record<string, string> = {
  '.c': 'C',
  '.cc': 'C++',
  '.cpp': 'C++',
  '.cs': 'C#',
  '.go': 'Go',
  '.java': 'Java',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.kt': 'Kotlin',
  '.mjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.rs': 'Rust',
  '.swift': 'Swift',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
}

const sourceFor = (kind: EvidenceSource['kind'], pathValue?: string, note?: string): EvidenceSource => ({
  detector: DETECTOR,
  kind,
  path: pathValue,
  note,
})

const rootId = (rootPath: string): string => `root:${rootPath || '.'}`

const parentDir = (repoPath: string): string => {
  const directory = path.posix.dirname(repoPath)
  return directory === '.' ? '' : directory
}

const conventionalRootFor = (file: LocalReadinessFile): { path: string; rootKind: RepositoryRootKind } | undefined => {
  const segments = file.path.split('/')
  const first = segments[0] ?? ''
  const second = segments[1]

  if (['apps', 'packages', 'services', 'libs'].includes(first) && second) {
    const rootKind: RepositoryRootKind = first === 'apps' ? 'app' : first === 'services' ? 'service' : 'package'
    return { path: `${first}/${second}`, rootKind }
  }
  if (first === 'cmd' && second) return { path: `${first}/${second}`, rootKind: 'tool' }
  if (['src', 'lib', 'internal', 'pkg'].includes(first)) return { path: first, rootKind: first === 'lib' || first === 'pkg' ? 'library' : 'unknown' }
  if (['docs', 'doc'].includes(first)) return { path: first, rootKind: 'docs' }
  if (['test', 'tests', '__tests__'].includes(first)) return { path: first, rootKind: 'test' }
  if (file.source || file.test || file.documentation) return { path: '', rootKind: 'unknown' }
  return undefined
}

const languageFor = (file: LocalReadinessFile): string | undefined => extensionLanguages[file.extension]

const collectRoots = (files: LocalReadinessFile[], commands: CommandEvidence): RepositoryRootEvidence[] => {
  const roots = new Map<string, RepositoryRootEvidence>()

  const ensureRoot = (
    rootPath: string,
    rootKind: RepositoryRootKind,
    confidence: EvidenceConfidence,
    source: EvidenceSource,
    manifest?: string,
  ): RepositoryRootEvidence => {
    const existing = roots.get(rootPath)
    if (existing) {
      if (existing.rootKind === 'unknown' && rootKind !== 'unknown') existing.rootKind = rootKind
      if (existing.confidence !== 'high' && confidence === 'high') existing.confidence = confidence
      if (manifest && !existing.manifests.includes(manifest)) existing.manifests.push(manifest)
      existing.sources.push(source)
      return existing
    }

    const root: RepositoryRootEvidence = {
      id: rootId(rootPath),
      kind: 'repository-root',
      rootKind,
      path: rootPath || '.',
      paths: [rootPath || '.'],
      languages: [],
      manifests: manifest ? [manifest] : [],
      sourceFiles: 0,
      testFiles: 0,
      documentationFiles: 0,
      generatedFiles: 0,
      confidence,
      sources: [source],
    }
    if (rootPath === '' && commands.packageManager) {
      root.packageManager = commands.packageManager
    }
    roots.set(rootPath, root)
    return root
  }

  for (const file of files) {
    const manifest = MANIFEST_ROOTS[path.posix.basename(file.path)]
    if (manifest) {
      const root = ensureRoot(parentDir(file.path), manifest.rootKind, 'high', sourceFor(manifest.source, file.path), file.path)
      if (manifest.language && !root.languages.includes(manifest.language)) root.languages.push(manifest.language)
    }

    const conventional = conventionalRootFor(file)
    if (conventional) {
      ensureRoot(conventional.path, conventional.rootKind, conventional.path === '' ? 'low' : 'medium', sourceFor('inference', file.path, 'conventional path'))
    }
  }

  if (roots.size === 0) {
    ensureRoot('', 'unknown', 'low', sourceFor('inference', undefined, 'fallback root'))
  }

  const matchRoot = (repoPath: string): RepositoryRootEvidence => {
    const candidates = [...roots.values()]
      .filter(root => root.path === '.' || repoPath === root.path || repoPath.startsWith(`${root.path}/`))
      .sort((a, b) => b.path.length - a.path.length)
    return candidates[0] ?? ensureRoot('', 'unknown', 'low', sourceFor('inference', repoPath, 'fallback root'))
  }

  for (const file of files) {
    const root = matchRoot(file.path)
    if (file.source) root.sourceFiles += 1
    if (file.test) root.testFiles += 1
    if (file.documentation) root.documentationFiles += 1
    if (file.generated || file.minified) root.generatedFiles += 1
    const language = languageFor(file)
    if (language && !root.languages.includes(language)) root.languages.push(language)
  }

  return [...roots.values()]
    .map(root => ({
      ...root,
      languages: root.languages.sort(),
      manifests: root.manifests.sort(),
      sources: dedupeSources(root.sources),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

const dedupeSources = (sources: EvidenceSource[]): EvidenceSource[] => {
  const byKey = new Map<string, EvidenceSource>()
  for (const source of sources) {
    byKey.set(`${source.detector}|${source.kind}|${source.path ?? ''}|${source.note ?? ''}`, source)
  }
  return [...byKey.values()].sort((a, b) => `${a.path ?? ''}${a.note ?? ''}`.localeCompare(`${b.path ?? ''}${b.note ?? ''}`))
}

const readDocument = (root: string, repoPath: string, sizeBytes: number): string => {
  if (sizeBytes > MAX_DOCUMENT_BYTES_PARSED) {
    return readFileSync(path.join(root, repoPath), 'utf8').slice(0, MAX_DOCUMENT_BYTES_PARSED)
  }
  return readFileSync(path.join(root, repoPath), 'utf8')
}

const parseDocument = (root: string, file: LocalReadinessFile): Pick<DocumentSurfaceEvidence, 'title' | 'headings' | 'linkedPaths' | 'commandBlocks'> => {
  let text = ''
  try {
    text = readDocument(root, file.path, file.sizeBytes)
  } catch {
    return { headings: [], linkedPaths: [], commandBlocks: [] }
  }

  const headings = [...text.matchAll(/^(?:#{1,6}\s+|={3,}\s*|[-]{3,}\s*|[A-Za-z][^\n]{1,100}\n[=-]{3,}\s*$)([^\n]*)/gm)]
    .map(match => (match[1] || match[0]).replace(/^[#=\-\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, MAX_HEADINGS_PER_DOCUMENT)
  const title = headings[0]
  const linkedPaths = uniqueSorted(
    [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
      .map(match => match[1].split('#')[0].trim())
      .filter(link => link.length > 0 && !/^[a-z]+:\/\//i.test(link))
      .slice(0, MAX_LINKS_PER_DOCUMENT),
  )
  const commandBlocks = [...text.matchAll(/```([A-Za-z0-9_-]+)?\n([\s\S]*?)```/g)]
    .slice(0, MAX_COMMAND_BLOCKS_PER_DOCUMENT)
    .map((match, index) => {
      const raw = match[2] ?? ''
      const truncated = Buffer.byteLength(raw, 'utf8') > MAX_COMMAND_BLOCK_BYTES
      return {
        index,
        language: match[1],
        text: truncated ? raw.slice(0, MAX_COMMAND_BLOCK_BYTES) : raw,
        truncated,
      }
    })

  return { title, headings, linkedPaths, commandBlocks }
}

const claim = (
  pathValue: string,
  value: DocumentRole,
  confidence: EvidenceConfidence,
  signals: string[],
): EvidenceClaim<'document-role'> => ({
  kind: 'document-role',
  value,
  confidence,
  signals: signals.sort(),
  sources: [sourceFor(signals.some(signal => signal.includes('filename') || signal.includes('path')) ? 'file' : 'inference', pathValue)],
})

interface RoleRuleContext {
  file: LocalReadinessFile
  normalizedPath: string
  headingText: string
  hasCommands: boolean
  hasSetup: boolean
  hasLinks: boolean
  hasHeadings: boolean
  isInstructionSurface: boolean
}

interface RoleRule {
  role: DocumentRole
  confidence: (context: RoleRuleContext) => EvidenceConfidence
  signals: string[]
  matches: (context: RoleRuleContext) => boolean
}

const documentRoleRules: RoleRule[] = [
  {
    role: 'entrypoint',
    confidence: context => context.hasSetup || context.hasCommands || context.hasLinks ? 'high' : 'medium',
    signals: ['root README filename'],
    matches: context => /^readme(\.[^.]+)?$/i.test(context.file.path),
  },
  {
    role: 'contribution',
    confidence: () => 'high',
    signals: ['contribution filename'],
    matches: context => /(^|\/)(contributing)(\.[^.]+)?$/i.test(context.normalizedPath),
  },
  {
    role: 'development',
    confidence: () => 'high',
    signals: ['development filename'],
    matches: context => /(^|\/)(development|hacking|internals)(\.[^.]+)?$/i.test(context.normalizedPath),
  },
  {
    role: 'architecture',
    confidence: context => context.hasHeadings ? 'high' : 'medium',
    signals: ['architecture path'],
    matches: context => (
      /(^|\/)(architecture|design)(\.[^.]+)?$/i.test(context.normalizedPath)
      || /(^|\/)docs?\/.*(architecture|design|internals)/i.test(context.normalizedPath)
    ),
  },
  {
    role: 'decision-record',
    confidence: () => 'high',
    signals: ['decision record path'],
    matches: context => /(^|\/)(adr|adrs|decisions?)\//i.test(context.normalizedPath),
  },
  {
    role: 'environment',
    confidence: context => context.normalizedPath.includes('env') ? 'high' : 'medium',
    signals: ['environment signal'],
    matches: context => (
      /(^|\/)(\.env\.example|\.env\.sample|env\.example)$/i.test(context.normalizedPath)
      || /\b(environment|env vars?|secrets?)\b/i.test(context.headingText)
    ),
  },
  {
    role: 'operation',
    confidence: () => 'medium',
    signals: ['operation signal'],
    matches: context => (
      /(^|\/)(runbook|ops|operations|deploy|release|incident|maintenance)/i.test(context.normalizedPath)
      || /\b(deploy|release|incident|runbook|operations)\b/i.test(context.headingText)
    ),
  },
  {
    role: 'api',
    confidence: () => 'medium',
    signals: ['api signal'],
    matches: context => (
      /(^|\/)(api|reference|cli|protocol)/i.test(context.normalizedPath)
      || /\b(api|cli|protocol|public interface)\b/i.test(context.headingText)
    ),
  },
  {
    role: 'development',
    confidence: context => context.hasSetup && context.hasCommands ? 'high' : 'low',
    signals: ['setup or command block'],
    matches: context => context.hasSetup || context.hasCommands,
  },
  {
    role: 'architecture',
    confidence: () => 'low',
    signals: ['architecture heading'],
    matches: context => /\b(architecture|design|module|boundary|data flow|extension point)\b/i.test(context.headingText),
  },
  {
    role: 'agent-instruction',
    confidence: () => 'high',
    signals: ['instruction detector'],
    matches: context => context.isInstructionSurface,
  },
]

const detectRoleClaims = (
  file: LocalReadinessFile,
  parsed: Pick<DocumentSurfaceEvidence, 'headings' | 'linkedPaths' | 'commandBlocks'>,
  instructions: InstructionSurfaceEvidence[],
): EvidenceClaim<'document-role'>[] => {
  const claims: EvidenceClaim<'document-role'>[] = []
  const headingText = parsed.headings.join(' ').toLowerCase()
  const context: RoleRuleContext = {
    file,
    normalizedPath: file.path.toLowerCase(),
    headingText,
    hasCommands: parsed.commandBlocks.length > 0,
    hasSetup: /\b(setup|install|test|lint|build|type.?check|development|contributing)\b/i.test(headingText),
    hasLinks: parsed.linkedPaths.length > 0,
    hasHeadings: parsed.headings.length > 0,
    isInstructionSurface: instructions.some(surface => surface.path === file.path),
  }
  const add = (role: DocumentRole, confidence: EvidenceConfidence, signals: string[]): void => {
    if (!claims.some(existing => existing.value === role)) {
      claims.push(claim(file.path, role, confidence, signals))
    }
  }

  for (const rule of documentRoleRules) {
    if (rule.matches(context)) {
      add(rule.role, rule.confidence(context), rule.signals)
    }
  }

  return claims.sort((a, b) => `${a.value}:${a.confidence}`.localeCompare(`${b.value}:${b.confidence}`))
}

const collectDocumentSurfaces = (
  root: string,
  files: LocalReadinessFile[],
  instructions: InstructionSurfaceEvidence[],
): DocumentSurfaceEvidence[] => files
  .filter(file => file.documentation || instructions.some(surface => surface.path === file.path))
  .map(file => {
    const parsed = parseDocument(root, file)
    return {
      id: `document-surface:${file.path}`,
      kind: 'document-surface' as const,
      path: file.path,
      paths: [file.path],
      ...parsed,
      roleClaims: detectRoleClaims(file, parsed, instructions),
      sources: [sourceFor('file', file.path)],
    }
  })
  .sort((a, b) => a.id.localeCompare(b.id))

const collectBoundaries = (files: LocalReadinessFile[]): ArchitectureBoundaryEvidence[] => files
  .filter(file => file.source || file.test || file.generated || file.minified)
  .map(file => {
    const normalized = file.path.toLowerCase()
    const role: ArchitectureBoundaryRole = file.test
      ? 'test-support'
      : file.generated || file.minified
        ? 'generated'
        : /(^|\/)(index|main|cli)\.[^.]+$/i.test(file.path)
          ? 'entrypoint'
          : /(^|\/)(api|public|exports?)\//i.test(normalized)
            ? 'public-api'
            : /(^|\/)(internal|private)\//i.test(normalized)
              ? 'internal-module'
              : /(^|\/)(adapters?|integrations?)\//i.test(normalized)
                ? 'adapter'
                : /(^|\/)(domain|core)\//i.test(normalized)
                  ? 'domain'
                  : /(^|\/)(infra|infrastructure|platform)\//i.test(normalized)
                    ? 'infrastructure'
                    : 'unknown'
    const signals = role === 'unknown' ? [] : [`${role} path signal`]
    const confidence: EvidenceConfidence =
      role === 'entrypoint' || role === 'test-support' || role === 'generated'
        ? 'high'
        : role === 'unknown'
          ? 'low'
          : 'medium'
    return {
      id: `architecture-boundary:${file.path}`,
      kind: 'architecture-boundary' as const,
      path: file.path,
      paths: [file.path],
      role,
      signals,
      confidence,
      sources: [sourceFor(file.generated || file.minified ? 'file' : 'inference', file.path)],
    }
  })
  .sort((a, b) => a.id.localeCompare(b.id))

const commandKinds = (commands: CommandEvidence): CiCommandKind[] => {
  const kinds: CiCommandKind[] = []
  if (commands.hasLint) kinds.push('lint')
  if (commands.hasTypeCheck) kinds.push('typecheck')
  if (commands.hasTest) kinds.push('test')
  if (commands.hasBuild) kinds.push('build')
  return kinds
}

const collectVerificationSurfaces = (
  commands: CommandEvidence,
  ci: CiEvidence,
  roots: RepositoryRootEvidence[],
): VerificationSurfaceEvidence[] => {
  const repositoryRoot = roots.find(root => root.path === '.') ?? roots[0]
  const surfaces: VerificationSurfaceEvidence[] = commandKinds(commands).map(kind => ({
    id: `verification-surface:commands:${kind}`,
    kind: 'verification-surface' as const,
    paths: repositoryRoot ? repositoryRoot.paths : ['.'],
    rootIds: repositoryRoot ? [repositoryRoot.id] : [],
    commandKind: kind,
    confidence: 'low' as EvidenceConfidence,
    sources: [sourceFor('manifest', commands.packageManager ? 'package.json' : undefined, 'repository-level command evidence')],
  }))

  for (const workflow of ci.workflows) {
    for (const job of workflow.jobs) {
      for (const kind of job.commandKinds) {
        surfaces.push({
          id: `verification-surface:${workflow.file}:job.${job.id}:${kind}`,
          kind: 'verification-surface' as const,
          paths: [workflow.file],
          rootIds: repositoryRoot ? [repositoryRoot.id] : [],
          commandKind: kind,
          workflowJobId: job.id,
          confidence: 'medium' as EvidenceConfidence,
          sources: [sourceFor('workflow', workflow.file)],
        })
      }
    }
  }

  return surfaces.sort((a, b) => a.id.localeCompare(b.id))
}

const nearestRoot = (repoPath: string, roots: RepositoryRootEvidence[]): RepositoryRootEvidence | undefined => roots
  .filter(root => root.path === '.' || repoPath === root.path || repoPath.startsWith(`${root.path}/`))
  .sort((a, b) => b.path.length - a.path.length)[0]

const buildTopology = (
  files: LocalReadinessFile[],
  roots: RepositoryRootEvidence[],
  documents: DocumentSurfaceEvidence[],
  verificationMappedRootIds: string[],
): RepositoryTopologyEvidence => {
  const rootIdsWithTests = new Set(files.filter(file => file.test).map(file => nearestRoot(file.path, roots)?.id).filter(Boolean) as string[])
  const docsByRoot = new Map<string, DocumentSurfaceEvidence[]>()
  for (const doc of documents) {
    const root = nearestRoot(doc.path, roots)
    if (!root) continue
    docsByRoot.set(root.id, [...(docsByRoot.get(root.id) ?? []), doc])
  }

  const sourceRoots = roots.filter(root => root.sourceFiles > 0)
  const testProximityHints = sourceRoots.map(root => ({
    id: `test-proximity:${root.id}`,
    kind: 'test-proximity-hint' as const,
    paths: root.paths,
    rootId: root.id,
    nearbyTestPaths: files
      .filter(file => file.test && nearestRoot(file.path, roots)?.id === root.id)
      .map(file => file.path)
      .sort(),
    confidence: rootIdsWithTests.has(root.id) ? 'high' as const : 'medium' as const,
    sources: [sourceFor('inference', root.path, 'path proximity')],
  }))

  const documentationProximityHints = sourceRoots.map(root => {
    const docs = docsByRoot.get(root.id) ?? []
    const roles = uniqueSorted(docs.flatMap(doc => doc.roleClaims.map(role => role.value))) as DocumentRole[]
    return {
      id: `documentation-proximity:${root.id}`,
      kind: 'documentation-proximity-hint' as const,
      paths: root.paths,
      rootId: root.id,
      documentSurfaceIds: docs.map(doc => doc.id).sort(),
      roleClaims: roles,
      confidence: docs.length > 0 ? 'medium' as const : 'low' as const,
      sources: [sourceFor('inference', root.path, 'path proximity')],
    }
  })

  const generatedPressure: GeneratedPressureEvidence[] = roots.map(root => {
    const rootFiles = files.filter(file => root.path === '.' || file.path === root.path || file.path.startsWith(`${root.path}/`))
    const totalBytes = rootFiles.reduce((total, file) => total + file.sizeBytes, 0)
    const generatedFiles = rootFiles.filter(file => file.generated || file.minified)
    const generatedBytes = generatedFiles.reduce((total, file) => total + file.sizeBytes, 0)
    return {
      id: `generated-pressure:${root.id}`,
      kind: 'generated-pressure' as const,
      paths: root.paths,
      rootId: root.id,
      generatedFileRatio: rootFiles.length === 0 ? 0 : generatedFiles.length / rootFiles.length,
      generatedBytesRatio: totalBytes === 0 ? 0 : generatedBytes / totalBytes,
      confidence: 'high' as const,
      sources: [sourceFor('file', root.path)],
    }
  }).sort((a, b) => a.id.localeCompare(b.id))

  const totalSource = roots.reduce((total, root) => total + root.sourceFiles, 0)
  const largestRootSource = Math.max(0, ...roots.map(root => root.sourceFiles))
  const rootsWithoutLocalTests = sourceRoots.filter(root => !rootIdsWithTests.has(root.id)).length
  const rootsWithoutLocalDocs = sourceRoots.filter(root => (docsByRoot.get(root.id) ?? []).length === 0).length
  const rootsWithDocs = sourceRoots.length - rootsWithoutLocalDocs
  const totalFiles = files.length
  const generatedFiles = files.filter(file => file.generated || file.minified).length

  return {
    dependencyHints: [],
    testProximityHints,
    documentationProximityHints,
    generatedPressure,
    metrics: {
      rootCount: roots.length,
      languageCount: uniqueSorted(roots.flatMap(root => root.languages)).length,
      sourceToNearbyTestRatio: sourceRoots.length === 0 ? undefined : (sourceRoots.length - rootsWithoutLocalTests) / sourceRoots.length,
      docsToSourceProximityRatio: sourceRoots.length === 0 ? undefined : rootsWithDocs / sourceRoots.length,
      generatedFileRatio: totalFiles === 0 ? 0 : generatedFiles / totalFiles,
      largestRootShare: totalSource === 0 ? 0 : largestRootSource / totalSource,
      publicApiSurfaceCount: files.filter(file => /(^|\/)(api|public|exports?)\//i.test(file.path)).length,
      rootsWithoutLocalTests,
      rootsWithoutLocalDocs,
      verificationMappedRootCount: new Set(verificationMappedRootIds).size,
    },
  }
}

const makeInsight = (input: Omit<DesignStateInsight, 'gateable'>): DesignStateInsight => ({
  ...input,
  gateable: false,
})

export const buildDesignState = (
  evidence: RepositoryEvidence,
  findings: ReadinessFinding[],
  safetySignals: SafetySignalEvidence[],
): DesignStateSummary => {
  const docsWithRoles = evidence.documentSurfaces.filter(surface => surface.roleClaims.length > 0)
  const sourceRoots = evidence.roots.filter(root => root.sourceFiles > 0)
  const rootsWithoutTests = evidence.topology.testProximityHints.filter(hint => hint.nearbyTestPaths.length === 0)
  const rootsWithoutDocs = evidence.topology.documentationProximityHints.filter(hint => hint.documentSurfaceIds.length === 0)
  const generatedHeavy = evidence.topology.generatedPressure.filter(item => item.generatedFileRatio >= 0.3 || item.generatedBytesRatio >= 0.5)
  const gateableFindingIds = new Set(findings.filter(finding => finding.severity !== 'info').map(finding => finding.id))

  const strengths: DesignStateInsight[] = []
  const risks: DesignStateInsight[] = []
  const ambiguities: DesignStateInsight[] = []

  if (docsWithRoles.length > 0) {
    strengths.push(makeInsight({
      id: 'design-state:documentation-evidence',
      category: 'documentation-evidence',
      title: 'Documentation role evidence found',
      severity: 'info',
      summary: `${docsWithRoles.length} document surface(s) have deterministic role evidence.`,
      evidenceIds: docsWithRoles.map(surface => surface.id),
      paths: docsWithRoles.map(surface => surface.path).sort(),
      confidence: 'medium',
    }))
  }

  if (evidence.verificationSurfaces.length > 0) {
    strengths.push(makeInsight({
      id: 'design-state:verification-map',
      category: 'verification-locality',
      title: 'Verification surfaces detected',
      severity: 'info',
      summary: `${evidence.verificationSurfaces.length} command or CI verification surface(s) were detected.`,
      evidenceIds: evidence.verificationSurfaces.map(surface => surface.id),
      paths: uniqueSorted(evidence.verificationSurfaces.flatMap(surface => surface.paths)),
      confidence: 'medium',
    }))
  }

  if (sourceRoots.length > 0 && rootsWithoutTests.length > 0) {
    risks.push(makeInsight({
      id: 'design-state:verification-locality:unmapped-tests',
      category: 'verification-locality',
      title: 'Some source roots have no nearby tests',
      severity: 'info',
      summary: `${rootsWithoutTests.length} source root(s) have no path-local test evidence.`,
      evidenceIds: rootsWithoutTests.map(hint => hint.id),
      paths: uniqueSorted(rootsWithoutTests.flatMap(hint => hint.paths)),
      confidence: 'medium',
      recommendation: 'Add local tests or document the verification command that covers these roots.',
    }))
  }

  if (sourceRoots.length > 0 && rootsWithoutDocs.length > 0) {
    ambiguities.push(makeInsight({
      id: 'design-state:documentation-proximity:unmapped-docs',
      category: 'documentation-evidence',
      title: 'Some source roots have no nearby documentation',
      severity: 'info',
      summary: `${rootsWithoutDocs.length} source root(s) have no path-local document role evidence.`,
      evidenceIds: rootsWithoutDocs.map(hint => hint.id),
      paths: uniqueSorted(rootsWithoutDocs.flatMap(hint => hint.paths)),
      confidence: 'low',
      recommendation: 'Link architecture, development, or API docs to the affected roots.',
    }))
  }

  if (generatedHeavy.length > 0) {
    risks.push(makeInsight({
      id: 'design-state:generated-content:high-pressure',
      category: 'generated-content',
      title: 'Generated content pressure detected',
      severity: 'info',
      summary: `${generatedHeavy.length} root(s) have generated/minified file or byte pressure.`,
      evidenceIds: generatedHeavy.map(item => item.id),
      paths: uniqueSorted(generatedHeavy.flatMap(item => item.paths)),
      confidence: 'high',
      recommendation: 'Keep generated areas clearly documented or ignored for agent context selection.',
    }))
  }

  if (safetySignals.length > 0) {
    risks.push({
      id: 'design-state:safety-signals',
      category: 'safety',
      title: 'Safety-relevant scripts detected',
      severity: safetySignals.some(signal => signal.category === 'destructive' || signal.category === 'network-exec') ? 'warning' : 'info',
      gateable: safetySignals.some(signal => gateableFindingIds.has(`safety.${signal.category}:${signal.source}`)),
      summary: `${safetySignals.length} safety-relevant package script signal(s) were found.`,
      evidenceIds: [],
      paths: uniqueSorted(safetySignals.map(signal => signal.source.split('#')[0])),
      confidence: 'high',
    })
  }

  return {
    strengths: strengths.sort((a, b) => a.id.localeCompare(b.id)),
    risks: risks.sort((a, b) => a.id.localeCompare(b.id)),
    ambiguities: ambiguities.sort((a, b) => a.id.localeCompare(b.id)),
  }
}

export const detectRepositoryEvidence = (
  root: string,
  files: LocalReadinessFile[],
  commands: CommandEvidence,
  ci: CiEvidence,
  instructions: InstructionSurfaceEvidence[],
): RepositoryEvidence => {
  const roots = collectRoots(files, commands)
  const documentSurfaces = collectDocumentSurfaces(root, files, instructions)
  const boundaries = collectBoundaries(files)
  const verificationSurfaces = collectVerificationSurfaces(commands, ci, roots)
  const topology = buildTopology(files, roots, documentSurfaces, verificationSurfaces.flatMap(surface => surface.rootIds))

  return {
    roots,
    boundaries,
    documentSurfaces,
    verificationSurfaces,
    topology,
  }
}
