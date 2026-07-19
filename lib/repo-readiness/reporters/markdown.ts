import type {
  AutonomyStageResult,
  CiEvidence,
  DesignStateInsight,
  LocalReadinessReport,
  ReadinessDiffReport,
  ReadinessDimensionScore,
  ReadinessFinding,
} from '../core/types'
import { ciRunLabels } from '../detectors/ci-workflows'
import { NOT_VERIFIED_EXTERNAL_CONTROLS } from './not-verified'

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

const AUTONOMY_STATUS_LABEL: Record<AutonomyStageResult['status'], string> = {
  ready: '✅ ready',
  not_yet_ready: '⚠️ not yet ready',
  blocked: '⛔ blocked',
}

const markdownAutonomyEnvelope = (autonomyEnvelope: AutonomyStageResult[] | undefined): string[] => {
  if (!autonomyEnvelope || autonomyEnvelope.length === 0) return []
  return [
    '',
    '### Autonomy envelope',
    'What level of agent autonomy this repository is ready for, derived from findings (not a separate score):',
    ...autonomyEnvelope.map(result => {
      const detail = result.findingIds.length > 0 ? ` — ${result.findingIds.join(', ')}` : ''
      return `- ${result.stage}: ${AUTONOMY_STATUS_LABEL[result.status]}${detail}`
    }),
  ]
}

// The Repository Agent Readiness Profile leads the report (ADR 0005): the four
// axes are the primary signal and the single score is a secondary line. Returns
// [] when the field is absent, matching the other defensively-rendered sections.
// Per-stage readiness is rendered by the Autonomy envelope section, so it is
// referenced rather than duplicated here.
const markdownReadinessProfile = (report: LocalReadinessReport): string[] => {
  const profile = report.readinessProfile
  if (!profile) return []
  const coveragePct = Math.round(profile.coverage.ratio * 100)
  return [
    '',
    '### Repository Agent Readiness Profile',
    'The primary, multi-axis readiness view; the single score below is a secondary, experimental signal.',
    `- **Capability risk:** ${profile.risk.verdict} — ${profile.risk.explanation}`,
    `- **Scanner coverage:** ${coveragePct}% (${profile.coverage.assessedSurfaces}/${profile.coverage.applicableSurfaces} applicable surfaces assessed)`,
    `- **Calibration confidence:** ${profile.calibrationConfidence}`,
    '- **Per-stage readiness:** see the Autonomy envelope section below.',
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
  const highRiskCapabilities = report.capabilities.filter(surface => surface.riskTier === 'high').length
  const highRiskDetail = highRiskCapabilities > 0 ? ` (${highRiskCapabilities} high-risk)` : ''
  return [
    '## AgentReady scan',
    ...markdownReadinessProfile(report),
    '',
    `Score (secondary, experimental): **${report.summary.score}/100**`,
    `Files: ${report.summary.totalFiles} total, ${report.summary.sourceFiles} source, ${report.summary.testFiles} tests, ${report.summary.documentationFiles} docs`,
    `Capabilities: ${report.capabilities.length}${highRiskDetail}; safety signals: ${report.safetySignals.length}`,
    ciCoverageLine(report.ci),
    `Findings: ${report.findings.length}`,
    ...markdownDimensions(report.dimensions),
    ...markdownAutonomyEnvelope(report.autonomyEnvelope),
    ...markdownTopology(report),
    ...markdownDocumentRoles(report),
    ...markdownInsights('Design-state strengths', report.designState?.strengths ?? []),
    ...markdownInsights('Design-state risks', report.designState?.risks ?? []),
    ...markdownInsights('Design-state ambiguities', report.designState?.ambiguities ?? []),
    '',
    '### Findings',
    ...markdownFindingList(report.findings),
    '',
    '### Not verified from repository contents',
    'AgentReady scans repository contents only, with no network calls — these platform-level controls cannot be confirmed or denied from a local scan:',
    ...NOT_VERIFIED_EXTERNAL_CONTROLS.map(item => `- ${item}`),
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
