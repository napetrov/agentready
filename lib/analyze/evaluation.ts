import type { LlmInsight } from './types'

// Evaluation harness (design §11): measure how good the analytics layer is
// against a labeled gold set, so we can decide whether to trust it / gate on it.
// This module is pure scoring math over (predicted insights, expected labels);
// the gold set itself and any live-model recording live with the harness runner,
// not here, so this stays deterministic and unit-testable.

/** One labeled expectation: an insight that should (or should not) be produced. */
export interface GoldLabel {
  /** The insight id expected for this case (e.g. analysis.instruction-quality:AGENTS.md). */
  id: string
  /** Whether the analyzer should produce this insight (true) or not (false). */
  expected: boolean
}

/** One gold-set case: a fixture and the labels its analysis should satisfy. */
export interface GoldCase {
  name: string
  labels: GoldLabel[]
}

export interface Confusion {
  truePositives: number
  falsePositives: number
  falseNegatives: number
  trueNegatives: number
}

export interface EvaluationMetrics extends Confusion {
  /** TP / (TP + FP); 1 when no positives were predicted. */
  precision: number
  /** TP / (TP + FN); 1 when nothing positive was expected. */
  recall: number
  /** Harmonic mean of precision and recall. */
  f1: number
}

const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? 1 : numerator / denominator

/**
 * Compares predicted insights against gold labels for one case. An insight
 * "fires" for a label id when an insight with that id is present.
 */
export const scoreCase = (insights: LlmInsight[], labels: GoldLabel[]): Confusion => {
  const fired = new Set(insights.map(i => i.id))
  let truePositives = 0
  let falsePositives = 0
  let falseNegatives = 0
  let trueNegatives = 0
  for (const label of labels) {
    const present = fired.has(label.id)
    if (label.expected && present) truePositives += 1
    else if (label.expected && !present) falseNegatives += 1
    else if (!label.expected && present) falsePositives += 1
    else trueNegatives += 1
  }
  return { truePositives, falsePositives, falseNegatives, trueNegatives }
}

/** Sums confusion counts across cases. */
export const aggregate = (confusions: Confusion[]): Confusion =>
  confusions.reduce<Confusion>(
    (acc, c) => ({
      truePositives: acc.truePositives + c.truePositives,
      falsePositives: acc.falsePositives + c.falsePositives,
      falseNegatives: acc.falseNegatives + c.falseNegatives,
      trueNegatives: acc.trueNegatives + c.trueNegatives,
    }),
    { truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 0 },
  )

/** Derives precision/recall/F1 from a (possibly aggregated) confusion matrix. */
export const metricsFor = (c: Confusion): EvaluationMetrics => {
  const precision = ratio(c.truePositives, c.truePositives + c.falsePositives)
  const recall = ratio(c.truePositives, c.truePositives + c.falseNegatives)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return { ...c, precision, recall, f1 }
}

/**
 * Measures confidence calibration: groups insights into confidence buckets and
 * reports, per bucket, the mean stated confidence vs. the observed accuracy
 * (fraction whose label was `expected: true`). Well-calibrated output has the
 * two close in every populated bucket.
 */
export interface CalibrationBucket {
  /** Bucket lower bound (inclusive), e.g. 0.0, 0.2, ... */
  lower: number
  count: number
  meanConfidence: number
  observedAccuracy: number
}

export const calibration = (
  insights: LlmInsight[],
  expectedById: Map<string, boolean>,
  buckets = 5,
): CalibrationBucket[] => {
  const width = 1 / buckets
  const acc = Array.from({ length: buckets }, (_, i) => ({ lower: i * width, conf: 0, correct: 0, count: 0 }))
  for (const insight of insights) {
    const idx = Math.min(buckets - 1, Math.floor(insight.confidence / width))
    const bucket = acc[idx]
    bucket.count += 1
    bucket.conf += insight.confidence
    if (expectedById.get(insight.id)) bucket.correct += 1
  }
  return acc.map(b => ({
    lower: b.lower,
    count: b.count,
    meanConfidence: b.count === 0 ? 0 : b.conf / b.count,
    observedAccuracy: b.count === 0 ? 0 : b.correct / b.count,
  }))
}
