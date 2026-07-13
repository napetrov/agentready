import { adjustFindings, applyPolicy, type PolicyPack } from './policy'
import { computeRegressions } from './scan-engine'
import type {
  LocalReadinessReport,
  ReadinessDiffReport,
  ReadinessFinding,
  ReadinessSeverity,
} from './types'

/**
 * The severity threshold a run is gated on. `off` disables the severity gate
 * entirely; any other value fails the run when a finding at or above that
 * severity is present (in scan mode) or newly introduced (in diff mode).
 */
export type FailOnSeverity = 'off' | 'info' | 'warning' | 'error'

export const FAIL_ON_SEVERITIES: FailOnSeverity[] = ['off', 'info', 'warning', 'error']

export interface GateOptions {
  /** Fail when a finding meets or exceeds this severity. Defaults to `error`. */
  failOnSeverity?: FailOnSeverity
  /** In diff mode, fail when any readiness regression is introduced. */
  failOnRegression?: boolean
  /** Fail when the (head) score drops below this minimum. */
  minScore?: number
  /**
   * When provided, the severity/score gates use this policy pack's
   * adjustments instead of the raw deterministic findings/score. Raw evidence
   * is never mutated; this only changes what the gate reacts to.
   */
  policy?: PolicyPack
}

export interface GateResult {
  /** True when one or more gates tripped. */
  failed: boolean
  /** Human-readable reasons, one per tripped gate. Empty when `failed` is false. */
  failureReasons: string[]
}

const severityRank: Record<ReadinessSeverity, number> = { info: 1, warning: 2, error: 3 }

/** Whether `severity` meets or exceeds the configured `threshold`. */
export const meetsThreshold = (severity: ReadinessSeverity, threshold: FailOnSeverity): boolean =>
  threshold !== 'off' && severityRank[severity] >= severityRank[threshold]

const countSeverityHits = (findings: ReadinessFinding[], threshold: FailOnSeverity): number =>
  findings.filter(finding => meetsThreshold(finding.severity, threshold)).length

const checkMinScore = (score: number, minScore: number | undefined, reasons: string[]): void => {
  if (minScore !== undefined && score < minScore) {
    reasons.push(`score ${score} is below the minimum ${minScore}`)
  }
}

/**
 * Evaluates the configured gates for a scan report. Shared by the CLI and the
 * GitHub Action so both surfaces gate identically.
 */
export const evaluateScanGate = (report: LocalReadinessReport, options: GateOptions = {}): GateResult => {
  const failOnSeverity = options.failOnSeverity ?? 'error'
  const failureReasons: string[] = []

  const policyResult = options.policy ? applyPolicy(report, options.policy) : undefined
  const findings = policyResult?.adjustedFindings ?? report.findings
  const score = policyResult?.effectiveScore ?? report.summary.score

  const severityHits = countSeverityHits(findings, failOnSeverity)
  if (severityHits > 0) {
    failureReasons.push(`${severityHits} finding(s) at or above "${failOnSeverity}"`)
  }

  checkMinScore(score, options.minScore, failureReasons)

  return { failed: failureReasons.length > 0, failureReasons }
}

/**
 * Evaluates the configured gates for a diff report. The severity gate applies
 * to *newly introduced* findings so an unchanged backlog of pre-existing issues
 * does not fail a PR; `minScore` is checked against the head report's score.
 */
export const evaluateDiffGate = (report: ReadinessDiffReport, options: GateOptions = {}): GateResult => {
  const failOnSeverity = options.failOnSeverity ?? 'error'
  const failureReasons: string[] = []

  if (options.failOnRegression) {
    // `report.regressions` is always computed from raw, unadjusted findings.
    // Under a policy that escalates severity (e.g. `enterprise` promoting
    // `safety.*` findings from info to warning), a newly introduced info
    // finding can be gateable under the policy but invisible to the raw
    // regression set — recompute against policy-adjusted findings so
    // `--fail-on-regression` sees what the policy actually gates on.
    const regressions = options.policy
      ? computeRegressions(
          adjustFindings(report.baseReport.findings, options.policy).adjustedFindings,
          adjustFindings(report.headReport.findings, options.policy).adjustedFindings,
        )
      : report.regressions
    if (regressions.length > 0) {
      failureReasons.push(`${regressions.length} readiness regression(s) introduced`)
    }
  }

  const newFindings = options.policy ? adjustFindings(report.newFindings, options.policy).adjustedFindings : report.newFindings
  const severityHits = countSeverityHits(newFindings, failOnSeverity)
  if (severityHits > 0) {
    failureReasons.push(`${severityHits} new finding(s) at or above "${failOnSeverity}"`)
  }

  const score = options.policy ? applyPolicy(report.headReport, options.policy).effectiveScore : report.headReport.summary.score
  checkMinScore(score, options.minScore, failureReasons)

  return { failed: failureReasons.length > 0, failureReasons }
}
