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
  CapabilityKind,
  CapabilitySurfaceEvidence,
  CommandEcosystem,
  CommandEvidence,
  CompactLocalReadinessReport,
  CompactReadinessDiffReport,
  ContractValidationResult,
  DiffOptions,
  LocalReadinessConfig,
  LocalReadinessFile,
  LocalReadinessReport,
  PackageManager,
  ReadinessDiffReport,
  ReadinessFinding,
  ReadinessSeverity,
  SafetyCategory,
  SafetySignalEvidence,
  ScanOptions,
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

export {
  evaluateDiffGate,
  evaluateScanGate,
  meetsThreshold,
  FAIL_ON_SEVERITIES,
} from './core/gate'
export type { FailOnSeverity, GateOptions, GateResult } from './core/gate'

export {
  RULE_CATALOG,
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
} from './core/schemas'

export { formatDiffSummary, formatScanSummary } from './reporters/console'
export { formatDiffMarkdown, formatScanMarkdown } from './reporters/markdown'
export { formatScanSarif } from './reporters/sarif'
export type { SarifLog, SarifOptions } from './reporters/sarif'
