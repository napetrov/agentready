import { execFileSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import {
  detectInstructionSurfaces,
  InstructionSurfaceEvidence,
  RepositoryFileReference,
} from './instruction-surface-detector'

export type ReadinessSeverity = 'info' | 'warning' | 'error'

export interface LocalReadinessFile {
  path: string
  sizeBytes: number
  extension: string
  binary: boolean
  generated: boolean
  minified: boolean
  documentation: boolean
  test: boolean
  source: boolean
}

export interface ReadinessFinding {
  id: string
  title: string
  severity: ReadinessSeverity
  path?: string
  recommendation: string
}

export interface ContractValidationResult {
  valid: boolean
  errors: string[]
}

export interface LocalReadinessReport {
  root: string
  generatedAt: string
  summary: {
    score: number
    totalFiles: number
    totalBytes: number
    sourceFiles: number
    testFiles: number
    documentationFiles: number
    largeFiles: number
    binaryFiles: number
    generatedFiles: number
    minifiedFiles: number
  }
  docs: {
    readme: string[]
    contributing: string[]
    architecture: string[]
    environment: string[]
  }
  commands: {
    packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun'
    scripts: string[]
    hasBuild: boolean
    hasTest: boolean
    hasLint: boolean
    hasTypeCheck: boolean
  }
  ci: {
    workflowFiles: string[]
  }
  instructions: InstructionSurfaceEvidence[]
  findings: ReadinessFinding[]
  files: LocalReadinessFile[]
}

export interface ReadinessDiffReport {
  base: string
  head: string
  generatedAt: string
  baseReport: LocalReadinessReport
  headReport: LocalReadinessReport
  summary: {
    scoreDelta: number
    filesDelta: number
    bytesDelta: number
    findingsDelta: number
    newFindings: number
    resolvedFindings: number
  }
  newFindings: ReadinessFinding[]
  resolvedFindings: ReadinessFinding[]
  regressions: ReadinessFinding[]
}

export interface ScanOptions {
  now?: Date
}

export interface DiffOptions extends ScanOptions {
  base: string
  head: string
}

const ignoredDirectories = new Set([
  '.git',
  '.next',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
])

const sourceExtensions = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cs',
  '.css',
  '.go',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.mjs',
  '.py',
  '.rb',
  '.rs',
  '.swift',
  '.ts',
  '.tsx',
])

const documentationExtensions = new Set(['.md', '.mdx', '.rst', '.txt', '.adoc'])
const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mov',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.webp',
  '.zip',
])

const generatedPathPatterns = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lockb$/,
  /(^|\/)generated\//,
  /(^|\/)__generated__\//,
  /(^|\/)vendor\//,
]

const testPathPattern = /(^|\/)(__tests__|tests?|spec)\//i
const testFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/i

const toRepositoryPath = (root: string, filePath: string): string => (
  path.relative(root, filePath).split(path.sep).join('/')
)

const isIgnoredDirectory = (directoryName: string): boolean => ignoredDirectories.has(directoryName)

const isLikelyBinary = (absolutePath: string, extension: string): boolean => {
  if (binaryExtensions.has(extension)) {
    return true
  }

  const sample = readFileSync(absolutePath, { flag: 'r' }).subarray(0, 4096)
  return sample.includes(0)
}

const isGeneratedPath = (repoPath: string): boolean => generatedPathPatterns.some(pattern => pattern.test(repoPath))

const isMinifiedPath = (repoPath: string): boolean => /\.(min|bundle)\.(js|css)$/i.test(repoPath)

const isDocumentationPath = (repoPath: string, extension: string): boolean => (
  documentationExtensions.has(extension)
  || /^docs\//i.test(repoPath)
  || /(^|\/)(README|CONTRIBUTING|CHANGELOG|ARCHITECTURE|DEVELOPMENT)(\.[^.]+)?$/i.test(repoPath)
)

const isSourcePath = (repoPath: string, extension: string): boolean => (
  sourceExtensions.has(extension)
  && !isGeneratedPath(repoPath)
  && !testPathPattern.test(repoPath)
  && !testFilePattern.test(repoPath)
)

