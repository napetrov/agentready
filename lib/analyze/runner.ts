import type { LlmProvider, LlmRequest } from './provider'
import { type AnalyzeCache, cacheKey, nullCache } from './cache'
import { type BudgetTracker, createBudgetTracker } from './budget'

// The fail-open execution spine that analyzers run their model calls through.
// It composes the three efficiency concerns — cache, budget, fail-open — around
// a provider so individual analyzers stay simple. Any error, timeout, or budget
// exhaustion yields `undefined`; it never throws, so one bad call cannot fail a
// run or the deterministic report it augments.

export interface RunnerOptions {
  provider: LlmProvider
  /** Result cache; defaults to no caching. */
  cache?: AnalyzeCache
  /** Token budget tracker; defaults to standard limits. */
  budget?: BudgetTracker
  /** Schema version folded into the cache key (bump to invalidate). */
  schemaVersion: string
  /** Optional sink for diagnostics; defaults to console.error. */
  onWarn?: (message: string) => void
}

export interface RunOutcome {
  /** Raw, still-unvalidated structured output, or undefined on any failure. */
  output?: unknown
  /** The model stamp returned by the provider, when a call was made. */
  model?: string
  /** Whether this result came from the cache. */
  cached: boolean
  /** Whether the call was skipped because the run budget was exhausted. */
  skipped: boolean
}

export interface Runner {
  /**
   * Runs a request through cache → budget → provider, fail-open. `promptVersion`
   * keys the cache alongside the model/schema/input. Returns the raw output for
   * the analyzer to validate against its own Zod schema.
   */
  run(request: LlmRequest, promptVersion: string): Promise<RunOutcome>
  readonly providerId: string
}

export const createRunner = (options: RunnerOptions): Runner => {
  const cache = options.cache ?? nullCache
  const budget = options.budget ?? createBudgetTracker()
  const warn = options.onWarn ?? ((message: string) => console.error(message))
  const { provider, schemaVersion } = options

  return {
    providerId: provider.id,
    async run(request, promptVersion): Promise<RunOutcome> {
      const key = cacheKey({
        // Fold in the concrete model so switching models is a clean miss, not a
        // false hit. Falls back to the adapter id when the model is unknown.
        model: `${provider.id}:${provider.model ?? 'unknown'}:${request.task}`,
        promptVersion,
        schemaVersion,
        input: `${request.system}\n${request.input}\n${JSON.stringify(request.outputSchema)}`,
      })

      const hit = cache.get(key)
      if (hit !== undefined) {
        return { output: hit, cached: true, skipped: false }
      }

      const want = request.maxTokens
      if (!budget.canAfford(want)) {
        warn(`AgentReady analyze: skipping ${request.task} (token budget exhausted)`)
        return { cached: false, skipped: true }
      }

      try {
        const response = await provider.complete(request)
        budget.record(response.usage?.outputTokens ?? want)
        cache.set(key, response.output)
        return { output: response.output, model: response.model, cached: false, skipped: false }
      } catch (error) {
        // Fail-open: an analyzer failure drops that insight, never the run.
        warn(`AgentReady analyze: ${request.task} call failed, continuing without it: ${error instanceof Error ? error.message : String(error)}`)
        return { cached: false, skipped: false }
      }
    },
  }
}
