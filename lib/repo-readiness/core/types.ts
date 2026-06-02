import type { InstructionSurfaceEvidence } from '../detectors/instruction-surface'

export type ReadinessSeverity = 'info' | 'warning' | 'error'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

/**
 * A command ecosystem the repository exposes (e.g. Node scripts, a Makefile, a
 * Cargo manifest). The command-surface detector aggregates verification
 * capabilities across every ecosystem it recognizes.
 */
export type CommandEcosystem =
  | 'node'
  | 'make'
  | 'cmake'
  | 'bazel'
  | 'go'
  | 'rust'
  | 'python'
  | 'gradle'
  | 'maven'
  | 'dotnet'
  | 'autotools'

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

/** A class of verification command an agent can run to validate its work. */
export type CiCommandKind = 'install' | 'lint' | 'typecheck' | 'test' | 'build'

export interface CiWorkflowJob {
  /** The job key from the workflow's `jobs:` map. */
  id: string
  /** Command kinds detected across the job's steps, sorted and unique. */
  commandKinds: CiCommandKind[]
  /**
   * Command kinds this job runs through a *concrete* step we decomposed (a
   * recognized `run:` command or a concrete action such as
   * `golangci-lint-action`), as opposed to kinds it covers only through an
   * opaque orchestrator (`pre-commit/action`, `tox`, `make ci`). Sorted and
   * unique. Used to tell a concrete verification job apart from an
   * orchestrator-only one: a kind is recorded here when *some* step ran it
   * concretely, even if another step in the same job is an opaque orchestrator
   * that also (uncertainly) covers it.
   */
  concreteKinds: CiCommandKind[]
}

export interface CiWorkflow {
  /** Repo-relative path to the workflow file. */
  file: string
  /** The workflow's `name:`, when present. */
  name?: string
  jobs: CiWorkflowJob[]
}

export interface CiEvidence {
  /**
   * Workflow files under `.github/workflows/`. Kept for backward compatibility
   * with consumers that only need the file list.
   */
  workflowFiles: string[]
  /** Parsed workflows with per-job detected command kinds. */
  workflows: CiWorkflow[]
  /** Whether any workflow step installs dependencies. */
  hasInstall: boolean
  /** Whether any workflow step runs a lint command. */
  hasLint: boolean
  /** Whether any workflow step runs a type-check command. */
  hasTypeCheck: boolean
  /** Whether any workflow step runs tests. */
  hasTest: boolean
  /** Whether any workflow step runs a build. */
  hasBuild: boolean
  /**
   * Command kinds whose CI coverage is uncertain because a workflow dispatches
   * them through a task runner / orchestrator we cannot decompose. General
   * runners (tox, nox, make, `uv/poetry run`, just, turbo, …) cover every kind;
   * `pre-commit` covers only lint/type-check. The "command exists but CI never
   * runs it" checks stay silent for exactly these kinds to avoid false positives.
   */
  orchestratorKinds: CiCommandKind[]
}

/**
 * A kind of agent capability surface: a Model Context Protocol config, a skill,
 * a hook/settings file, a plugin manifest, or code-intelligence/LSP config.
 */
export type CapabilityKind = 'mcp' | 'skill' | 'hook' | 'plugin' | 'lsp'

export interface CapabilitySurfaceEvidence {
  kind: CapabilityKind
  path: string
  /** The tool that owns the surface (e.g. claude-code, cursor, vscode). */
  tool: string
  notes: string[]
}

/**
 * A safety-relevant signal found in package scripts: an install-time lifecycle
 * hook, a destructive command, a network-download-piped-to-shell command, or a
 * deploy/publish path.
 */
export type SafetyCategory = 'install-hook' | 'destructive' | 'network-exec' | 'deploy'

export interface SafetySignalEvidence {
  category: SafetyCategory
  /** Where the signal was found, e.g. `package.json#scripts.postinstall`. */
  source: string
  /** The script name the command is bound to. */
  script: string
  command: string
  notes: string[]
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
  ci: CiEvidence
  instructions: InstructionSurfaceEvidence[]
  capabilities: CapabilitySurfaceEvidence[]
  safetySignals: SafetySignalEvidence[]
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
  /**
   * Whether to honour the repository's `.gitignore` files when building the file
   * inventory (default `true`). The `diff` flow sets this to `false` because it
   * scans git worktrees that contain only committed (tracked) files — git does
   * not ignore tracked files, so applying `.gitignore` there would wrongly drop
   * checked-in paths and their large/minified findings.
   */
  respectGitignore?: boolean
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