const walkFiles = (root: string, directory = root): LocalReadinessFile[] => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files: LocalReadinessFile[] = []

  for (const entry of entries) {
    if (entry.isDirectory() && isIgnoredDirectory(entry.name)) {
      continue
    }

    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...walkFiles(root, absolutePath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const repoPath = toRepositoryPath(root, absolutePath)
    const stat = statSync(absolutePath)
    const extension = path.extname(entry.name).toLowerCase()
    const binary = isLikelyBinary(absolutePath, extension)

    files.push({
      path: repoPath,
      sizeBytes: stat.size,
      extension,
      binary,
      generated: isGeneratedPath(repoPath),
      minified: isMinifiedPath(repoPath),
      documentation: isDocumentationPath(repoPath, extension),
      test: testPathPattern.test(repoPath) || testFilePattern.test(repoPath),
      source: isSourcePath(repoPath, extension),
    })
  }

  return files.sort((a, b) => a.path.localeCompare(b.path))
}

const readJsonFile = (root: string, repoPath: string): unknown | undefined => {
  const absolutePath = path.join(root, repoPath)
  if (!existsSync(absolutePath)) {
    return undefined
  }

  return JSON.parse(readFileSync(absolutePath, 'utf8'))
}

const detectPackageManager = (files: LocalReadinessFile[]): LocalReadinessReport['commands']['packageManager'] => {
  const filePaths = new Set(files.map(file => file.path))
  if (filePaths.has('pnpm-lock.yaml')) return 'pnpm'
  if (filePaths.has('yarn.lock')) return 'yarn'
  if (filePaths.has('bun.lockb')) return 'bun'
  if (filePaths.has('package-lock.json') || filePaths.has('package.json')) return 'npm'
  return undefined
}

const getPackageScripts = (root: string): string[] => {
  const packageJson = readJsonFile(root, 'package.json') as { scripts?: Record<string, string> } | undefined
  return Object.keys(packageJson?.scripts ?? {}).sort()
}

const hasAnyScript = (scripts: string[], names: string[]): boolean => names.some(name => scripts.includes(name))

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort()

const buildFindings = (
  files: LocalReadinessFile[],
  report: Omit<LocalReadinessReport, 'findings' | 'summary'>,
): ReadinessFinding[] => {
  const findings: ReadinessFinding[] = []

  if (report.docs.readme.length === 0) {
    findings.push({
      id: 'docs.readme.missing',
      title: 'Repository has no README',
      severity: 'error',
      recommendation: 'Add a root README with purpose, setup, validation commands, and common agent entrypoints.',
    })
  }

  if (report.docs.architecture.length === 0 && files.filter(file => file.source).length > 20) {
    findings.push({
      id: 'docs.architecture.missing',
      title: 'Non-trivial repository has no architecture documentation',
      severity: 'warning',
      recommendation: 'Add architecture notes that explain module boundaries, data flow, and where agents should make changes.',
    })
  }

  if (!report.commands.hasTest) {
    findings.push({
      id: 'commands.test.missing',
      title: 'No test command detected',
      severity: 'error',
      recommendation: 'Expose a stable test command in package scripts or documented project tooling.',
    })
  }

  if (!report.commands.hasLint) {
    findings.push({
      id: 'commands.lint.missing',
      title: 'No lint command detected',
      severity: 'warning',
      recommendation: 'Expose a lint command so agents can catch style and static analysis regressions before review.',
    })
  }

  if (!report.commands.hasTypeCheck && files.some(file => ['.ts', '.tsx'].includes(file.extension))) {
    findings.push({
      id: 'commands.typecheck.missing',
      title: 'TypeScript repository has no type-check command',
      severity: 'warning',
      recommendation: 'Expose a type-check command and run it in CI.',
    })
  }

  if (report.ci.workflowFiles.length === 0) {
    findings.push({
      id: 'ci.workflow.missing',
      title: 'No CI workflow detected',
      severity: 'warning',
      recommendation: 'Add CI that runs install, lint, type-check, tests, and build where applicable.',
    })
  }

  if (report.instructions.length === 0) {
    findings.push({
      id: 'instructions.missing',
      title: 'No agent instruction surface detected',
      severity: 'warning',
      recommendation: 'Add AGENTS.md or the relevant agent-specific instruction file with repo conventions and validation commands.',
    })
  }

  for (const surface of report.instructions.filter(surface => surface.localPrivate)) {
    findings.push({
      id: `instructions.local-private:${surface.path}`,
      title: 'Local/private agent instruction file is present',
      severity: 'warning',
      path: surface.path,
      recommendation: 'Keep local-private instruction files out of shared repository history unless this is intentional.',
    })
  }

  for (const file of files.filter(file => file.sizeBytes > 1_000_000 && !file.generated)) {
    findings.push({
      id: `files.large:${file.path}`,
      title: 'Large checked-in file can create agent context friction',
      severity: file.sizeBytes > 5_000_000 ? 'error' : 'warning',
      path: file.path,
      recommendation: 'Move large assets/data out of the main source tree or document why agents should ignore them.',
    })
  }

  for (const file of files.filter(file => file.minified)) {
    findings.push({
      id: `files.minified:${file.path}`,
      title: 'Minified file is checked into the repository',
      severity: 'warning',
      path: file.path,
      recommendation: 'Prefer generated build output outside source control, or ignore it in AgentReady policy if intentional.',
    })
  }

  return findings.sort((a, b) => a.id.localeCompare(b.id))
}

