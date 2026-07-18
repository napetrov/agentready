import {
  formatDiffMarkdown,
  formatScanMarkdown,
  formatScanSarif,
  formatScanSummary,
  NOT_VERIFIED_EXTERNAL_CONTROLS,
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

  it('renders the autonomy envelope when present', () => {
    const report = scanReport([finding({ id: 'docs.readme.missing', severity: 'error' })])
    const withEnvelope: LocalReadinessReport = {
      ...report,
      autonomyEnvelope: [
        { stage: 'orient', status: 'blocked', findingIds: ['docs.readme.missing'] },
        { stage: 'bootstrap', status: 'ready', findingIds: [] },
      ],
    }
    const md = formatScanMarkdown(withEnvelope)
    expect(md).toContain('### Autonomy envelope')
    expect(md).toContain('- orient: ⛔ blocked — docs.readme.missing')
    expect(md).toContain('- bootstrap: ✅ ready')
  })

  it('omits the autonomy envelope section when the field is absent', () => {
    const md = formatScanMarkdown(scanReport([]))
    expect(md).not.toContain('### Autonomy envelope')
  })

  it('always lists the fixed set of controls a local scan cannot verify', () => {
    const md = formatScanMarkdown(scanReport([]))
    expect(md).toContain('### Not verified from repository contents')
    for (const control of NOT_VERIFIED_EXTERNAL_CONTROLS) {
      expect(md).toContain(`- ${control}`)
    }
  })
})

describe('formatScanSummary', () => {
  it('always includes the fixed set of controls a local scan cannot verify', () => {
    const summary = formatScanSummary(scanReport([]))
    for (const control of NOT_VERIFIED_EXTERNAL_CONTROLS) {
      expect(summary).toContain(control)
    }
  })

  it('lists only the not-ready/blocked stages, and omits the line when every stage is ready', () => {
    const report = scanReport([])
    const blocked: LocalReadinessReport = {
      ...report,
      autonomyEnvelope: [
        { stage: 'orient', status: 'blocked', findingIds: ['docs.readme.missing'] },
        { stage: 'bootstrap', status: 'not_yet_ready', findingIds: ['commands.reference.npm-script:x'] },
        { stage: 'edit', status: 'ready', findingIds: [] },
      ],
    }
    expect(formatScanSummary(blocked)).toContain('Autonomy: orient (blocked), bootstrap (not yet ready)')

    const allReady: LocalReadinessReport = {
      ...report,
      autonomyEnvelope: [{ stage: 'orient', status: 'ready', findingIds: [] }],
    }
    expect(formatScanSummary(allReady)).not.toContain('Autonomy:')
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
    expect(md).toContain('⚠️ 1 regression(s), 1 new finding(s).')
  })

  it('shows a negative delta and the empty-findings state', () => {
    const md = formatDiffMarkdown(diffReport({ scoreDelta: -7 }, []))
    expect(md).toContain('Score delta: **-7**')
    expect(md).toContain('No findings.')
    expect(md).toContain('✅ No readiness regressions.')
  })
})
