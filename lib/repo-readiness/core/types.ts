import type { InstructionSurfaceEvidence } from '../detectors/instruction-surface'

export type ReadinessSeverity = 'info' | 'warning' | 'error'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

/**
 * A command ecosystem the repository exposes (e.g. Node scripts, a Makefile, a
 * Cargo manifest). The command-surface detector aggregates verification
 * capabilities across every ecosystem it recognizes.
 */
export type CommandEcosystem = 'node' | 'make' | 'go' | 'rust' | 'python'

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

export interface CommandEvidence {
  /** Node package manager, when the repository is a Node project. */
  packageManager?: PackageManager
  /** Command ecosystems recognized in the repository. */
  ecosystems: CommandEcosystem[]
  /** Node package scripts, kept for backward compatibility and detail. */
  scripts: string[]
  hasBuild: boolean
  hasTest: boolean
  hasLint: boolean
  hasTypeCheck: boolean
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
  commands: CommandEvidence
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

export type CompactLocalReadinessReport = Omit<LocalReadinessReport, 'files'> & { files?: never }
export type CompactReadinessDiffReport = Omit<ReadinessDiffReport, 'baseReport' | 'headReport'> & {
  baseReport: CompactLocalReadinessReport
  headReport: CompactLocalReadinessReport
}
