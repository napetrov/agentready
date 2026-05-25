import { execFileSync } from 'child_process'
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'fs'
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

export interface LocalReadinessConfig {
  ignorePaths: string[]
  largeFileWarningBytes: number
  largeFileErrorBytes: number
  allowMinifiedFiles: boolean
  errorOnWarnings: boolean
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
  configPath?: string
  config?: Partial<LocalReadinessConfig>
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

const defaultConfig: LocalReadinessConfig = {
  ignorePaths: [],
  largeFileWarningBytes: 1_000_000,
  largeFileErrorBytes: 5_000_000,
  allowMinifiedFiles: false,
  errorOnWarnings: false,
}

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

const normalizeRepoPath = (repoPath: string): string => repoPath.replace(/\\/g, '/').replace(/^\.?\//, '')

const escapeRegex = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')

const globToRegex = (pattern: string): RegExp => {
  const normalized = normalizeRepoPath(pattern)
  let source = ''

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (char === '*' && next === '*') {
      source += '.*'
      index += 1
    } else if (char === '*') {
      source += '[^/]*'
    } else {
      source += escapeRegex(char)
    }
  }

  return new RegExp(`^${source}$`)
}

const pathMatchesPattern = (repoPath: string, pattern: string): boolean => {
  const normalizedPath = normalizeRepoPath(repoPath)
  const normalizedPattern = normalizeRepoPath(pattern)

  if (normalizedPattern.length === 0) {
    return false
  }

  if (!normalizedPattern.includes('*')) {
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`)
  }

  return globToRegex(normalizedPattern).test(normalizedPath)
}

const shouldIgnorePath = (repoPath: string, config: LocalReadinessConfig): boolean => (
  config.ignorePaths.some(pattern => pathMatchesPattern(repoPath, pattern))
)

const coerceConfig = (rawConfig: unknown, source: string): Partial<LocalReadinessConfig> => {
  if (!isObject(rawConfig)) {
    throw new Error(`${source} must be a JSON object`)
  }

  const config: Partial<LocalReadinessConfig> = {}

  if ('ignorePaths' in rawConfig) {
    if (!isStringArray(rawConfig.ignorePaths)) {
      throw new Error(`${source}.ignorePaths must be an array of strings`)
    }
    config.ignorePaths = rawConfig.ignorePaths.map(normalizeRepoPath)
  }

  for (const key of ['largeFileWarningBytes', 'largeFileErrorBytes'] as const) {
    if (key in rawConfig) {
      const value = rawConfig[key]
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new Error(`${source}.${key} must be a non-negative integer`)
      }
      config[key] = value
    }
  }

  for (const key of ['allowMinifiedFiles', 'errorOnWarnings'] as const) {
    if (key in rawConfig) {
      const value = rawConfig[key]
      if (typeof value !== 'boolean') {
        throw new Error(`${source}.${key} must be a boolean`)
      }
      config[key] = value
    }
  }

  return config
}

const readConfigFile = (configPath: string): Partial<LocalReadinessConfig> => {
  let rawConfig: unknown
  try {
    rawConfig = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read AgentReady config ${configPath}: ${error instanceof Error ? error.message : String(error)}`)
  }

  return coerceConfig(rawConfig, configPath)
}

const loadConfig = (root: string, options: ScanOptions): LocalReadinessConfig => {
  const configCandidates = options.configPath
    ? [path.resolve(root, options.configPath)]
    : ['.agentready.json', 'agentready.config.json'].map(candidate => path.join(root, candidate))

  const fileConfig = configCandidates.find(candidate => existsSync(candidate))
  if (options.configPath && !fileConfig) {
    throw new Error(`AgentReady config file not found: ${path.resolve(root, options.configPath)}`)
  }

  const loadedConfig = fileConfig ? readConfigFile(fileConfig) : {}
  const merged = {
    ...defaultConfig,
    ...loadedConfig,
    ...options.config,
  }

  if (merged.largeFileErrorBytes < merged.largeFileWarningBytes) {
    throw new Error('largeFileErrorBytes must be greater than or equal to largeFileWarningBytes')
  }

  return merged
}

