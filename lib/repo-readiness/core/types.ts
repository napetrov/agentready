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

/** The grouping every rule in the catalog is filed under; also the dimension-score axis. */
export type ReadinessRuleCategory = 'docs' | 'commands' | 'ci' | 'instructions' | 'files' | 'safety'

/**
 * A per-category rollup of the same severity-penalty model `calculateScore`
 * applies to the whole report, so a repo with e.g. unsafe scripts but great CI
 * doesn't look identical to one with the opposite profile under a single
 * number. Purely a view over `findings`; it never changes gating.
 */
export interface ReadinessDimensionScore {
  category: ReadinessRuleCategory
  score: number
  findingCount: number
  bySeverity: Record<ReadinessSeverity, number>
}

/**
 * A point in an AI coding agent's workflow a finding can affect. Powers the
 * autonomy envelope (`AutonomyStageResult`): the same repository can be
 * "ready" for an agent to understand and edit it while still "blocked" for
 * merging or deploying autonomously, which a single aggregate score cannot
 * communicate on its own.
 */
export type AgentStage = 'orient' | 'bootstrap' | 'navigate' | 'edit' | 'verify' | 'review' | 'merge' | 'deploy'

export type AutonomyStatus = 'ready' | 'not_yet_ready' | 'blocked'

/**
 * One stage's autonomy assessment: `blocked` when an error-severity finding
 * affects this stage, `not_yet_ready` when only warning-severity findings do,
 * `ready` otherwise (info-only or no affecting findings at all).
 */
export interface AutonomyStageResult {
  stage: AgentStage
  status: AutonomyStatus
  /** Ids of the findings driving a non-`ready` status; empty when `ready`. */
  findingIds: string[]
}

export type EvidenceConfidence = 'low' | 'medium' | 'high'

export type EvidenceSourceKind = 'file' | 'manifest' | 'workflow' | 'config' | 'inference'

export interface EvidenceSource {
  detector: string
  kind: EvidenceSourceKind
  path?: string
  note?: string
}

export interface EvidenceItemBase {
  id: string
  kind: string
  paths: string[]
  sources: EvidenceSource[]
}

export interface EvidenceClaim<TKind extends string = string, TValue extends string = string> {
  kind: TKind
  value: TValue
  confidence: EvidenceConfidence
  signals: string[]
  sources: EvidenceSource[]
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
  /** Makefile target names, when the repository has a Makefile. */
  makeTargets: string[]
  hasBuild: boolean
  hasTest: boolean
  hasLint: boolean
  hasTypeCheck: boolean
}

/**
 * A kind of command reference an instruction file or README can make that is
 * checkable against detected command evidence.
 */
export type CommandReferenceKind = 'npm-script' | 'make-target' | 'package-manager-mismatch' | 'shortcut-script'

/**
 * A command mentioned in a doc/instruction file that does not match the
 * repository's actual command surfaces — e.g. `npm run buld` when no `buld`
 * script exists, or `make test` when the Makefile has no `test` target. Text
 * heuristics inherently miss some real commands and can misfire on prose that
 * merely discusses a command rather than telling an agent to run it, so this
 * is intentionally scoped to unambiguous, high-signal patterns.
 */
export interface CommandReferenceEvidence {
  /** Repo-relative path of the doc/instruction file the reference was found in. */
  path: string
  /** The exact command reference matched, e.g. `npm run buld`. */
  reference: string
  kind: CommandReferenceKind
  /** Human-readable explanation of the mismatch. */
  detail: string
}

/** A kind of structurally-detectable contradiction between agent instruction files. */
export type InstructionContradictionKind = 'package-manager'

/**
 * A contradiction between two root-scope, always-active instruction files —
 * ones an agent loads into context together, so a conflict between them is a
 * real contradiction it will hit, not two separately-scoped docs that never
 * coexist. Deterministic text-pattern matching only (reusing the same
 * unambiguous command-mention patterns as `CommandReferenceEvidence`); this
 * intentionally does not attempt semantic/NLP contradiction detection — that
 * lives in the optional LLM analyze layer instead.
 */
