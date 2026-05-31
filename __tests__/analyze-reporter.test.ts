import path from 'path'
import {
  formatAugmentedMarkdown,
  formatAugmentedSummary,
  type AugmentedReport,
  type LlmInsight,
} from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

// Branch coverage for the augmented-report renderers: the score-delta sign
// (positive / negative / none), insights with and without a `target`, the
// adjustments section, and the empty-providers label.

const baseReport = scanLocalReadiness(path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo'), {
  now: new Date('2026-05-30T00:00:00.000Z'),
})

const insight = (overrides: Partial<LlmInsight>): LlmInsight => ({
  id: 'analysis.x:1',
  kind: 'quality',
  verdict: 'v',
  confidence: 0.5,
  rationale: 'r',
  model: 'm@1',
  promptVersion: 'p/v1',
  ...overrides,
})

const report = (overrides: Partial<AugmentedReport>): AugmentedReport => ({
  baseReport,
  generatedAt: '2026-05-30T00:00:00.000Z',
  insights: [],
  augmentedScore: { deterministic: 80, augmented: 80, adjustments: [] },
  analysis: { enabled: true, providers: ['p'], insightsConsidered: 0, insightsApplied: 0 },
  ...overrides,
})

describe('augmented reporters — branches', () => {
  it('renders a positive delta, an insight without a target, and the adjustments section', () => {
    const r = report({
      insights: [insight({ id: 'analysis.fp:1', kind: 'false-positive', target: undefined })],
      augmentedScore: { deterministic: 80, augmented: 83, adjustments: [{ insightId: 'analysis.fp:1', delta: 3 }] },
    })
    const summary = formatAugmentedSummary(r)
    expect(summary).toContain('(+3)') // positive delta
    expect(summary).toContain('Score adjustments:')

    const md = formatAugmentedMarkdown(r)
    expect(md).toContain('(+3)')
    expect(md).toContain('| false-positive | — |') // missing target rendered as em dash
    expect(md).toContain('## Score adjustments')
  })

  it('renders a negative delta with a targeted insight', () => {
    const r = report({
      insights: [insight({ target: 'AGENTS.md' })],
      augmentedScore: { deterministic: 80, augmented: 74, adjustments: [{ insightId: 'analysis.x:1', delta: -6 }] },
    })
    expect(formatAugmentedSummary(r)).toContain('(-6)')
    expect(formatAugmentedMarkdown(r)).toContain('| quality | AGENTS.md |')
  })

  it('labels a deterministic-only run with no provider and no change', () => {
    const r = report({ analysis: { enabled: false, providers: [], insightsConsidered: 0, insightsApplied: 0 } })
    const summary = formatAugmentedSummary(r)
    expect(summary).toContain('no change')
    expect(summary).toContain('deterministic-only')
    expect(formatAugmentedMarkdown(r)).toContain('none (deterministic-only)')
  })
})
