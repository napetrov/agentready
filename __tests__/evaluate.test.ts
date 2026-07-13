import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  buildEvaluationReport,
  scanCorpus,
  type CorpusEntry,
  type CorpusScanResult,
} from '../bin/agentready-evaluate'
import { RULE_CATEGORIES, scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

const fixtureRoot = path.join(__dirname, '..', 'fixtures', 'readiness')
const goodFixture = path.join(fixtureRoot, 'good-repo')
const badFixture = path.join(fixtureRoot, 'bad-repo')

describe('scanCorpus', () => {
  it('scans local-path entries in place without cloning', () => {
    const corpus: CorpusEntry[] = [
      { name: 'good', url: goodFixture, profile: 'AgentReady itself', why: 'test' },
      { name: 'bad', url: badFixture, profile: 'repo with weak/no agent instructions', why: 'test' },
    ]
    const results = scanCorpus(corpus, mkdtempSync(path.join(tmpdir(), 'agentready-eval-work-')))
    expect(results).toHaveLength(2)
    expect(results.every(result => result.report !== undefined)).toBe(true)
    expect(results[0].report?.summary.score).toBe(scanLocalReadiness(goodFixture).summary.score)
  })

  it('captures a scan failure per-entry without aborting the rest', () => {
    const workDir = mkdtempSync(path.join(tmpdir(), 'agentready-eval-work-'))
    const corpus: CorpusEntry[] = [
      { name: 'good', url: goodFixture, profile: 'AgentReady itself', why: 'test' },
      { name: 'missing', url: path.join(workDir, 'does-not-exist'), profile: 'Python package', why: 'test' },
    ]
    const results = scanCorpus(corpus, workDir)
    expect(results[0].report).toBeDefined()
    expect(results[1].report).toBeUndefined()
    expect(results[1].error?.length).toBeGreaterThan(0)
  })
})

describe('buildEvaluationReport', () => {
  const now = '2026-07-13T00:00:00.000Z'

  it('renders the corpus table, category totals, and tracked-summary TODO columns', () => {
    const results: CorpusScanResult[] = scanCorpus(
      [
        { name: 'good', url: goodFixture, profile: 'AgentReady itself', why: 'reference repo' },
        { name: 'bad', url: badFixture, profile: 'repo with weak/no agent instructions', why: 'weak repo' },
      ],
      mkdtempSync(path.join(tmpdir(), 'agentready-eval-work-')),
    )

    const report = buildEvaluationReport(results, now)

    expect(report).toContain('# AgentReady Evaluation: Minimal Public Benchmark')
    expect(report).toContain('| `good` | AgentReady itself | this repo |')
    expect(report).toContain('| `bad` | repo with weak/no agent instructions | this repo |')
    expect(report).toContain('Scanned: 2/2')
    for (const category of RULE_CATEGORIES) {
      expect(report).toContain(`| ${category} |`)
    }
    expect(report).toContain('## Tracked summary')
    expect(report).toContain('TODO: run a bounded coding task and record friction')
    expect(report).toContain('## Confirmed true positives')
    expect(report).toContain('## Missing signals to add next')
    expect(report).not.toContain('## Scan failures')
  })

  it('lists scan failures separately and excludes them from the tracked summary', () => {
    const results: CorpusScanResult[] = [
      { entry: { name: 'good', url: goodFixture, profile: 'AgentReady itself', why: 'x' }, report: scanLocalReadiness(goodFixture) },
      { entry: { name: 'broken', url: 'https://example.invalid/broken.git', profile: 'Python package', why: 'x' }, error: 'clone failed: boom' },
    ]

    const report = buildEvaluationReport(results, now)
    expect(report).toContain('Scanned: 1/2 (failed: broken)')
    expect(report).toContain('## Scan failures')
    expect(report).toContain('- `broken`: clone failed: boom')
    // Only the successfully-scanned repo appears in the tracked summary rows.
    const trackedSummarySection = report.split('## Tracked summary')[1].split('## Confirmed true positives')[0]
    expect(trackedSummarySection).toContain('`good`')
    expect(trackedSummarySection).not.toContain('`broken`')
  })

  it('is a pure function of its inputs (no clock/IO dependency beyond the passed timestamp)', () => {
    const results: CorpusScanResult[] = [
      { entry: { name: 'good', url: goodFixture, profile: 'AgentReady itself', why: 'x' }, report: scanLocalReadiness(goodFixture) },
    ]
    expect(buildEvaluationReport(results, now)).toBe(buildEvaluationReport(results, now))
  })
})

describe('reports/evaluation/corpus.json', () => {
  const corpusPath = path.join(__dirname, '..', 'reports', 'evaluation', 'corpus.json')
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as CorpusEntry[]

  it('defines exactly the 10 profiles from docs/product/evaluation.md', () => {
    expect(corpus).toHaveLength(10)
    const profiles = corpus.map(entry => entry.profile)
    expect(new Set(profiles).size).toBe(10) // every profile is distinct
  })

  it('gives every entry a name, url, profile, and rationale', () => {
    for (const entry of corpus) {
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.url.length).toBeGreaterThan(0)
      expect(entry.profile.length).toBeGreaterThan(0)
      expect(entry.why.length).toBeGreaterThan(0)
    }
    expect(new Set(corpus.map(entry => entry.name)).size).toBe(corpus.length) // unique names
  })

  it('includes AgentReady itself as a local (not cloned) entry', () => {
    const self = corpus.find(entry => entry.profile === 'AgentReady itself')
    expect(self?.url).toBe('.')
  })
})
