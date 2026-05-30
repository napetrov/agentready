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

  const severityHits = countSeverityHits(report.findings, failOnSeverity)
  if (severityHits > 0) {
    failureReasons.push(`${severityHits} finding(s) at or above "${failOnSeverity}"`)
  }

  checkMinScore(report.summary.score, options.minScore, failureReasons)

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

  if (options.failOnRegression && report.regressions.length > 0) {
    failureReasons.push(`${report.regressions.length} readiness regression(s) introduced`)
  }

  const severityHits = countSeverityHits(report.newFindings, failOnSeverity)
  if (severityHits > 0) {
    failureReasons.push(`${severityHits} new finding(s) at or above "${failOnSeverity}"`)
  }

  checkMinScore(report.headReport.summary.score, options.minScore, failureReasons)

  return { failed: failureReasons.length > 0, failureReasons }
}
