// Public API barrel for the optional LLM / agentic analytics layer.
//
// This package is opt-in and consumes the deterministic core's emitted evidence;
// the core never imports it. See docs/product/llm-analytics-design.md.
//
// Exports: the data contracts (insight/augmented-report schemas + validators),
// the provider port and adapters (OpenAI-compatible, GitHub Models, replay) with
// env auto-detection, the efficiency spine (slicing, cache, budgets, fail-open
// runner), the analyzers + task→model routing + augmented scoring + reporters,
// and the host-integration helpers (injected client + host-delegated flow).

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

export { createOpenAiCompatProvider } from './providers/openai-compat'
export type { FetchLike, OpenAiCompatOptions } from './providers/openai-compat'

export { createGitHubModelsProvider } from './providers/github-models'
export type { GitHubModelsOptions } from './providers/github-models'

export { detectProvider } from './detect'
export type { DetectedProvider, DetectionEnv } from './detect'

export { createReplayProvider, createRecordingProvider, replayKey } from './providers/replay'
export type { ReplayFixture } from './providers/replay'

// Efficiency spine: slicing, caching, budgets, and the fail-open runner.
export { sliceFiles, summarizeEvidence, fileExists } from './slicing'
export type { SliceOptions, SlicedInput } from './slicing'

export { cacheKey, nullCache, createMemoryCache, createFileCache } from './cache'
export type { AnalyzeCache, CacheKeyParts } from './cache'

export { createBudgetTracker } from './budget'
export type { BudgetTracker, BudgetOptions } from './budget'

export { createRunner } from './runner'
export type { Runner, RunnerOptions, RunOutcome } from './runner'

// Analyzers, scoring, orchestration, and reporting.
export type { Analyzer, AnalyzerContext } from './analyzers/types'
export { instructionQualityAnalyzer } from './analyzers/instruction-quality'
export { contradictionAnalyzer } from './analyzers/contradiction'
export { falsePositiveAnalyzer } from './analyzers/false-positive'
export { remediationAnalyzer } from './analyzers/remediation'

export { resolveProvider, singleProviderRouting, routingProviderIds } from './routing'
export type { ProviderRouting } from './routing'

export { computeAugmentedScore } from './scoring'

export { analyzeReport, defaultAnalyzers } from './analyze'
export type { AnalyzeOptions } from './analyze'

export { formatAugmentedSummary, formatAugmentedMarkdown } from './reporter'

// Evaluation harness: gold-set scoring, precision/recall/F1, calibration.
export { scoreCase, aggregate, metricsFor, calibration } from './evaluation'
export type { GoldLabel, GoldCase, Confusion, EvaluationMetrics, CalibrationBucket } from './evaluation'

// Host integration: injected-client entry + host-delegated request/ingest.
export { analyzeWithProvider, buildHostRequests, ingestHostResponses } from './host'
export type { HostAnalysisRequest, HostAnalysisResponse } from './host'
export type { HostDelegatingAnalyzer, AnalyzerRequest, SliceHelpers } from './analyzers/types'