const calculateScore = (findings: ReadinessFinding[]): number => {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'error') return total + 18
    if (finding.severity === 'warning') return total + 7
    return total + 2
  }, 0)

  return Math.max(0, Math.min(100, 100 - penalty))
}

export function scanLocalReadiness(root: string, options: ScanOptions = {}): LocalReadinessReport {
  const absoluteRoot = path.resolve(root)
  const files = walkFiles(absoluteRoot)
  const filePaths = files.map(file => file.path)
  const scripts = getPackageScripts(absoluteRoot)
  const instructionInput: RepositoryFileReference[] = files.map(file => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
  }))

  const partialReport = {
    root: absoluteRoot,
    generatedAt: (options.now ?? new Date()).toISOString(),
    docs: {
      readme: filePaths.filter(filePath => /(^|\/)README(\.[^.]+)?$/i.test(filePath)).sort(),
      contributing: filePaths.filter(filePath => /(^|\/)CONTRIBUTING(\.[^.]+)?$/i.test(filePath)).sort(),
      architecture: filePaths.filter(filePath => /(^|\/)(ARCHITECTURE|DEVELOPMENT)(\.[^.]+)?$/i.test(filePath)).sort(),
      environment: filePaths.filter(filePath => /(^|\/)(\.env\.example|\.env\.sample|env\.example)$/i.test(filePath)).sort(),
    },
    commands: {
      packageManager: detectPackageManager(files),
      scripts,
      hasBuild: hasAnyScript(scripts, ['build']),
      hasTest: hasAnyScript(scripts, ['test', 'test:unit', 'test:ci']),
      hasLint: hasAnyScript(scripts, ['lint']),
      hasTypeCheck: hasAnyScript(scripts, ['type-check', 'typecheck', 'check:types']),
    },
    ci: {
      workflowFiles: filePaths.filter(filePath => filePath.startsWith('.github/workflows/')).sort(),
    },
    instructions: detectInstructionSurfaces(instructionInput),
    files,
  }

  const findings = buildFindings(files, partialReport)

  return {
    ...partialReport,
    summary: {
      score: calculateScore(findings),
      totalFiles: files.length,
      totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
      sourceFiles: files.filter(file => file.source).length,
      testFiles: files.filter(file => file.test).length,
      documentationFiles: files.filter(file => file.documentation).length,
      largeFiles: files.filter(file => file.sizeBytes > 1_000_000).length,
      binaryFiles: files.filter(file => file.binary).length,
      generatedFiles: files.filter(file => file.generated).length,
      minifiedFiles: files.filter(file => file.minified).length,
    },
    findings,
  }
}

const findingKey = (finding: ReadinessFinding): string => `${finding.id}|${finding.path ?? ''}`

const runGit = (root: string, args: string[]): string => (
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
)

const scanGitTree = (root: string, ref: string, options: ScanOptions): LocalReadinessReport => {
  const currentBranch = runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const currentCommit = runGit(root, ['rev-parse', 'HEAD'])
  const restoreRef = currentBranch === 'HEAD' ? currentCommit : currentBranch

  try {
    runGit(root, ['checkout', '--quiet', ref])
    return scanLocalReadiness(root, options)
  } finally {
    runGit(root, ['checkout', '--quiet', restoreRef])
  }
}

