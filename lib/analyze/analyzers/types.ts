import type { LocalReadinessReport } from '../../repo-readiness/core/types'
import type { LlmInsight } from '../types'
import type { Runner } from '../runner'

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
