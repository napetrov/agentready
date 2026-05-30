import {
  aggregate,
  calibration,
  metricsFor,
  scoreCase,
  type GoldLabel,
  type LlmInsight,
} from '../lib/analyze'

const insight = (id: string, confidence = 0.8): LlmInsight => ({
  id,
  kind: 'quality',
  verdict: 'v',
  confidence,
  rationale: 'r',
  model: 'm@1',
  promptVersion: 'p/v1',
})

describe('scoreCase', () => {
  it('classifies TP/FP/FN/TN against labels', () => {
    const labels: GoldLabel[] = [
      { id: 'a', expected: true }, // present → TP
      { id: 'b', expected: true }, // absent → FN
      { id: 'c', expected: false }, // present → FP
      { id: 'd', expected: false }, // absent → TN
    ]
    const c = scoreCase([insight('a'), insight('c')], labels)
    expect(c).toEqual({ truePositives: 1, falsePositives: 1, falseNegatives: 1, trueNegatives: 1 })
  })
})

describe('metricsFor', () => {
  it('computes precision/recall/F1', () => {
    const m = metricsFor({ truePositives: 3, falsePositives: 1, falseNegatives: 1, trueNegatives: 5 })
    expect(m.precision).toBeCloseTo(0.75)
    expect(m.recall).toBeCloseTo(0.75)
    expect(m.f1).toBeCloseTo(0.75)
  })

  it('treats empty positives as precision/recall 1', () => {
    const m = metricsFor({ truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 4 })
    expect(m.precision).toBe(1)
    expect(m.recall).toBe(1)
  })
})

describe('aggregate', () => {
  it('sums confusion matrices across cases', () => {
    const total = aggregate([
      { truePositives: 1, falsePositives: 0, falseNegatives: 1, trueNegatives: 0 },
      { truePositives: 2, falsePositives: 1, falseNegatives: 0, trueNegatives: 3 },
    ])
    expect(total).toEqual({ truePositives: 3, falsePositives: 1, falseNegatives: 1, trueNegatives: 3 })
  })
})

describe('calibration', () => {
  it('buckets insights and compares mean confidence to observed accuracy', () => {
    const expected = new Map<string, boolean>([
      ['hi-correct', true],
      ['hi-wrong', false],
      ['lo-correct', true],
    ])
    const buckets = calibration(
      [insight('hi-correct', 0.9), insight('hi-wrong', 0.85), insight('lo-correct', 0.1)],
      expected,
      5,
    )
    // Top bucket [0.8,1.0): two insights, mean conf ~0.875, accuracy 0.5.
    const top = buckets[4]
    expect(top.count).toBe(2)
    expect(top.meanConfidence).toBeCloseTo(0.875)
    expect(top.observedAccuracy).toBeCloseTo(0.5)
    // Bottom bucket [0,0.2): one correct insight.
    expect(buckets[0].count).toBe(1)
    expect(buckets[0].observedAccuracy).toBe(1)
  })
})
