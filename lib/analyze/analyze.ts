import type { LocalReadinessReport } from '../repo-readiness/core/types'
import type { AugmentedReport, LlmInsight } from './types'
import type { LlmProvider } from './provider'
import type { Analyzer } from './analyzers/types'
import { instructionQualityAnalyzer } from './analyzers/instruction-quality'
import { type AnalyzeCache, nullCache } from './cache'
import { type BudgetOptions, createBudgetTracker } from './budget'
import { createRunner } from './runner'
import { computeAugmentedScore } from './scoring'

// The orchestrator: given a deterministic report and a provider, run the
// applicable analyzers through the fail-open spine and fold their insights into
// an augmented report. Fail-open throughout — with no provider, or if every
// analyzer yields nothing, it returns a deterministic-only augmented report
// (the base score unchanged, no insights). The deterministic report is never
// mutated.

/** The default analyzer registry. Grows in later PRs (contradiction, triage, ...). */
export const defaultAnalyzers: Analyzer[] = [instructionQualityAnalyzer]

export interface AnalyzeOptions {
  /** Provider to use; when omitted, the run is deterministic-only. */
  provider?: LlmProvider
  /** Analyzers to run; defaults to `defaultAnalyzers`. */
  analyzers?: Analyzer[]
  /** Result cache; defaults to no caching. */
  cache?: AnalyzeCache
  /** Token budget; defaults to standard limits. */
  budget?: BudgetOptions
  /** Schema version folded into the cache key. */
  schemaVersion?: string
  /** Clock injection for deterministic timestamps in tests. */
  now?: Date
  /** Diagnostics sink; defaults to console.error. */
  onWarn?: (message: string) => void
}

const DEFAULT_SCHEMA_VERSION = 'v1'

/** Builds the deterministic-only augmented report (no provider / nothing produced). */
const deterministicOnly = (report: LocalReadinessReport, generatedAt: string, providers: string[], considered: number): AugmentedReport => ({
  baseReport: report,
  generatedAt,
  insights: [],
  augmentedScore: computeAugmentedScore(report.summary.score, []),
  analysis: { enabled: false, providers, insightsConsidered: considered, insightsApplied: 0 },
})

/**
 * Runs the analytics layer over an already-produced deterministic report.
 * Returns an `AugmentedReport`. Never throws and never mutates `report`.
 */
export const analyzeReport = async (
  root: string,
  report: LocalReadinessReport,
  options: AnalyzeOptions = {},
): Promise<AugmentedReport> => {
  const generatedAt = (options.now ?? new Date()).toISOString()
  const analyzers = (options.analyzers ?? defaultAnalyzers).filter(analyzer => analyzer.applicable(report))

  if (!options.provider || analyzers.length === 0) {
    return deterministicOnly(report, generatedAt, options.provider ? [options.provider.id] : [], 0)
  }

  const runner = createRunner({
    provider: options.provider,
    cache: options.cache ?? nullCache,
    budget: createBudgetTracker(options.budget),
    schemaVersion: options.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    onWarn: options.onWarn,
  })

  const insights: LlmInsight[] = []
  let considered = 0
  for (const analyzer of analyzers) {
    considered += 1
    try {
      insights.push(...(await analyzer.run({ root, report, runner })))
    } catch (error) {
      // Analyzers are expected to be fail-open; this is a final backstop.
      const warn = options.onWarn ?? ((message: string) => console.error(message))
      warn(`AgentReady analyze: analyzer "${analyzer.id}" threw, skipping: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    baseReport: report,
    generatedAt,
    insights,
    augmentedScore: computeAugmentedScore(report.summary.score, insights),
    analysis: {
      enabled: insights.length > 0,
      providers: [options.provider.id],
      insightsConsidered: considered,
      insightsApplied: insights.length,
    },
  }
}
