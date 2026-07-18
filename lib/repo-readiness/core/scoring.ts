import type { EvidenceConfidence, FindingScope, ReadinessFinding, ReadinessSeverity } from './types'

/**
 * Multipliers applied per finding when computing the score. Severity is the base
 * penalty; confidence and scope scale it. See ADR 0005 for the rationale
 * (finding count should not substitute for operational risk).
 *
 * `ScoreWeights` is an internal parameter of `calculateScore`, not a serialized
 * report field: nothing writes it into a report or config. A future policy pack
 * may supply one (that plumbing is owned by the policy-plane ADR); until then
 * the only caller passes `DEFAULT_WEIGHTS`.
 */
export interface ScoreWeights {
  severity: Record<ReadinessSeverity, number>
  confidence: Record<EvidenceConfidence, number>
  scope: Record<FindingScope, number>
}

/**
 * Today's behavior exactly: severity penalties of 18/7/2 and all-`1` confidence
 * and scope multipliers, so `calculateScore(findings)` is byte-identical to the
 * pre-ADR-0005 fixed-penalty model. Deep-frozen so a caller cannot mutate the
 * shared default and silently change future scores.
 */
export const DEFAULT_WEIGHTS: ScoreWeights = Object.freeze({
  severity: Object.freeze({ error: 18, warning: 7, info: 2 }),
  confidence: Object.freeze({ high: 1, medium: 1, low: 1 }),
  scope: Object.freeze({ root: 1, package: 1, path: 1, advisory: 1 }),
}) as ScoreWeights

const SEVERITY_KEYS: ReadinessSeverity[] = ['error', 'warning', 'info']
const CONFIDENCE_KEYS: EvidenceConfidence[] = ['low', 'medium', 'high']
const SCOPE_KEYS: FindingScope[] = ['root', 'package', 'path', 'advisory']

const assertGroup = <K extends string>(group: Record<K, number>, keys: K[], label: string): void => {
  for (const key of keys) {
    const value = group[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(
        `Invalid ScoreWeights: ${label}.${key} must be a finite number >= 0, received ${String(value)}`,
      )
    }
  }
}

/**
 * Rejects a runtime-supplied weight table that is incomplete, non-finite, or
 * negative. A missing key would yield `undefined -> NaN`; a negative weight
 * could *raise* the score and weaken an existing gate. Only injected (non-default)
 * weights are validated — `DEFAULT_WEIGHTS` is trusted and frozen.
 */
export const assertValidWeights = (weights: ScoreWeights): void => {
  assertGroup(weights.severity, SEVERITY_KEYS, 'severity')
  assertGroup(weights.confidence, CONFIDENCE_KEYS, 'confidence')
  assertGroup(weights.scope, SCOPE_KEYS, 'scope')
}

/**
 * Converts findings into an experimental 0-100 readiness score. Each finding's
 * severity penalty is scaled by its (rule-owned, optional) confidence and scope
 * multipliers, then the total is subtracted from 100 and clamped.
 *
 * With `DEFAULT_WEIGHTS` every confidence/scope multiplier is `1`, so the result
 * matches the historical fixed-penalty score exactly. The score is intentionally
 * simple and should be treated as a structured signal, not a compliance
 * certification.
 *
 * The result is rounded to an integer: calibrated weights may be fractional, but
 * `summary.score` and the per-category `dimensions[].score` are integer-typed in
 * the report contract. Rounding is a no-op on the default path (integer penalties).
 */
export const calculateScore = (
  findings: ReadinessFinding[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number => {
  if (weights !== DEFAULT_WEIGHTS) {
    assertValidWeights(weights)
  }
  const penalty = findings.reduce((total, finding) => {
    const base = weights.severity[finding.severity]
    const confidence = weights.confidence[finding.confidence ?? 'high']
    const scope = weights.scope[finding.scope ?? 'package']
    return total + base * confidence * scope
  }, 0)
  return Math.max(0, Math.min(100, Math.round(100 - penalty)))
}
