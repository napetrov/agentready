import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { remediationAnalyzer } from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

// A minimal repo still yields repo-level findings (e.g. instructions.missing /
// ci.workflow.missing) that are remediable.
const makeRepoWithFindings = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'agentready-rem-'))
  writeFileSync(path.join(root, 'README.md'), '# Demo\n')
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }))
  return root
}

describe('remediation analyzer', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('is applicable whenever there are findings', () => {
    root = makeRepoWithFindings()
    const report = scanLocalReadiness(root)
    expect(report.findings.length).toBeGreaterThan(0)
    expect(remediationAnalyzer.applicable(report)).toBe(true)
  })

  it('is not applicable for a report with no findings', () => {
    root = makeRepoWithFindings()
    const report = { ...scanLocalReadiness(root), findings: [] }
    expect(remediationAnalyzer.applicable(report)).toBe(false)
  })

  it('builds a request listing the findings to remediate', () => {
    root = makeRepoWithFindings()
    const report = scanLocalReadiness(root)
    const request = remediationAnalyzer.buildRequest({
      root,
      report,
      // The helpers are only used to slice files / summarize; stub them.
      sliceFiles: () => ({ text: '', includedPaths: [], droppedPaths: [], bytes: 0 }),
      summarizeEvidence: () => 'summary',
    })
    expect(request).toBeDefined()
    expect(request?.promptVersion).toBe('remediation/v1')
    expect(request?.input).toContain('Findings to remediate:')
    expect(request?.input).toContain(report.findings[0].id)
  })

  it('emits a remediation insight only for real finding ids, deduped, with the steps in the remediation field', () => {
    root = makeRepoWithFindings()
    const report = scanLocalReadiness(root)
    const realId = report.findings[0].id

    const insights = remediationAnalyzer.buildInsights(
      {
        remediations: [
          { findingId: realId, remediation: 'Run `npm init` and add an AGENTS.md.', rationale: 'orient agents', confidence: 0.7 },
          { findingId: realId, remediation: 'duplicate', rationale: 'dup', confidence: 0.9 },
          { findingId: 'totally.made.up', remediation: 'ghost', rationale: 'hallucinated', confidence: 1 },
        ],
      },
      'm@1',
      report,
    )

    expect(insights).toHaveLength(1)
    expect(insights[0].kind).toBe('remediation')
    expect(insights[0].findingId).toBe(realId)
    expect(insights[0].remediation).toBe('Run `npm init` and add an AGENTS.md.')
    // Remediation is advisory — it must not adjust the score.
    expect(insights[0].scoreImpact).toBeUndefined()
  })

  it('drops malformed output (fail-open)', () => {
    root = makeRepoWithFindings()
    const report = scanLocalReadiness(root)
    expect(remediationAnalyzer.buildInsights({ nope: true }, 'm@1', report)).toEqual([])
  })
})
