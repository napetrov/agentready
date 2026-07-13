import type {
  CiEvidence,
  DesignStateInsight,
  LocalReadinessReport,
  ReadinessDiffReport,
  ReadinessDimensionScore,
  ReadinessFinding,
} from '../core/types'
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

const markdownTopology = (report: LocalReadinessReport): string[] => {
  const evidence = report.repositoryEvidence
  if (!evidence) return []
  const roots = evidence.roots.slice(0, 8).map(root => {
    const languages = root.languages.length > 0 ? `, ${root.languages.join('/')}` : ''
    return `- \`${root.path}\`: ${root.rootKind}${languages}, ${root.sourceFiles} source, ${root.testFiles} tests, ${root.documentationFiles} docs`
  })
  return [
    '',
    '### Repository topology',
    `Roots: ${evidence.topology.metrics.rootCount}; languages: ${evidence.topology.metrics.languageCount}; roots without local tests: ${evidence.topology.metrics.rootsWithoutLocalTests}; roots without local docs: ${evidence.topology.metrics.rootsWithoutLocalDocs}`,
    ...roots,
  ]
}

const markdownDocumentRoles = (report: LocalReadinessReport): string[] => {
  const surfaces = report.repositoryEvidence?.documentSurfaces
    .filter(surface => surface.roleClaims.length > 0)
    .slice(0, 8)
  if (!surfaces || surfaces.length === 0) return []
  return [
    '',
    '### Documentation roles',
    ...surfaces.map(surface => {
      const roles = surface.roleClaims.map(claim => `${claim.value} (${claim.confidence})`).join(', ')
      return `- \`${surface.path}\`: ${roles}`
    }),
  ]
}

const markdownDimensions = (dimensions: ReadinessDimensionScore[] | undefined): string[] => {
  if (!dimensions || dimensions.length === 0) return []
  return [
    '',
    '### Dimension scores',
    ...dimensions.map(dimension => {
      const { info, warning, error } = dimension.bySeverity
      const detail = dimension.findingCount === 0 ? 'no findings' : `${error} error, ${warning} warning, ${info} info`
      return `- ${dimension.category}: **${dimension.score}/100** (${detail})`
    }),
  ]
}

const markdownInsights = (title: string, insights: DesignStateInsight[]): string[] => {
  if (insights.length === 0) return []
  return [
    '',
    `### ${title}`,
    ...insights.slice(0, 8).map(insight => {
      const paths = insight.paths.length > 0 ? ` Paths: ${insight.paths.slice(0, 3).map(path => `\`${path}\``).join(', ')}.` : ''
      return `- **${insight.severity.toUpperCase()}** ${insight.category}: ${insight.summary}${paths}`
    }),
  ]
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
    ...markdownDimensions(report.dimensions),
    ...markdownTopology(report),
    ...markdownDocumentRoles(report),
    ...markdownInsights('Design-state strengths', report.designState?.strengths ?? []),
    ...markdownInsights('Design-state risks', report.designState?.risks ?? []),
    ...markdownInsights('Design-state ambiguities', report.designState?.ambiguities ?? []),
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