const isLikelyBinary = (absolutePath: string, extension: string): boolean => {
  if (binaryExtensions.has(extension)) {
    return true
  }

  let fd: number | undefined
  try {
    fd = openSync(absolutePath, 'r')
    const sample = Buffer.alloc(4096)
    const bytesRead = readSync(fd, sample, 0, sample.length, 0)
    return sample.subarray(0, bytesRead).includes(0)
  } catch (error) {
    console.warn(`AgentReady: unable to sample file for binary detection (${absolutePath}): ${error instanceof Error ? error.message : String(error)}`)
    return false
  } finally {
    if (fd !== undefined) {
      closeSync(fd)
    }
  }
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

const walkFiles = (root: string, config: LocalReadinessConfig, directory = root): LocalReadinessFile[] => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files: LocalReadinessFile[] = []

  for (const entry of entries) {
    if (entry.isDirectory() && isIgnoredDirectory(entry.name)) {
      continue
    }

    const absolutePath = path.join(directory, entry.name)
    const repoPath = toRepositoryPath(root, absolutePath)

    if (shouldIgnorePath(repoPath, config)) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...walkFiles(root, config, absolutePath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

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

  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    console.error(`AgentReady: readJsonFile could not parse ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
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
  config: LocalReadinessConfig,
): ReadinessFinding[] => {
  const findings: ReadinessFinding[] = []
  const expectsNodeCommands = Boolean(report.commands.packageManager)
  const warningSeverity: ReadinessSeverity = config.errorOnWarnings ? 'error' : 'warning'

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
      severity: warningSeverity,
      recommendation: 'Add architecture notes that explain module boundaries, data flow, and where agents should make changes.',
    })
  }

  if (expectsNodeCommands && !report.commands.hasTest) {
    findings.push({
      id: 'commands.test.missing',
      title: 'No test command detected',
      severity: 'error',
      recommendation: 'Expose a stable test command in package scripts or documented project tooling.',
    })
  }

  if (expectsNodeCommands && !report.commands.hasLint) {
    findings.push({
      id: 'commands.lint.missing',
      title: 'No lint command detected',
      severity: warningSeverity,
      recommendation: 'Expose a lint command so agents can catch style and static analysis regressions before review.',
    })
  }

  if (expectsNodeCommands && !report.commands.hasTypeCheck && files.some(file => ['.ts', '.tsx'].includes(file.extension))) {
    findings.push({
      id: 'commands.typecheck.missing',
      title: 'TypeScript repository has no type-check command',
      severity: warningSeverity,
      recommendation: 'Expose a type-check command and run it in CI.',
    })
  }

  if (report.ci.workflowFiles.length === 0) {
    findings.push({
      id: 'ci.workflow.missing',
      title: 'No CI workflow detected',
      severity: warningSeverity,
      recommendation: 'Add CI that runs install, lint, type-check, tests, and build where applicable.',
    })
  }

  if (report.instructions.length === 0) {
    findings.push({
      id: 'instructions.missing',
      title: 'No agent instruction surface detected',
      severity: warningSeverity,
      recommendation: 'Add AGENTS.md or the relevant agent-specific instruction file with repo conventions and validation commands.',
    })
  }

  for (const surface of report.instructions.filter(surface => surface.localPrivate)) {
    findings.push({
      id: `instructions.local-private:${surface.path}`,
      title: 'Local/private agent instruction file is present',
      severity: warningSeverity,
      path: surface.path,
      recommendation: 'Keep local-private instruction files out of shared repository history unless this is intentional.',
    })
  }

  for (const file of files.filter(file => file.sizeBytes > config.largeFileWarningBytes && !file.generated)) {
    findings.push({
      id: `files.large:${file.path}`,
      title: 'Large checked-in file can create agent context friction',
      severity: file.sizeBytes > config.largeFileErrorBytes ? 'error' : warningSeverity,
      path: file.path,
      recommendation: 'Move large assets/data out of the main source tree or document why agents should ignore them.',
    })
  }

  for (const file of files.filter(file => file.minified && !config.allowMinifiedFiles)) {
    findings.push({
      id: `files.minified:${file.path}`,
      title: 'Minified file is checked into the repository',
      severity: warningSeverity,
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
  const config = loadConfig(absoluteRoot, options)
  const files = walkFiles(absoluteRoot, config)
  const filePaths = files.map(file => file.path)
  const packageManager = detectPackageManager(files)
  const scripts = packageManager ? getPackageScripts(absoluteRoot) : []
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
      packageManager,
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

  const findings = buildFindings(files, partialReport, config)

  return {
    ...partialReport,
    summary: {
      score: calculateScore(findings),
      totalFiles: files.length,
      totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
      sourceFiles: files.filter(file => file.source).length,
      testFiles: files.filter(file => file.test).length,
      documentationFiles: files.filter(file => file.documentation).length,
      largeFiles: files.filter(file => file.sizeBytes > config.largeFileWarningBytes).length,
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
  const status = runGit(root, ['status', '--porcelain'])
  if (status.length > 0) {
    throw new Error('scanGitTree cannot checkout refs with uncommitted changes; please commit or stash before running readiness diff')
  }

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

const isPackageManager = (value: unknown): value is NonNullable<LocalReadinessReport['commands']['packageManager']> => (
  value === 'npm' || value === 'pnpm' || value === 'yarn' || value === 'bun'
)

const validateLocalReadinessFileContract = (file: unknown, pathPrefix: string): string[] => {
  const errors: string[] = []
  if (!isObject(file)) {
    return [`${pathPrefix} must be an object`]
  }

  for (const key of ['path', 'extension']) {
    if (typeof file[key] !== 'string') errors.push(`${pathPrefix}.${key} must be a string`)
  }
  if (typeof file.sizeBytes !== 'number') errors.push(`${pathPrefix}.sizeBytes must be a number`)
  for (const key of ['binary', 'generated', 'minified', 'documentation', 'test', 'source']) {
    if (typeof file[key] !== 'boolean') errors.push(`${pathPrefix}.${key} must be a boolean`)
  }

  return errors
}

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
    if ('packageManager' in report.commands && report.commands.packageManager !== undefined && !isPackageManager(report.commands.packageManager)) {
      errors.push('commands.packageManager must be npm, pnpm, yarn, or bun when present')
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
  if (!Array.isArray(report.files)) {
    errors.push('files must be an array')
  } else {
    report.files.forEach((file, index) => {
      errors.push(...validateLocalReadinessFileContract(file, `files[${index}]`))
    })
  }

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
