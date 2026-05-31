import {
  formatDiffMarkdown,
  formatScanMarkdown,
  formatScanSarif,
} from '../lib/repo-readiness/local-readiness'
import type {
  LocalReadinessReport,
  ReadinessDiffReport,
  ReadinessFinding,
} from '../lib/repo-readiness/core/types'

// Branch coverage for the SARIF and Markdown reporters: every severity→level
// mapping, findings with and without a path/recommendation, the empty-findings
// state, and the score-delta sign in the diff renderer.

const finding = (overrides: Partial<ReadinessFinding>): ReadinessFinding => ({
  id: 'rule.x:inst',
  title: 'Title',
  severity: 'warning',
  recommendation: 'Do the thing.',
  ...overrides,
})

const scanReport = (findings: ReadinessFinding[]): LocalReadinessReport =>
  ({
    summary: { score: 60, totalFiles: 3, sourceFiles: 1, testFiles: 1, documentationFiles: 1 },
    capabilities: [],
    safetySignals: [],
    ci: {
      workflowFiles: [],
      workflows: [],
      hasInstall: false,
      hasLint: false,
      hasTypeCheck: false,
      hasTest: false,
      hasBuild: false,
    },
    findings,
  }) as unknown as LocalReadinessReport

describe('formatScanSarif', () => {
  it('maps every severity to a SARIF level and emits locations only for path-bearing findings', () => {
    const sarif = formatScanSarif(
      scanReport([
        finding({ id: 'files.large:a.bin', severity: 'error', path: 'a.bin' }),
        finding({ id: 'commands.test.missing', severity: 'warning', recommendation: '' }), // no path, no recommendation
        finding({ id: 'docs.note:x', severity: 'info', path: 'x.md' }),
      ]),
      { toolVersion: '9.9.9' },
    )
    const run = sarif.runs[0]
    expect(run.tool.driver.version).toBe('9.9.9')
    expect(run.results.map(r => r.level).sort()).toEqual(['error', 'note', 'warning'])
    // Two of the three findings carry a path → two results have locations.
    expect(run.results.filter(r => r.locations).length).toBe(2)
    // The no-recommendation finding still produces a message ending in a period.
    const warningResult = run.results.find(r => r.ruleId === 'commands.test.missing')
    expect(warningResult?.message.text).toBe('Title.')
  })
})

describe('formatScanMarkdown', () => {
  it('renders the no-findings state and appends recommendations/locations when present', () => {
    const empty = formatScanMarkdown(scanReport([]))
    expect(empty).toContain('No findings.')
    expect(empty).toContain('CI: no workflows detected')

    const md = formatScanMarkdown(scanReport([finding({ severity: 'error', path: 'src/a.ts', recommendation: 'Fix it.' })]))
    expect(md).toContain('**ERROR**: Title (src/a.ts). Fix it.')
  })
})

describe('formatDiffMarkdown', () => {
  const diffReport = (overrides: Partial<ReadinessDiffReport['summary']>, findings: ReadinessFinding[]): ReadinessDiffReport =>
    ({
      base: 'main',
      head: 'HEAD',
      summary: { scoreDelta: 0, newFindings: 0, resolvedFindings: 0, ...overrides },
      regressions: findings,
      newFindings: findings,
    }) as unknown as ReadinessDiffReport

  it('shows a signed positive/zero delta and lists regressions', () => {
    const md = formatDiffMarkdown(diffReport({ scoreDelta: 5 }, [finding({ severity: 'error', path: 'p.ts' })]))
    expect(md).toContain('Score delta: **+5**')
    expect(md).toContain('**ERROR**: Title (p.ts).')
  })

  it('shows a negative delta and the empty-findings state', () => {
    const md = formatDiffMarkdown(diffReport({ scoreDelta: -7 }, []))
    expect(md).toContain('Score delta: **-7**')
    expect(md).toContain('No findings.')
  })
})
