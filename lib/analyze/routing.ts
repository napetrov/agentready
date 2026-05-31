import type { LlmProvider, AnalyzerTask } from './provider'

// Task→model routing (design §5.5, §7). A single run can use a cheap model for
// triage and a stronger one for, say, remediation. Routing is expressed as a map
// from AnalyzerTask to a provider; a `default` provider covers any unmapped
// task. When only one provider exists, routing is a no-op (every task resolves
// to it), so the common case stays simple.

export interface ProviderRouting {
  /** Fallback provider for any task without a specific entry. */
  default: LlmProvider
  /** Optional per-task overrides. */
  byTask?: Partial<Record<AnalyzerTask, LlmProvider>>
}

/** Resolves the provider for a task, falling back to the default. */
export const resolveProvider = (routing: ProviderRouting, task: AnalyzerTask): LlmProvider =>
  routing.byTask?.[task] ?? routing.default

/** Builds a routing table from a single provider (every task → that provider). */
export const singleProviderRouting = (provider: LlmProvider): ProviderRouting => ({ default: provider })

/** The distinct providers referenced by a routing table, for provenance. */
export const routingProviderIds = (routing: ProviderRouting): string[] => {
  const ids = new Set<string>([routing.default.id])
  for (const provider of Object.values(routing.byTask ?? {})) {
    if (provider) ids.add(provider.id)
  }
  return [...ids]
}
