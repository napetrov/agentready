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
  ArchitectureBoundaryEvidence,
  ArchitectureBoundaryRole,
  CapabilityKind,
  CapabilitySurfaceEvidence,
  CiCommandKind,
  CiEvidence,
  CiWorkflow,
  CiWorkflowJob,
  CommandEcosystem,
  CommandEvidence,
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
  LocalReadinessConfig,
  LocalReadinessFile,
  LocalReadinessReport,
  LocalReadinessReportContract,
  PackageManager,
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

export {
  validateLocalReadinessReportContract,
  validateReadinessDiffReportContract,
} from './core/contracts'

export { defaultConfig, loadConfig } from './core/config'

export { scaffoldInit } from './core/scaffold'
export type { InitOptions, InitResult } from './core/scaffold'

export {
  evaluateDiffGate,
  evaluateScanGate,
  meetsThreshold,
  FAIL_ON_SEVERITIES,
} from './core/gate'
export type { FailOnSeverity, GateOptions, GateResult } from './core/gate'

export {
  RULE_CATALOG,
  RULE_CATEGORIES,
  calculateDimensionScores,
  formatRuleDoc,
  getRuleDoc,
  listRuleIds,
  ruleKeyFor,
} from './checks/catalog'
export type { RuleDoc } from './checks/catalog'

export {
  localReadinessConfigSchema,
  localReadinessReportSchema,
  readinessDiffReportSchema,
  readinessDimensionScoreListSchema,
  readinessRuleCategorySchema,
} from './core/schemas'

export { formatDiffSummary, formatScanSummary } from './reporters/console'
export { formatDiffMarkdown, formatScanMarkdown } from './reporters/markdown'
export { formatScanSarif } from './reporters/sarif'
export type { SarifLog, SarifOptions } from './reporters/sarif'
