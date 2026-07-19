import type { PolicyResult } from '../core/policy'
import type { CiEvidence, LocalReadinessReport, ReadinessDiffReport } from '../core/types'
import { ciRunLabels } from '../detectors/ci-workflows'
import { NOT_VERIFIED_EXTERNAL_CONTROLS } from '../core/not-verified'

const ciCoverageLine = (ci: CiEvidence): string => {
  if (ci.workflowFiles.length === 0) {
    return 'CI: no workflows detected'
  }
  const runs = ciRunLabels(ci)
  const detail = runs.length > 0 ? `runs ${runs.join(', ')}` : 'no recognized commands'
  const plural = ci.workflowFiles.length === 1 ? '' : 's'
  return `CI: ${ci.workflowFiles.length} workflow${plural} (${detail})`
}

// Omits zero-count severities so a clean dimension stays a bare `category
// score` and only findings-bearing dimensions grow a "(N error, N warning)"
// suffix, keeping the one-line summary scannable.
const dimensionDetail = (bySeverity: { info: number; warning: number; error: number }): string =>
  (['error', 'warning', 'info'] as const)
    .filter(severity => bySeverity[severity] > 0)
    .map(severity => `${bySeverity[severity]} ${severity}`)
    .join(', ')

const dimensionsLine = (report: LocalReadinessReport): string =>
  `Dimensions: ${(report.dimensions ?? [])
    .map(dimension => {
      const detail = dimensionDetail(dimension.bySeverity)
      return `${dimension.category} ${dimension.score}${detail ? ` (${detail})` : ''}`
    })
    .join(', ')}`

// Compact by design: only calls out stages that are NOT ready, since a
// terse console summary listing all eight stages at "ready" would bury the
// signal. A fully-ready report omits the line entirely rather than printing
// an empty "Autonomy: " prefix.
const autonomyLine = (report: LocalReadinessReport): string | undefined => {
  const notReady = (report.autonomyEnvelope ?? []).filter(result => result.status !== 'ready')
  if (notReady.length === 0) return undefined
  return `Autonomy: ${notReady.map(result => `${result.stage} (${result.status === 'blocked' ? 'blocked' : 'not yet ready'})`).join(', ')}`
}

const capabilitiesLine = (report: LocalReadinessReport): string => {
  const highRisk = report.capabilities.filter(surface => surface.riskTier === 'high').length
  const highRiskDetail = highRisk > 0 ? `, ${highRisk} high-risk` : ''
  return `Capabilities: ${report.capabilities.length}${highRiskDetail}, safety signals: ${report.safetySignals.length}`
}

/**
 * Renders the Repository Agent Readiness Profile lines that lead the summary
 * (ADR 0005): the four axes are the primary signal and the single score is
 * demoted to a secondary line below. Returns [] when the field is absent (e.g.
 * legacy/synthetic reports), matching the defensive rendering of
 * `dimensions`/`autonomyEnvelope`. Per-stage readiness is shown by
 * `autonomyLine`, so it is not repeated here.
 */
const profileLines = (report: LocalReadinessReport): string[] => {
  const profile = report.readinessProfile
  if (!profile) return []
  const coveragePct = Math.round(profile.coverage.ratio * 100)
  return [
    'Repository Agent Readiness Profile',
    `Capability risk: ${profile.risk.verdict} (${profile.risk.explanation})`,
    `Scanner coverage: ${coveragePct}% (${profile.coverage.assessedSurfaces}/${profile.coverage.applicableSurfaces} applicable surfaces assessed)`,
    `Calibration confidence: ${profile.calibrationConfidence}`,
  ]
}

export function formatScanSummary(report: LocalReadinessReport): string {
  const lines = [
    ...profileLines(report),
    `AgentReady score: ${report.summary.score}/100 (secondary; the profile above is the primary signal)`,
    `Files: ${report.summary.totalFiles} (${report.summary.sourceFiles} source, ${report.summary.testFiles} tests, ${report.summary.documentationFiles} docs)`,
    capabilitiesLine(report),
    ciCoverageLine(report.ci),
    dimensionsLine(report),
    autonomyLine(report),
    `Findings: ${report.findings.length}`,
  ].filter((line): line is string => line !== undefined)

  for (const finding of report.findings.slice(0, 10)) {
    lines.push(`- [${finding.severity}] ${finding.title}${finding.path ? ` (${finding.path})` : ''}`)
  }

  lines.push(`Not verified from repository contents: ${NOT_VERIFIED_EXTERNAL_CONTROLS.join(', ')}`)

  return lines.join('\n')
}

/**
 * Renders a policy pack's severity adjustments and effective score. Only
 * meaningful when a non-default policy was explicitly requested; the raw
 * `report.summary.score`/`findings` are never changed by policy.
 */
export function formatPolicySummary(result: PolicyResult): string {
  if (result.severityAdjustments.length === 0) {
    return `Policy: ${result.policy} (no severity adjustments; effective score ${result.effectiveScore}/100)`
  }
  const lines = [
    `Policy: ${result.policy} (${result.severityAdjustments.length} severity adjustment(s), effective score ${result.effectiveScore}/100)`,
  ]
  for (const adjustment of result.severityAdjustments) {
    lines.push(`- ${adjustment.findingId}: ${adjustment.from} -> ${adjustment.to} (${adjustment.reason})`)
  }
  return lines.join('\n')
}

export function formatDiffSummary(report: ReadinessDiffReport): string {
  const lines = [
    `AgentReady diff: ${report.base}..${report.head}`,
    `Score delta: ${report.summary.scoreDelta >= 0 ? '+' : ''}${report.summary.scoreDelta}`,
    `New findings: ${report.summary.newFindings}, resolved: ${report.summary.resolvedFindings}`,
  ]

  for (const finding of report.regressions.slice(0, 10)) {
    lines.push(`- [${finding.severity}] ${finding.title}${finding.path ? ` (${finding.path})` : ''}`)
  }

  return lines.join('\n')
}
