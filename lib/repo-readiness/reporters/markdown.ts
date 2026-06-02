import type { CiEvidence, LocalReadinessReport, ReadinessDiffReport, ReadinessFinding } from '../core/types'
import { ciRunLabels } from '../detectors/ci-workflows'

// Summarizes which verification commands CI actually runs, parsed from the
// workflow steps. Helps a reader see at a glance whether the objective gate
// covers the commands the repository exposes.
const ciCoverageLine = (ci: CiEvidence): string => {
  if (ci.workflowFiles.length === 0) {
    return 'CI: no workflows detected'
  }
  const runs = ciRunLabels(ci)
  const detail = runs.length > 0 ? `runs ${runs.join(', ')}` : 'no recognized commands'
  const plural = ci.workflowFiles.length === 1 ? '' : 's'
  return `CI: ${ci.workflowFiles.length} workflow${plural} — ${detail}`
}

const markdownFindingList = (findings: ReadinessFinding[]): string[] => {
  if (findings.length === 0) {
    return ['No findings.']
  }

  return findings.slice(0, 10).map(finding => {
    const location = finding.path ? ` (${finding.path})` : ''
    const recommendation = finding.recommendation?.trim() ? ` ${finding.recommendation}` : ''
    return `- **${finding.severity.toUpperCase()}**: ${finding.title}${location}.${recommendation}`
  })
}

export function formatScanMarkdown(report: LocalReadinessReport): string {
  return [
    '## AgentReady scan',
    '',
    `Score: **${report.summary.score}/100**`,
    `Files: ${report.summary.totalFiles} total, ${report.summary.sourceFiles} source, ${report.summary.testFiles} tests, ${report.summary.documentationFiles} docs`,
    `Capabilities: ${report.capabilities.length}; safety signals: ${report.safetySignals.length}`,
    ciCoverageLine(report.ci),
    `Findings: ${report.findings.length}`,
    '',
    '### Findings',
    ...markdownFindingList(report.findings),
  ].join('\n')
}

export function formatDiffMarkdown(report: ReadinessDiffReport): string {
  // A one-line verdict so the job summary reads like a status at a glance,
  // without scanning the counts below.
  const clean = report.regressions.length === 0 && report.newFindings.length === 0
  const headline = clean
    ? '✅ No readiness regressions.'
    : `⚠️ ${report.regressions.length} regression(s), ${report.newFindings.length} new finding(s).`
  return [
    '## AgentReady PR readiness',
    '',
    headline,
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
