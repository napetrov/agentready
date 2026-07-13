import type { PortfolioReport, PortfolioRepoResult } from '../core/types'

type ScannedRepo = Extract<PortfolioRepoResult, { ok: true }>

const isScanned = (repo: PortfolioRepoResult): repo is ScannedRepo => repo.ok

const scoreRange = (report: PortfolioReport): string =>
  report.summary.averageScore === null
    ? 'no repos scanned successfully'
    : `average ${report.summary.averageScore}, min ${report.summary.minScore}, max ${report.summary.maxScore}`

export function formatPortfolioSummary(report: PortfolioReport): string {
  const { summary } = report
  const lines = [
    `AgentReady portfolio: ${summary.repoCount} repo(s) (${summary.scannedCount} scanned, ${summary.scanErrorCount} failed)`,
    `Score: ${scoreRange(report)}`,
    `Findings across portfolio: ${summary.totalFindings} (${summary.bySeverity.error} error, ${summary.bySeverity.warning} warning, ${summary.bySeverity.info} info)`,
    '',
  ]

  for (const repo of report.repos) {
    if (!isScanned(repo)) {
      lines.push(`- [FAILED] ${repo.path}: ${repo.error}`)
      continue
    }
    const { error, warning } = repo.bySeverity
    const detail = error + warning === 0 ? 'clean' : `${error} error, ${warning} warning`
    lines.push(`- ${repo.score} ${repo.path} (${detail})`)
    for (const finding of repo.topFindings) {
      lines.push(`  - [${finding.severity}] ${finding.title}${finding.path ? ` (${finding.path})` : ''}`)
    }
  }

  return lines.join('\n')
}

export function formatPortfolioMarkdown(report: PortfolioReport): string {
  const { summary } = report
  const tableRows = report.repos.map(repo => {
    if (!isScanned(repo)) {
      return `| \`${repo.path}\` | — | — | — | — | scan failed: ${repo.error} |`
    }
    const { error, warning, info } = repo.bySeverity
    return `| \`${repo.path}\` | ${repo.score} | ${error} | ${warning} | ${info} | |`
  })

  const worstFindingSections = report.repos.filter(isScanned).filter(repo => repo.topFindings.length > 0)

  return [
    '## AgentReady portfolio scan',
    '',
    `Repos: ${summary.repoCount} (${summary.scannedCount} scanned, ${summary.scanErrorCount} failed)`,
    `Score: ${scoreRange(report)}`,
    `Findings across portfolio: ${summary.totalFindings} (${summary.bySeverity.error} error, ${summary.bySeverity.warning} warning, ${summary.bySeverity.info} info)`,
    '',
    '### Repos',
    '',
    '| Repo | Score | Error | Warning | Info | Notes |',
    '| --- | --- | --- | --- | --- | --- |',
    ...tableRows,
    ...(worstFindingSections.length > 0
      ? [
          '',
          '### Worst findings by repo',
          ...worstFindingSections.flatMap(repo => [
            '',
            `#### \`${repo.path}\` (${repo.score}/100)`,
            ...repo.topFindings.map(finding => {
              const location = finding.path ? ` (${finding.path})` : ''
              return `- **${finding.severity.toUpperCase()}**: ${finding.title}${location}`
            }),
          ]),
        ]
      : []),
  ].join('\n')
}
