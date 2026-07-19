import {
  DEFAULT_WEIGHTS,
  assertValidWeights,
  calculateDimensionScores,
  calculateScore,
} from '../lib/repo-readiness/local-readiness'
import type { ReadinessFinding, ScoreWeights } from '../lib/repo-readiness/local-readiness'

const finding = (
  id: string,
  severity: ReadinessFinding['severity'],
  extra: Partial<ReadinessFinding> = {},
): ReadinessFinding => ({
  id,
  title: id,
  severity,
  recommendation: `fix ${id}`,
  ...extra,
})

// A calibrated table that discounts low-confidence and advisory-scope findings,
// used to prove the multipliers actually bite when supplied directly.
const calibrated: ScoreWeights = {
  severity: { error: 18, warning: 7, info: 2 },
  confidence: { high: 1, medium: 1, low: 0.5 },
  scope: { root: 1, package: 1, path: 1, advisory: 0.5 },
}

describe('calculateScore', () => {
  it('reproduces the historical fixed-penalty model on the default path', () => {
    // error -18, warning -7, info -2, clamped 0..100.
    expect(calculateScore([])).toBe(100)
    expect(calculateScore([finding('a', 'error')])).toBe(82)
    expect(calculateScore([finding('a', 'warning')])).toBe(93)
    expect(calculateScore([finding('a', 'info')])).toBe(98)
    expect(
      calculateScore([finding('a', 'error'), finding('b', 'warning'), finding('c', 'info')]),
    ).toBe(100 - 18 - 7 - 2)
  })

  it('clamps to 0 for many findings', () => {
    const many = Array.from({ length: 10 }, (_, i) => finding(`e${i}`, 'error'))
    expect(calculateScore(many)).toBe(0)
  })

  it('treats absent confidence/scope as neutral (high/package)', () => {
    const bare = finding('a', 'warning')
    const explicit = finding('a', 'warning', { confidence: 'high', scope: 'package' })
    expect(calculateScore([bare])).toBe(calculateScore([explicit]))
    // Default weights ignore confidence/scope entirely.
    expect(calculateScore([finding('a', 'warning', { confidence: 'low', scope: 'advisory' })])).toBe(
      calculateScore([bare]),
    )
  })

  it('applies confidence/scope multipliers only when non-default weights are supplied', () => {
    const lowConf = [finding('a', 'error', { confidence: 'low' })]
    expect(calculateScore(lowConf)).toBe(82) // default: no discount
    expect(calculateScore(lowConf, calibrated)).toBe(91) // 18 * 0.5 = 9 penalty
    const advisory = [finding('a', 'error', { scope: 'advisory' })]
    expect(calculateScore(advisory, calibrated)).toBe(91)
  })

  it('rounds fractional penalties to an integer score', () => {
    // warning 7 * confidence.low 0.5 = 3.5 penalty -> 96.5 -> rounds to 97 (or 96).
    const score = calculateScore([finding('a', 'warning', { confidence: 'low' })], calibrated)
    expect(Number.isInteger(score)).toBe(true)
    expect(score).toBe(Math.round(100 - 3.5))
  })

  it('rejects injected weights that are negative, non-finite, or incomplete', () => {
    const negative = { ...calibrated, severity: { error: -18, warning: 7, info: 2 } }
    expect(() => calculateScore([finding('a', 'error')], negative)).toThrow(/severity\.error/)

    const nan = { ...calibrated, confidence: { high: Number.NaN, medium: 1, low: 1 } }
    expect(() => calculateScore([finding('a', 'error')], nan)).toThrow(/confidence\.high/)

    // Incomplete map (missing `advisory`) -> undefined multiplier.
    const incomplete = { ...calibrated, scope: { root: 1, package: 1, path: 1 } } as unknown as ScoreWeights
    expect(() => calculateScore([finding('a', 'error')], incomplete)).toThrow(/scope\.advisory/)
  })

  it('does not validate the trusted default weights', () => {
    expect(() => calculateScore([finding('a', 'error')], DEFAULT_WEIGHTS)).not.toThrow()
  })
})

describe('DEFAULT_WEIGHTS', () => {
  it('is deep-frozen so a caller cannot mutate the shared default', () => {
    expect(Object.isFrozen(DEFAULT_WEIGHTS)).toBe(true)
    expect(Object.isFrozen(DEFAULT_WEIGHTS.severity)).toBe(true)
    expect(Object.isFrozen(DEFAULT_WEIGHTS.confidence)).toBe(true)
    expect(Object.isFrozen(DEFAULT_WEIGHTS.scope)).toBe(true)
    // Runtime mutation of the frozen object throws in strict mode (ts-jest
    // compiles modules as strict), so the shared default cannot be changed.
    expect(() => {
      ;(DEFAULT_WEIGHTS.severity as Record<string, number>).error = 1
    }).toThrow()
    expect(DEFAULT_WEIGHTS.severity.error).toBe(18)
  })

  it('carries every required severity/confidence/scope key and passes validation', () => {
    expect(() => assertValidWeights(DEFAULT_WEIGHTS)).not.toThrow()
  })
})

describe('calculateDimensionScores rounding', () => {
  it('produces integer per-category scores', () => {
    const dimensions = calculateDimensionScores([
      finding('commands.test.missing', 'error'),
      finding('files.large:big.bin', 'warning'),
    ])
    for (const dimension of dimensions) {
      expect(Number.isInteger(dimension.score)).toBe(true)
      expect(dimension.score).toBeGreaterThanOrEqual(0)
      expect(dimension.score).toBeLessThanOrEqual(100)
    }
  })
})
