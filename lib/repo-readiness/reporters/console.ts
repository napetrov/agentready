import type { CiEvidence, LocalReadinessReport, ReadinessDiffReport } from '../core/types'
import { ciRunLabels } from '../detectors/ci-workflows'

const ciCoverageLine = (ci: CiEvidence): string => {
  if (ci.workflowFiles.length === 0) {
    return 'CI: no workflows detected'
  }
  const runs = ciRunLabels(ci)
  const detail = runs.length > 0 ? `runs ${runs.join(', ')}` : 'no recognized commands'
  const plural = ci.workflowFiles.length === 1 ? '' : 's'
  return `CI: ${ci.workflowFiles.length} workflow${plural} (${detail})`
}

const dimensionsLine = (report: LocalReadinessReport): string =>
  `Dimensions: ${(report.dimensions ?? []).map(dimension => `${dimension.category} ${dimension.score}`).join(', ')}`

export function formatScanSummary(report: LocalReadinessReport): string {
  const lines = [
    `AgentReady score: ${report.summary.score}/100`,
    `Files: ${report.summary.totalFiles} (${report.summary.sourceFiles} source, ${report.summary.testFiles} tests, ${report.summary.documentationFiles} docs)`,
    `Capabilities: ${report.capabilities.length}, safety signals: ${report.safetySignals.length}`,
    ciCoverageLine(report.ci),
    dimensionsLine(report),
    `Findings: ${report.findings.length}`,
  ]

  for (const finding of report.findings.slice(0, 10)) {
    lines.push(`- [${finding.severity}] ${finding.title}${finding.path ? ` (${finding.path})` : ''}`)
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