export interface InstructionContradictionEvidence {
  kind: InstructionContradictionKind
  /** The two instruction file paths that disagree. */
  paths: [string, string]
  /** Human-readable explanation of the contradiction. */
  detail: string
}

/**
 * CODEOWNERS coverage for one structurally high-risk path (see
 * `DEFAULT_PROTECTED_PATHS` in `detectors/governance.ts`), independent of
 * recent commit activity — a rarely touched but high-risk path (e.g. a
 * deploy script) may never accumulate the commit count
 * `uncoveredActiveDirectories` requires.
 */
export interface ProtectedPathCoverageEvidence {
  /** The protected-path glob that matched at least one file the scan tracks. */
  pattern: string
  /** Whether any matched file has a CODEOWNERS owner. */
  covered: boolean
  /** Distinct owner tokens found across matched, covered files (sorted), when `covered`. */
  owners: string[]
  /**
   * `covered` by exactly one non-team owner token, with no documented backup.
   * Cannot verify actual team membership locally — a team owner (`@org/team`)
   * is assumed to have more than one member, a known limitation.
   */
  singleOwnerRisk: boolean
}

/**
 * Review-routing surfaces: whether the repo tells a reviewer (human or agent)
 * who owns a change and what evidence a PR description should contain. The
 * two path fields are presence checks (does the file exist, at a path GitHub
 * recognizes). `uncoveredActiveDirectories`/`protectedPathCoverage` are
 * derived from CODEOWNERS' actual pattern semantics rather than presence
 * alone — see their own doc comments.
 */
