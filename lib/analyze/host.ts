import type { AugmentedReport } from './types'
import type { LlmProvider } from './provider'
import type { Analyzer, HostDelegatingAnalyzer } from './analyzers/types'
import { defaultAnalyzers } from './analyze'
import { computeAugmentedScore } from './scoring'
import { sliceFiles, summarizeEvidence } from './slicing'
import type { LocalReadinessReport } from '../repo-readiness/core/types'

// Host integration (design §5.4, §6.2): helpers for environments that already
// have a model — an agent (Claude Code, Cursor) or any caller with its own
// credentials — so they reuse *their* tokens and AgentReady holds none.
//
// Two shapes:
//  1. Injected client — the host passes an LlmProvider into the library API; the
//     existing analyzeReport already supports this, re-exported here as the
//     canonical host entry point (`analyzeWithProvider`).
//  2. Host-delegated — AgentReady produces self-contained "analysis requests"
//     (prompt + already-sliced evidence) for the host's model to answer, then
//     folds the answers into an augmented report. The host does the inference;
//     no provider object crosses the boundary. This backs the MCP server.

export { analyzeReport as analyzeWithProvider } from './analyze'
export type { AnalyzeOptions } from './analyze'
export type { AugmentedReport, LlmProvider }

/**
 * A self-contained unit of work for a host's model: everything needed to
 * produce one analyzer's insights, with the evidence already sliced so the host
 * sends nothing extra. The host answers `system`+`input` under `outputSchema`
 * and returns the raw JSON via `ingestHostResponses`.
 */
export interface HostAnalysisRequest {
  analyzerId: string
  promptVersion: string
  system: string
  input: string
  outputSchema: Record<string, unknown>
  maxTokens: number
}

/** The host's answer to one HostAnalysisRequest. */
export interface HostAnalysisResponse {
  analyzerId: string
  /** The model's structured output (parsed JSON). */
  output: unknown
  /** The model identifier the host used, stamped onto resulting insights. */
  model: string
}

const isHostDelegating = (a: Analyzer): a is HostDelegatingAnalyzer =>
  typeof (a as HostDelegatingAnalyzer).buildRequest === 'function'

/**
 * Builds the host-delegated analysis requests applicable to a report. The host
 * runs each through its own model and feeds the answers to
 * `ingestHostResponses`. Returns an empty array when nothing applies.
 */
export const buildHostRequests = (
  root: string,
  report: LocalReadinessReport,
  analyzers: Analyzer[] = defaultAnalyzers,
): HostAnalysisRequest[] => {
  const requests: HostAnalysisRequest[] = []
  for (const analyzer of analyzers) {
    if (!isHostDelegating(analyzer) || !analyzer.applicable(report)) continue
    const built = analyzer.buildRequest({ root, report, sliceFiles, summarizeEvidence })
    if (built) requests.push({ analyzerId: analyzer.id, ...built })
  }
  return requests
}

/**
 * Folds host model answers into an augmented report. Each response is validated
 * by its analyzer's `buildInsights` (so malformed/hallucinated output is
 * dropped, not trusted), exactly as the provider pipeline would. The
 * deterministic report and score are never mutated.
 */
export const ingestHostResponses = (
  report: LocalReadinessReport,
  responses: HostAnalysisResponse[],
  options: { analyzers?: Analyzer[]; now?: Date; onWarn?: (message: string) => void } = {},
): AugmentedReport => {
  const analyzers = options.analyzers ?? defaultAnalyzers
  const warn = options.onWarn ?? ((message: string) => console.error(message))
  const byId = new Map(analyzers.filter(isHostDelegating).map(a => [a.id, a]))

  const insights = responses.flatMap(response => {
    const analyzer = byId.get(response.analyzerId)
    if (!analyzer) {
      warn(`AgentReady analyze: no host-delegating analyzer "${response.analyzerId}", ignoring its response`)
      return []
    }
    try {
      return analyzer.buildInsights(response.output, response.model, report)
    } catch (error) {
      // Fail-open, but surface it so host integrators can debug a bad response.
      warn(`AgentReady analyze: analyzer "${response.analyzerId}" failed to ingest a host response: ${error instanceof Error ? error.message : String(error)}`)
      return []
    }
  })

  // Derive providers from the insights that were actually applied, so the
  // metadata stays consistent with `enabled`/`insightsApplied` and never lists a
  // model whose response was dropped (unknown analyzer, malformed output).
  const providers = [...new Set(insights.map(i => i.model).filter(Boolean))]
  return {
    baseReport: report,
    generatedAt: (options.now ?? new Date()).toISOString(),
    insights,
    augmentedScore: computeAugmentedScore(report.summary.score, insights),
    analysis: {
      enabled: insights.length > 0,
      providers,
      insightsConsidered: responses.length,
      insightsApplied: insights.length,
    },
  }
}
