import type { AugmentedReport, LlmInsight } from './types'

// Human-readable rendering of an augmented report. Both renderers make the
// two-score distinction explicit (design §2, §9): the deterministic score is
// always shown, and the augmented score is clearly labeled alongside it.

/**
 * Sanitizes free-form (largely LLM-produced) text for a Markdown table cell:
 * collapses newlines to spaces and escapes pipes so a verdict/target/id can't
 * break the table row in a PR comment or job summary.
 */
const cell = (value: string): string => value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')

const scoreLine = (report: AugmentedReport): string => {
  const { deterministic, augmented } = report.augmentedScore
  const delta = augmented - deterministic
  const deltaText = delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta}`
  return `Deterministic score: ${deterministic}   Augmented score: ${augmented} (${deltaText})`
}

const insightLine = (insight: LlmInsight): string => {
  const target = insight.target ? ` [${insight.target}]` : ''
  const confidence = `${Math.round(insight.confidence * 100)}%`
  return `- (${insight.kind}, ${confidence})${target} ${insight.verdict}: ${insight.rationale}`
}

/** Compact console summary. */
export const formatAugmentedSummary = (report: AugmentedReport): string => {
  const lines = [
    'AgentReady augmented analysis',
    scoreLine(report),
    report.analysis.enabled
      ? `Insights: ${report.analysis.insightsApplied} applied (provider: ${report.analysis.providers.join(', ') || 'none'})`
      : 'Insights: none (deterministic-only — no provider configured or nothing to analyze)',
  ]
  if (report.insights.length > 0) {
    lines.push('', ...report.insights.map(insightLine))
  }
  if (report.augmentedScore.adjustments.length > 0) {
    lines.push('', 'Score adjustments:')
    for (const adjustment of report.augmentedScore.adjustments) {
      lines.push(`  ${adjustment.delta > 0 ? '+' : ''}${adjustment.delta}  ${adjustment.insightId}`)
    }
  }
  return lines.join('\n')
}

/** Markdown rendering, suitable for a PR comment or job summary. */
export const formatAugmentedMarkdown = (report: AugmentedReport): string => {
  const { deterministic, augmented } = report.augmentedScore
  const delta = augmented - deterministic
  const deltaText = delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta}`

  const lines = [
    '# AgentReady Augmented Analysis',
    '',
    `- **Deterministic score:** ${deterministic}`,
    `- **Augmented score:** ${augmented} (${deltaText})`,
    `- **Insights applied:** ${report.analysis.insightsApplied}`,
    `- **Provider:** ${report.analysis.providers.join(', ') || 'none (deterministic-only)'}`,
  ]

  if (report.insights.length > 0) {
    lines.push('', '## Insights', '', '| Kind | Target | Confidence | Verdict |', '|---|---|---|---|')
    for (const insight of report.insights) {
      const target = insight.target ?? '—'
      const confidence = `${Math.round(insight.confidence * 100)}%`
      lines.push(`| ${insight.kind} | ${cell(target)} | ${confidence} | ${cell(insight.verdict)} |`)
    }
  }

  if (report.augmentedScore.adjustments.length > 0) {
    lines.push('', '## Score adjustments', '', '| Δ | Insight |', '|---|---|')
    for (const adjustment of report.augmentedScore.adjustments) {
      lines.push(`| ${adjustment.delta > 0 ? '+' : ''}${adjustment.delta} | ${cell(adjustment.insightId)} |`)
    }
  }

  return lines.join('\n')
}