export function diffLocalReadiness(root: string, options: DiffOptions): ReadinessDiffReport {
  const generatedAt = (options.now ?? new Date()).toISOString()
  const baseReport = scanGitTree(root, options.base, { now: options.now })
  const headReport = scanGitTree(root, options.head, { now: options.now })
  const baseFindingsByKey = new Map(baseReport.findings.map(finding => [findingKey(finding), finding]))
  const headFindingsByKey = new Map(headReport.findings.map(finding => [findingKey(finding), finding]))
  const newFindings = headReport.findings.filter(finding => !baseFindingsByKey.has(findingKey(finding)))
  const resolvedFindings = baseReport.findings.filter(finding => !headFindingsByKey.has(findingKey(finding)))
  const regressions = newFindings.filter(finding => finding.severity === 'error' || finding.severity === 'warning')

  return {
    base: options.base,
    head: options.head,
    generatedAt,
    baseReport,
    headReport,
    summary: {
      scoreDelta: headReport.summary.score - baseReport.summary.score,
      filesDelta: headReport.summary.totalFiles - baseReport.summary.totalFiles,
      bytesDelta: headReport.summary.totalBytes - baseReport.summary.totalBytes,
      findingsDelta: headReport.findings.length - baseReport.findings.length,
      newFindings: newFindings.length,
      resolvedFindings: resolvedFindings.length,
    },
    newFindings,
    resolvedFindings,
    regressions,
  }
}

export function formatScanSummary(report: LocalReadinessReport): string {
  const lines = [
    `AgentReady score: ${report.summary.score}/100`,
    `Files: ${report.summary.totalFiles} (${report.summary.sourceFiles} source, ${report.summary.testFiles} tests, ${report.summary.documentationFiles} docs)`,
    `Findings: ${report.findings.length}`,
  ]

  for (const finding of report.findings.slice(0, 10)) {
    lines.push(`- [${finding.severity}] ${finding.title}${finding.path ? ` (${finding.path})` : ''}`)
  }

  return lines.join('\n')
}

const markdownFindingList = (findings: ReadinessFinding[]): string[] => {
  if (findings.length === 0) {
    return ['No findings.']
  }

  return findings.slice(0, 10).map(finding => (
    `- **${finding.severity.toUpperCase()}**: ${finding.title}${finding.path ? ` (${finding.path})` : ''}. ${finding.recommendation}`
  ))
}

export function formatScanMarkdown(report: LocalReadinessReport): string {
  return [
    '## AgentReady scan',
    '',
    `Score: **${report.summary.score}/100**`,
    `Files: ${report.summary.totalFiles} total, ${report.summary.sourceFiles} source, ${report.summary.testFiles} tests, ${report.summary.documentationFiles} docs`,
    `Findings: ${report.findings.length}`,
    '',
    '### Findings',
    ...markdownFindingList(report.findings),
  ].join('\n')
}

export function formatDiffSummary(report: ReadinessDiffReport): string {
  const lines = [
    `AgentReady diff: ${report.base}..${report.head}`,
    `Score delta: ${report.summary.scoreDelta >= 0 ? '+' : ''}${report.summary.scoreDelta}`,
    `New findings: ${report.summary.newFindings}, resolved: ${report.summary.resolvedFindings}`,
  ]

  for (const finding of report.regressions.slice(0, 10)) {
    lines.push(`- [${finding.severity}] ${finding.title}${finding.path ? ` (${finding.path})` : ''}`)
  }

  return lines.join('\n')
}

export function formatDiffMarkdown(report: ReadinessDiffReport): string {
  return [
    '## AgentReady PR readiness',
    '',
    `Base/head: \`${report.base}\` .. \`${report.head}\``,
    `Score delta: **${report.summary.scoreDelta >= 0 ? '+' : ''}${report.summary.scoreDelta}**`,
    `New findings: ${report.summary.newFindings}; resolved findings: ${report.summary.resolvedFindings}`,
    `Regression findings: ${report.regressions.length}`,
    '',
    '### New regressions',
    ...markdownFindingList(report.regressions),
    '',
    '### Recommendations',
    ...markdownFindingList(report.newFindings),
  ].join('\n')
}

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every(item => typeof item === 'string')
)

const isSeverity = (value: unknown): value is ReadinessSeverity => (
  value === 'info' || value === 'warning' || value === 'error'
)

const validateFindingContract = (finding: unknown, pathPrefix: string): string[] => {
  const errors: string[] = []
  if (!isObject(finding)) {
    return [`${pathPrefix} must be an object`]
  }

  if (typeof finding.id !== 'string' || finding.id.length === 0) errors.push(`${pathPrefix}.id must be a non-empty string`)
  if (typeof finding.title !== 'string' || finding.title.length === 0) errors.push(`${pathPrefix}.title must be a non-empty string`)
  if (!isSeverity(finding.severity)) errors.push(`${pathPrefix}.severity must be info, warning, or error`)
  if ('path' in finding && typeof finding.path !== 'string') errors.push(`${pathPrefix}.path must be a string when present`)
  if (typeof finding.recommendation !== 'string' || finding.recommendation.length === 0) {
    errors.push(`${pathPrefix}.recommendation must be a non-empty string`)
  }

  return errors
}