export interface GovernanceEvidence {
  /** Path to CODEOWNERS, if found at a GitHub-recognized location (root, .github/, or docs/). */
  codeownersPath?: string
  /** Path to a pull-request template, if found at a GitHub-recognized location (root, .github/, or docs/; single file or .github/PULL_REQUEST_TEMPLATE/). */
  pullRequestTemplatePath?: string
  /**
   * Top-level directories with sustained recent commit activity (from local
   * git history only, bounded to the most recent commits — no network calls)
   * that no CODEOWNERS pattern appears to cover. A best-effort approximation
   * of CODEOWNERS' gitignore-style pattern matching against top-level
   * directories, not a full implementation of CODEOWNERS' path-rule
   * semantics. Present only when CODEOWNERS exists, the scan target is a git
   * repository, and at least one uncovered directory was found.
   */
  uncoveredActiveDirectories?: string[]
  /**
   * Coverage of a fixed set of structurally high-risk paths (see
   * `DEFAULT_PROTECTED_PATHS`), regardless of recent activity. Present only
   * when CODEOWNERS exists and at least one protected-path glob matched a
   * file the scan tracks.
   */
  protectedPathCoverage?: ProtectedPathCoverageEvidence[]
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

/**
 * Blast-radius classification for a capability surface: `high` can run
 * arbitrary commands or grant an agent new tools with unknown scope (a hook
 * script, a configured hooks block, an MCP server, a plugin manifest —
 * plugins can themselves bundle MCP servers and hooks, and static config
 * cannot reveal an MCP server's actual tool set); `medium` is config that
 * *could* define a high-risk surface but does not appear to (e.g. Claude
 * Code settings with no `hooks` key); `low` is read-only, informational, or
 * editor/formatting config with no execution surface (an LSP config, a
 * skill's instructions).
 */
export type CapabilityRiskTier = 'low' | 'medium' | 'high'

export interface CapabilitySurfaceEvidence {
  kind: CapabilityKind
  path: string
  /** The tool that owns the surface (e.g. claude-code, cursor, vscode). */
  tool: string
  notes: string[]
  riskTier: CapabilityRiskTier
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

/**
 * A composite risk `safety.install-hook`/`safety.capability.high-risk` each
 * report only half of: an agent-tool hook event that fires automatically (no
 * explicit user action, e.g. Claude Code's `SessionStart`) whose command
 * invokes a package-manager install/lifecycle command. Checking out an
 * untrusted branch and then starting a session on it can run that branch's
 * own install-time lifecycle scripts before anyone reviews them.
 */
export interface HookExecutionRiskEvidence {
  /** Repo-relative path of the settings file the hook is configured in. */
  path: string
  /** The hook event name (e.g. `SessionStart`). */
  event: string
  /** The hook's command, which matched an install/lifecycle command pattern. */
  command: string
}

export type DocumentRole =
  | 'entrypoint'
  | 'development'
  | 'architecture'
  | 'decision-record'
  | 'contribution'
  | 'environment'
  | 'agent-instruction'
  | 'operation'
  | 'api'

export interface DocumentCommandBlock {
  index: number
  language?: string
  text: string
  truncated: boolean
}

export interface DocumentSurfaceEvidence extends EvidenceItemBase {
  kind: 'document-surface'
  path: string
  roleClaims: EvidenceClaim<'document-role', DocumentRole>[]
  title?: string
  headings: string[]
  linkedPaths: string[]
  commandBlocks: DocumentCommandBlock[]
}

export type RepositoryRootKind = 'app' | 'library' | 'package' | 'service' | 'tool' | 'docs' | 'test' | 'unknown'

export interface RepositoryRootEvidence extends EvidenceItemBase {
  kind: 'repository-root'
  rootKind: RepositoryRootKind
  path: string
  languages: string[]
  packageManager?: PackageManager
  manifests: string[]
  sourceFiles: number
  testFiles: number
  documentationFiles: number
  generatedFiles: number
  confidence: EvidenceConfidence
}

export type ArchitectureBoundaryRole =
  | 'entrypoint'
  | 'public-api'
  | 'internal-module'
  | 'adapter'
  | 'domain'
  | 'infrastructure'
  | 'test-support'
  | 'generated'
  | 'unknown'

export interface ArchitectureBoundaryEvidence extends EvidenceItemBase {
  kind: 'architecture-boundary'
  path: string
  role: ArchitectureBoundaryRole
  signals: string[]
  confidence: EvidenceConfidence
}

export interface VerificationSurfaceEvidence extends EvidenceItemBase {
  kind: 'verification-surface'
  rootIds: string[]
  commandKind: CiCommandKind
  commandText?: string
  workflowJobId?: string
  confidence: EvidenceConfidence
}

export interface DependencyHintEvidence extends EvidenceItemBase {
  kind: 'dependency-hint'
  fromRootId: string
  toRootId?: string
  relationship: 'workspace' | 'manifest' | 'import-path' | 'unknown'
  confidence: EvidenceConfidence
}

export interface TestProximityHintEvidence extends EvidenceItemBase {
  kind: 'test-proximity-hint'
  rootId: string
  nearbyTestPaths: string[]
  confidence: EvidenceConfidence
}

export interface DocumentationProximityHintEvidence extends EvidenceItemBase {
  kind: 'documentation-proximity-hint'
  rootId: string
  documentSurfaceIds: string[]
  roleClaims: DocumentRole[]
  confidence: EvidenceConfidence
}

export interface GeneratedPressureEvidence extends EvidenceItemBase {
  kind: 'generated-pressure'
  rootId: string
  generatedFileRatio: number
  generatedBytesRatio: number
  confidence: EvidenceConfidence
}

export interface RepositoryTopologyMetrics {
  rootCount: number
  languageCount: number
  sourceToNearbyTestRatio?: number
  docsToSourceProximityRatio?: number
  generatedFileRatio: number
  largestRootShare: number
  publicApiSurfaceCount: number
  rootsWithoutLocalTests: number
  rootsWithoutLocalDocs: number
  verificationMappedRootCount: number
}

export interface RepositoryTopologyEvidence {
  dependencyHints: DependencyHintEvidence[]
  testProximityHints: TestProximityHintEvidence[]
  documentationProximityHints: DocumentationProximityHintEvidence[]
  generatedPressure: GeneratedPressureEvidence[]
  metrics: RepositoryTopologyMetrics
}

export interface RepositoryEvidence {
  roots: RepositoryRootEvidence[]
  boundaries: ArchitectureBoundaryEvidence[]
  documentSurfaces: DocumentSurfaceEvidence[]
  verificationSurfaces: VerificationSurfaceEvidence[]
  topology: RepositoryTopologyEvidence
}

export type DesignStateCategory =
  | 'documentation-evidence'
  | 'architecture-boundary'
  | 'verification-locality'
  | 'context-selection'
  | 'generated-content'
  | 'safety'
  | 'agent-instruction'
  | 'ci-alignment'

export interface DesignStateInsight {
  id: string
  category: DesignStateCategory
  title: string
  severity: ReadinessSeverity
  gateable: boolean
  summary: string
  evidenceIds: string[]
  findingIds?: string[]
  paths: string[]
  confidence: EvidenceConfidence
  recommendation?: string
}

export interface DesignStateSummary {
  strengths: DesignStateInsight[]
  risks: DesignStateInsight[]
  ambiguities: DesignStateInsight[]
}

export interface LocalReadinessReportContract {
  schemaVersion: 'local-readiness/v2'
  experimentalFields: LocalReadinessExperimentalField[]
}

export type LocalReadinessExperimentalField =
  | 'repositoryEvidence'
  | 'designState'
  | 'dimensions'
  | 'instructionContradictions'
  | 'hookExecutionRisks'
  | 'autonomyEnvelope'

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
  commandReferences: CommandReferenceEvidence[]
  instructionContradictions: InstructionContradictionEvidence[]
  governance: GovernanceEvidence
  ci: CiEvidence
  instructions: InstructionSurfaceEvidence[]
  capabilities: CapabilitySurfaceEvidence[]
  safetySignals: SafetySignalEvidence[]
  hookExecutionRisks: HookExecutionRiskEvidence[]
  repositoryEvidence: RepositoryEvidence
  designState: DesignStateSummary
  /** Per-category rollups of `summary.score`'s severity-penalty model. See `ReadinessDimensionScore`. */
  dimensions: ReadinessDimensionScore[]
  /** Per-agent-workflow-stage readiness, derived from findings and each rule's `RuleDoc.affectedStages`. See `AutonomyStageResult`. */
  autonomyEnvelope: AutonomyStageResult[]
  reportContract: LocalReadinessReportContract
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

/**
 * One repository's outcome in a portfolio (multi-repo) scan. `ok: false` means
 * the scan itself failed (e.g. the path is not a valid target) — every other
 * field is then omitted rather than defaulted, so a scan failure can never be
 * confused with a clean 100-score repo.
 */
export type PortfolioRepoResult =
  | {
      path: string
      ok: true
      score: number
      findingCount: number
      bySeverity: Record<ReadinessSeverity, number>
      /** Warning/error findings, worst-severity-first, capped for a bounded summary. */
      topFindings: ReadinessFinding[]
    }
  | {
      path: string
      ok: false
      error: string
    }

export interface PortfolioSummary {
  repoCount: number
  scannedCount: number
  scanErrorCount: number
  /** `null` when no repo scanned successfully (nothing to average). */
  averageScore: number | null
  minScore: number | null
  maxScore: number | null
  totalFindings: number
  bySeverity: Record<ReadinessSeverity, number>
}

export interface PortfolioReport {
  generatedAt: string
  /** Worst-scoring repos first; scan failures (`ok: false`) sort before every scored repo. */
  repos: PortfolioRepoResult[]
  summary: PortfolioSummary
}

export interface PortfolioScanOptions {
  now?: Date
  configPath?: string
  config?: Partial<LocalReadinessConfig>
  /** Warning/error findings kept per repo in `topFindings` (default 5). */
  topFindingsPerRepo?: number
}
