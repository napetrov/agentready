// Public API barrel for the local readiness scanner.
//
// The implementation is organized into the layers described in
// docs/product/architecture.md:
//   core/       scan engine, config, scoring, contracts, git, shared types
//   detectors/  observe facts (file inventory, commands, docs, CI, instructions)
//   checks/     evaluate evidence into findings
//   reporters/  render console and markdown output
//
// This module re-exports the stable surface so existing imports keep working.

export type {
  AgentStage,
  ArchitectureBoundaryEvidence,
  ArchitectureBoundaryRole,
  AutonomyStageResult,
  AutonomyStatus,
  CapabilityKind,
  CapabilityRiskTier,
  CapabilitySurfaceEvidence,
  CiCommandKind,
  CiEvidence,
  CiWorkflow,
  CiWorkflowJob,
  CommandEcosystem,
  CommandEvidence,
  CommandReferenceEvidence,
  CommandReferenceKind,
  CompactLocalReadinessReport,
  CompactReadinessDiffReport,
  ContractValidationResult,
  DependencyHintEvidence,
  DesignStateCategory,
  DesignStateInsight,
  DesignStateSummary,
  DocumentCommandBlock,
  DocumentRole,
  DocumentSurfaceEvidence,
  DocumentationProximityHintEvidence,
  DiffOptions,
  EvidenceClaim,
  EvidenceConfidence,
  EvidenceItemBase,
  EvidenceSource,
  EvidenceSourceKind,
  GeneratedPressureEvidence,
  GovernanceEvidence,
  HookExecutionRiskEvidence,
  InstructionContradictionEvidence,
  InstructionContradictionKind,
  CoverageSurfaceKind,
  LocalReadinessConfig,
  LocalReadinessFile,
  LocalReadinessReport,
  LocalReadinessReportContract,
  ReadinessProfile,
  PackageManager,
  PortfolioReport,
  PortfolioRepoResult,
  PortfolioScanOptions,
  PortfolioSummary,
  ProtectedPathCoverageEvidence,
  RepositoryEvidence,
  RepositoryRootEvidence,
  RepositoryRootKind,
  RepositoryTopologyEvidence,
  RepositoryTopologyMetrics,
  ReadinessDiffReport,
  ReadinessDimensionScore,
  ReadinessFinding,
  ReadinessRuleCategory,
  ReadinessSeverity,
  SafetyCategory,
  SafetySignalEvidence,
  ScanOptions,
  TestProximityHintEvidence,
  VerificationSurfaceEvidence,
} from './core/types'

export {
  compactDiffReport,
  compactReport,
  diffLocalReadiness,
  listFindingIds,
  scanLocalReadiness,
} from './core/scan-engine'

export { buildPortfolioRepoResult, resolvePortfolioTargets, scanPortfolio } from './core/portfolio'

export { computeExperimentalFindingFields } from './core/experimental-finding-fields'

export {
  validateLocalReadinessReportContract,
  validatePortfolioReportContract,
  validateReadinessDiffReportContract,
} from './core/contracts'

export { defaultConfig, loadConfig } from './core/config'

export { scaffoldInit } from './core/scaffold'
export type { InitOptions, InitResult } from './core/scaffold'

export {
  evaluateDiffGate,
  evaluatePortfolioGate,
  evaluateScanGate,
  meetsThreshold,
  FAIL_ON_SEVERITIES,
} from './core/gate'
export type { FailOnSeverity, GateOptions, GateResult, PortfolioGateOptions } from './core/gate'

export { adjustFindings, applyPolicy, POLICY_NAMES } from './core/policy'
export type { PolicyName, PolicyPack, PolicyResult, PolicySeverityAdjustment } from './core/policy'

export {
  AGENT_STAGES,
  RULE_CATALOG,
  RULE_CATEGORIES,
  calculateAutonomyEnvelope,
  calculateDimensionScores,
  formatRuleDoc,
  getRuleDoc,
  listRuleIds,
  ruleKeyFor,
} from './checks/catalog'
export type { RuleDoc } from './checks/catalog'
export { DEFAULT_WEIGHTS, assertValidWeights, calculateScore } from './core/scoring'
export type { ScoreWeights } from './core/scoring'
export { calculateReadinessProfile } from './core/readiness-profile'

export { DEFAULT_POLICY, ENTERPRISE_POLICY, ML_SCIENTIFIC_POLICY, OSS_POLICY, POLICY_PACKS, resolvePolicyPack } from './checks/policy-packs'

export {
  COVERAGE_SURFACE_KIND_COUNT,
  agentStageSchema,
  autonomyStageResultListSchema,
  coverageReportSchema,
  localReadinessConfigSchema,
  localReadinessReportSchema,
  portfolioReportSchema,
  readinessDiffReportSchema,
  readinessDimensionScoreListSchema,
  readinessRuleCategorySchema,
} from './core/schemas'

export { formatDiffSummary, formatPolicySummary, formatScanSummary } from './reporters/console'
export { formatDiffMarkdown, formatScanMarkdown } from './reporters/markdown'
export { NOT_VERIFIED_EXTERNAL_CONTROLS } from './core/not-verified'
export { formatPortfolioMarkdown, formatPortfolioSummary } from './reporters/portfolio'
export { formatScanSarif } from './reporters/sarif'
export type { SarifLog, SarifOptions } from './reporters/sarif'
