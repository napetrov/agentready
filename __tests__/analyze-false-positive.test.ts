import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { falsePositiveAnalyzer } from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

// A repo with a large checked-in file produces a path-bearing finding to triage.
const makeRepoWithLargeFile = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'agentready-fp-'))
  writeFileSync(path.join(root, 'README.md'), '# Demo\n')
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }))
  // Tight thresholds so a small fixture file trips files.large.
  writeFileSync(path.join(root, '.agentready.json'), JSON.stringify({ largeFileWarningBytes: 50, largeFileErrorBytes: 100000 }))
  writeFileSync(path.join(root, 'fixtures-data.bin'), 'x'.repeat(200))
  return root
}

describe('false-positive analyzer', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('is applicable when there are path-bearing findings', () => {
    root = makeRepoWithLargeFile()
    const report = scanLocalReadiness(root)
    expect(report.findings.some(f => f.path)).toBe(true)
    expect(falsePositiveAnalyzer.applicable(report)).toBe(true)
  })

  it('is not applicable without path-bearing findings', () => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-fp-none-'))
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm test.\n')
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest', lint: 'eslint .' } }))
    const report = scanLocalReadiness(root)
    // This repo yields only repo-level findings (e.g. ci.workflow.missing), none
    // of which carry a path, so there is nothing for the analyzer to triage.
    expect(report.findings.some(f => f.path)).toBe(false)
    expect(falsePositiveAnalyzer.applicable(report)).toBe(false)
  })

  it('emits a false-positive insight only for a real finding id flagged true', () => {
    root = makeRepoWithLargeFile()
    const report = scanLocalReadiness(root)
    const realId = report.findings.find(f => f.path)?.id as string

    const insights = falsePositiveAnalyzer.buildInsights(
      {
        assessments: [
          { findingId: realId, likelyFalsePositive: true, confidence: 0.8, rationale: 'intentional fixture data' },
          { findingId: realId, likelyFalsePositive: false, confidence: 0.9, rationale: 'real issue' },
          { findingId: 'files.large:ghost', likelyFalsePositive: true, confidence: 1, rationale: 'hallucinated' },
        ],
      },
      'm@1',
      report,
    )

    expect(insights).toHaveLength(1)
    expect(insights[0].kind).toBe('false-positive')
    expect(insights[0].findingId).toBe(realId)
    expect(insights[0].scoreImpact).toBe(3)
  })

  it('drops malformed output (fail-open)', () => {
    root = makeRepoWithLargeFile()
    const report = scanLocalReadiness(root)
    expect(falsePositiveAnalyzer.buildInsights({ nope: true }, 'm@1', report)).toEqual([])
  })
})
