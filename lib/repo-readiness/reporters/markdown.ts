import type { LocalReadinessReport, ReadinessDiffReport, ReadinessFinding } from '../core/types'

const markdownFindingList = (findings: ReadinessFinding[]): string[] => {
  if (findings.length === 0) {
    return ['No findings.']
  }

  return findings.slice(0, 10).map(finding => (
    `- **${finding.severity.toUpperCase()}**: ${finding.title}${finding.path ? ` (${finding.path})` : ''}. ${finding.recommendation}`
  ))
}

export function formatScanMarkdown(report: LocalReadinessReport): string {
  return [
    '## AgentReady scan',
    '',
    `Score: **${report.summary.score}/100**`,
    `Files: ${report.summary.totalFiles} total, ${report.summary.sourceFiles} source, ${report.summary.testFiles} tests, ${report.summary.documentationFiles} docs`,
    `Findings: ${report.findings.length}`,
    '',
    '### Findings',
    ...markdownFindingList(report.findings),
  ].join('\n')
}

export function formatDiffMarkdown(report: ReadinessDiffReport): string {
  return [
    '## AgentReady PR readiness',
    '',
    `Base/head: \`${report.base}\` .. \`${report.head}\``,
    `Score delta: **${report.summary.scoreDelta >= 0 ? '+' : ''}${report.summary.scoreDelta}**`,
    `New findings: ${report.summary.newFindings}; resolved findings: ${report.summary.resolvedFindings}`,
    `Regression findings: ${report.regressions.length}`,
    '',
    '### New regressions',
    ...markdownFindingList(report.regressions),
    '',
    '### Recommendations',
    ...markdownFindingList(report.newFindings),
  ].join('\n')
}
