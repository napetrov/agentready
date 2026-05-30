import type { LocalReadinessReport } from '../../repo-readiness/core/types'
import type { LlmInsight } from '../types'
import type { Runner } from '../runner'
import type { SliceOptions, SlicedInput } from '../slicing'

// An analyzer is one Tier-2 judgment unit. It decides whether it has anything to
// look at (given the deterministic evidence), builds a bounded request, runs it
// through the fail-open runner, and validates the model output into insights.
// Analyzers never throw: they return [] when they have nothing to say or the
// model call did not produce usable output.

export interface AnalyzerContext {
  /** Repository root, for reading sliced files. */
  root: string
  /** The deterministic scan report (already produced; never mutated). */
  report: LocalReadinessReport
  /** The fail-open runner (cache + budget + provider). */
  runner: Runner
}

export interface Analyzer {
  /** Stable analyzer id, used in logs and insight ids. */
  readonly id: string
  /** Whether this analyzer has anything to analyze for the given evidence. */
  applicable(report: LocalReadinessReport): boolean
  /** Produce insights. Must be fail-open (never throws; returns [] on failure). */
  run(context: AnalyzerContext): Promise<LlmInsight[]>
}

// Slicing helpers passed to host-delegating analyzers so they build the same
// bounded input the provider pipeline would, without importing slicing directly.
export interface SliceHelpers {
  root: string
  report: LocalReadinessReport
  sliceFiles: (root: string, relPaths: string[], options?: SliceOptions) => SlicedInput
  summarizeEvidence: (report: LocalReadinessReport) => string
}

/** The request shape an analyzer emits for either the runner or a host model. */
export interface AnalyzerRequest {
  promptVersion: string
  system: string
  input: string
  outputSchema: Record<string, unknown>
  maxTokens: number
}

/**
 * An analyzer that can also delegate to a host's model. It exposes how it builds
 * its request and how it turns raw model output into insights, so the same logic
 * powers both the provider pipeline (`run`) and the host-delegated path
 * (`buildRequest` + `buildInsights`). No inference happens in these methods.
 */
export interface HostDelegatingAnalyzer extends Analyzer {
  /** Build the request, or undefined when there is nothing to send. */
  buildRequest(helpers: SliceHelpers): AnalyzerRequest | undefined
  /**
   * Validate+convert raw model output into insights, stamped with `model`. Takes
   * the report so it can reject outputs referencing paths the repo does not have
   * (hallucination guard) without relying on cross-call state.
   */
  buildInsights(output: unknown, model: string, report: LocalReadinessReport): LlmInsight[]
}
