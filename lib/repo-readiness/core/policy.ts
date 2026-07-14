import { calculateScore } from './scoring'
import type { LocalReadinessReport, ReadinessFinding, ReadinessSeverity } from './types'

/**
 * The set of built-in policy names. Kept separate from the pack
 * implementations (`checks/policy-packs.ts`) so core stays free of a
 * dependency on the checks layer; see that file for what each pack adjusts
 * and why.
 */
export type PolicyName = 'default' | 'enterprise' | 'oss' | 'ml-scientific'

export const POLICY_NAMES: PolicyName[] = ['default', 'enterprise', 'oss', 'ml-scientific']

/**
 * A team- or domain-specific severity policy over the same deterministic
 * evidence. Packs never mutate raw findings or evidence — they only decide,
 * per finding, whether its severity should be interpreted differently. See
 * docs/product/policy-packs.md for the design.
 */
export interface PolicyPack {
  name: PolicyName
  description: string
  /**
   * Returns the adjusted severity and a human-readable reason for a finding,
   * or `undefined` to leave the finding's severity unchanged.
   */
  adjust: (finding: ReadinessFinding) => { to: ReadinessSeverity; reason: string } | undefined
}

export interface PolicySeverityAdjustment {
  findingId: string
  from: ReadinessSeverity
  to: ReadinessSeverity
  reason: string
}

export interface PolicyResult {
  policy: PolicyName
  /** What each adjusted rule now maps to, keyed by rule id (not per-instance). */
  effectiveThresholds: Record<string, ReadinessSeverity>
  severityAdjustments: PolicySeverityAdjustment[]
  /** `findings` with policy-adjusted severities; ids/paths/recommendations unchanged. */
  adjustedFindings: ReadinessFinding[]
  /** `calculateScore` re-run over `adjustedFindings`; the raw `summary.score` is never changed. */
  effectiveScore: number
}

/**
 * Applies a policy pack to a list of findings, returning both the
 * severity-adjusted findings and an auditable list of what changed and why.
 * Exposed separately from `applyPolicy` so the diff gate can adjust a subset
 * of findings (e.g. only newly introduced ones) without a full report.
 */
export const adjustFindings = (
  findings: ReadinessFinding[],
  pack: PolicyPack,
): { adjustedFindings: ReadinessFinding[]; severityAdjustments: PolicySeverityAdjustment[] } => {
  const severityAdjustments: PolicySeverityAdjustment[] = []
  const adjustedFindings = findings.map(finding => {
    const adjustment = pack.adjust(finding)
    if (!adjustment || adjustment.to === finding.severity) {
      return finding
    }
    severityAdjustments.push({
      findingId: finding.id,
      from: finding.severity,
      to: adjustment.to,
      reason: adjustment.reason,
    })
    return { ...finding, severity: adjustment.to }
  })
  return { adjustedFindings, severityAdjustments }
}

/**
 * Applies a policy pack to a full scan report, computing the policy-adjusted
 * findings, an audit trail of severity changes, and an effective score. The
 * report itself is never mutated.
 */
export const applyPolicy = (report: LocalReadinessReport, pack: PolicyPack): PolicyResult => {
  const { adjustedFindings, severityAdjustments } = adjustFindings(report.findings, pack)
  const effectiveThresholds: Record<string, ReadinessSeverity> = {}
  for (const adjustment of severityAdjustments) {
    // Keyed by rule id (the finding id minus any `:instance` suffix) so a
    // rule that fires many times shows one threshold entry, not one per hit.
    effectiveThresholds[adjustment.findingId.split(':')[0]] = adjustment.to
  }
  return {
    policy: pack.name,
    effectiveThresholds,
    severityAdjustments,
    adjustedFindings,
    effectiveScore: calculateScore(adjustedFindings),
  }
}
