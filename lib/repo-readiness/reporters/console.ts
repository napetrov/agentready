import type { LocalReadinessReport, ReadinessDiffReport } from '../core/types'

export function formatScanSummary(report: LocalReadinessReport): string {
  const lines = [
    `AgentReady score: ${report.summary.score}/100`,
    `Files: ${report.summary.totalFiles} (${report.summary.sourceFiles} source, ${report.summary.testFiles} tests, ${report.summary.documentationFiles} docs)`,
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
