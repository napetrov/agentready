import type { AugmentedScore, AugmentedScoreAdjustment, LlmInsight } from './types'

// Folds validated insights into the augmented score. The deterministic score is
// never mutated; we compute a separate, clearly-labeled augmented score and an
// itemized list of every adjustment so the difference is fully auditable
// (design §9). Each insight's signed `scoreImpact` is weighted by its
// confidence, so low-confidence judgments move the score less.

const SCORE_MIN = 0
const SCORE_MAX = 100

const clamp = (value: number): number => Math.max(SCORE_MIN, Math.min(SCORE_MAX, value))

/**
 * Computes the augmented score from the deterministic score and the insights.
 * Only insights carrying a `scoreImpact` contribute; each contributes
 * `round(scoreImpact * confidence)`. The result is clamped to [0, 100].
 */
export const computeAugmentedScore = (deterministic: number, insights: LlmInsight[]): AugmentedScore => {
  const adjustments: AugmentedScoreAdjustment[] = []
  for (const insight of insights) {
    if (insight.scoreImpact === undefined || insight.scoreImpact === 0) continue
    const delta = Math.round(insight.scoreImpact * insight.confidence)
    if (delta === 0) continue
    adjustments.push({ insightId: insight.id, delta })
  }

  const rawTotal = adjustments.reduce((sum, adjustment) => sum + adjustment.delta, deterministic)
  return {
    deterministic,
    augmented: clamp(rawTotal),
    adjustments,
  }
}