export function validateLocalReadinessReportContract(report: unknown): ContractValidationResult {
  const errors: string[] = []

  if (!isObject(report)) {
    return { valid: false, errors: ['report must be an object'] }
  }

  if (typeof report.root !== 'string') errors.push('root must be a string')
  if (typeof report.generatedAt !== 'string') errors.push('generatedAt must be a string')

  if (!isObject(report.summary)) {
    errors.push('summary must be an object')
  } else {
    for (const key of [
      'score',
      'totalFiles',
      'totalBytes',
      'sourceFiles',
      'testFiles',
      'documentationFiles',
      'largeFiles',
      'binaryFiles',
      'generatedFiles',
      'minifiedFiles',
    ]) {
      if (typeof report.summary[key] !== 'number') errors.push(`summary.${key} must be a number`)
    }
  }

  if (!isObject(report.docs)) {
    errors.push('docs must be an object')
  } else {
    for (const key of ['readme', 'contributing', 'architecture', 'environment']) {
      if (!isStringArray(report.docs[key])) errors.push(`docs.${key} must be a string array`)
    }
  }

  if (!isObject(report.commands)) {
    errors.push('commands must be an object')
  } else {
    if ('packageManager' in report.commands && typeof report.commands.packageManager !== 'string') {
      errors.push('commands.packageManager must be a string when present')
    }
    if (!isStringArray(report.commands.scripts)) errors.push('commands.scripts must be a string array')
    for (const key of ['hasBuild', 'hasTest', 'hasLint', 'hasTypeCheck']) {
      if (typeof report.commands[key] !== 'boolean') errors.push(`commands.${key} must be a boolean`)
    }
  }

  if (!isObject(report.ci) || !isStringArray(report.ci.workflowFiles)) {
    errors.push('ci.workflowFiles must be a string array')
  }

  if (!Array.isArray(report.instructions)) errors.push('instructions must be an array')
  if (!Array.isArray(report.files)) errors.push('files must be an array')

  if (!Array.isArray(report.findings)) {
    errors.push('findings must be an array')
  } else {
    report.findings.forEach((finding, index) => {
      errors.push(...validateFindingContract(finding, `findings[${index}]`))
    })
  }

  return { valid: errors.length === 0, errors }
}

export function validateReadinessDiffReportContract(report: unknown): ContractValidationResult {
  const errors: string[] = []

  if (!isObject(report)) {
    return { valid: false, errors: ['diff report must be an object'] }
  }

  if (typeof report.base !== 'string') errors.push('base must be a string')
  if (typeof report.head !== 'string') errors.push('head must be a string')
  if (typeof report.generatedAt !== 'string') errors.push('generatedAt must be a string')

  const baseValidation = validateLocalReadinessReportContract(report.baseReport)
  errors.push(...baseValidation.errors.map(error => `baseReport.${error}`))
  const headValidation = validateLocalReadinessReportContract(report.headReport)
  errors.push(...headValidation.errors.map(error => `headReport.${error}`))

  if (!isObject(report.summary)) {
    errors.push('summary must be an object')
  } else {
    for (const key of ['scoreDelta', 'filesDelta', 'bytesDelta', 'findingsDelta', 'newFindings', 'resolvedFindings']) {
      if (typeof report.summary[key] !== 'number') errors.push(`summary.${key} must be a number`)
    }
  }

  for (const key of ['newFindings', 'resolvedFindings', 'regressions']) {
    if (!Array.isArray(report[key])) {
      errors.push(`${key} must be an array`)
    } else {
      report[key].forEach((finding, index) => {
        errors.push(...validateFindingContract(finding, `${key}[${index}]`))
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

export type CompactLocalReadinessReport = Omit<LocalReadinessReport, 'files'> & { files?: never }
export type CompactReadinessDiffReport = Omit<ReadinessDiffReport, 'baseReport' | 'headReport'> & {
  baseReport: CompactLocalReadinessReport
  headReport: CompactLocalReadinessReport
}

export function compactReport(report: LocalReadinessReport): CompactLocalReadinessReport {
  const { files: _files, ...compact } = report
  return {
    ...compact,
  }
}

export function compactDiffReport(report: ReadinessDiffReport): CompactReadinessDiffReport {
  return {
    ...report,
    baseReport: compactReport(report.baseReport),
    headReport: compactReport(report.headReport),
  }
}

export function listFindingIds(report: LocalReadinessReport): string[] {
  return uniqueSorted(report.findings.map(finding => finding.id))
}
