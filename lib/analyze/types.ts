import type { LocalReadinessReport } from '../repo-readiness/core/types'

// Type contracts for the optional LLM / agentic analytics layer. See
// docs/product/llm-analytics-design.md. These describe the *data* the layer
// produces (insights, augmented report) and the provider *port* it calls.
//
// Boundary rule: this module may import the deterministic core (it consumes the
// core's emitted evidence), but the core must never import this module. The
// layer is opt-in and never runs on the core scan path.

/**
 * The category of judgment an insight represents. Mirrors the Tier-2 work in the
 * design doc: triaging deterministic findings, judging instruction quality,
 * reconciling contradictions, and proposing remediation.
 */
export type InsightKind =
  | 'false-positive'
  | 'quality'
  | 'contradiction'
  | 'remediation'
  | 'note'

/**
 * A single LLM-produced judgment over the deterministic evidence. Structured,
 * attributable (optionally keyed to a deterministic finding id), and stamped
 * with the producing model + prompt version so output is auditable and diffable.
 */
export interface LlmInsight {
  /** Stable insight id, e.g. `analysis.instruction-quality:AGENTS.md`. */
  id: string
  /** What kind of judgment this is. */
  kind: InsightKind
  /** The deterministic finding this relates to, when applicable. */
  findingId?: string
  /** The repo path the insight is about, when applicable. */
  target?: string
  /** Short human-readable conclusion. */
  verdict: string
  /** Model confidence in the verdict, 0–1. */
  confidence: number
  /** Why the model reached this verdict. */
  rationale: string
  /** Optional suggested remediation. */
  remediation?: string
  /**
   * Optional signed adjustment this insight contributes to the augmented score
   * (negative penalizes, positive credits). Folded in weighted by confidence.
   */
  scoreImpact?: number
  /** The producing model, stamped as `name@version`. */
  model: string
  /** The prompt template version that produced this insight. */
  promptVersion: string
}

/** A single itemized contribution to the augmented score. */
export interface AugmentedScoreAdjustment {
  /** The insight that produced this adjustment. */
  insightId: string
  /** The signed delta applied to the deterministic score. */
  delta: number
}

/**
 * The augmented score. The deterministic score is never mutated; this records
 * it alongside the LLM-adjusted score and an itemized list of every adjustment
 * so the difference is fully auditable.
 */
export interface AugmentedScore {
  /** The deterministic score, copied from the base report for convenience. */
  deterministic: number
  /** The LLM-adjusted score (clamped to the deterministic score's range). */
  augmented: number
  /** Each adjustment that moved the score, keyed to its insight. */
  adjustments: AugmentedScoreAdjustment[]
}

/** Provenance about the analyze run itself. */
export interface AnalysisProvenance {
  /** Whether the analytics layer actually ran (false ⇒ deterministic-only). */
  enabled: boolean
  /** Provider ids that produced insights this run. */
  providers: string[]
  /** Insights the layer considered before validation/folding. */
  insightsConsidered: number
  /** Insights that survived validation and were applied. */
  insightsApplied: number
}

/**
 * The augmented report = the deterministic report (unchanged) + the insights +
 * the augmented score + run provenance. This is the output contract of the
 * optional analytics layer.
 */
export interface AugmentedReport {
  /** The deterministic scan report, byte-for-byte unchanged. */
  baseReport: LocalReadinessReport
  /** When the analysis was produced (ISO 8601). */
  generatedAt: string
  /** Every validated insight from this run. */
  insights: LlmInsight[]
  /** The augmented score and its itemized adjustments. */
  augmentedScore: AugmentedScore
  /** Provenance about the run. */
  analysis: AnalysisProvenance
}
