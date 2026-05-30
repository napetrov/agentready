// Public API barrel for the optional LLM / agentic analytics layer.
//
// This package is opt-in and consumes the deterministic core's emitted evidence;
// the core never imports it. See docs/product/llm-analytics-design.md.
//
// PR A (this) defines the contracts and the provider port only. Provider
// adapters, the analyzer pipeline, slicing/caching, and scoring land in later
// PRs of the epic.

export type {
  AnalysisProvenance,
  AugmentedReport,
  AugmentedScore,
  AugmentedScoreAdjustment,
  InsightKind,
  LlmInsight,
} from './types'

export type {
  AnalyzerTask,
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmUsage,
} from './provider'

export {
  analysisProvenanceSchema,
  augmentedReportSchema,
  augmentedScoreAdjustmentSchema,
  augmentedScoreSchema,
  insightKindSchema,
  llmInsightSchema,
} from './schemas'

export {
  validateAugmentedReportContract,
  validateLlmInsightContract,
} from './contracts'
