import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  DEFAULT_POLICY,
  ENTERPRISE_POLICY,
  POLICY_NAMES,
  POLICY_PACKS,
  adjustFindings,
  applyPolicy,
  evaluateDiffGate,
  evaluateScanGate,
  resolvePolicyPack,
  scanLocalReadiness,
  type ReadinessFinding,
} from '../lib/repo-readiness/local-readiness'

const finding = (id: string, severity: ReadinessFinding['severity']): ReadinessFinding => ({
  id,
  title: 'title',
  severity,
  recommendation: 'do the thing',
})

describe('DEFAULT_POLICY', () => {
  it('is a no-op: no adjustments, findings returned unchanged', () => {
    const findings = [finding('instructions.missing', 'warning'), finding('safety.deploy', 'info')]
    const { adjustedFindings, severityAdjustments } = adjustFindings(findings, DEFAULT_POLICY)
    expect(adjustedFindings).toEqual(findings)
    expect(severityAdjustments).toEqual([])
  })
})

describe('ENTERPRISE_POLICY', () => {
  it('escalates instructions.missing to error', () => {
    const { adjustedFindings, severityAdjustments } = adjustFindings([finding('instructions.missing', 'warning')], ENTERPRISE_POLICY)
    expect(adjustedFindings[0].severity).toBe('error')
    expect(severityAdjustments).toEqual([
      { findingId: 'instructions.missing', from: 'warning', to: 'error', reason: expect.any(String) },
    ])
  })

  it('escalates safety.install-hook and safety.deploy instances to warning', () => {
    const findings = [
      finding('safety.install-hook:package.json#scripts.postinstall', 'info'),
      finding('safety.deploy:package.json#scripts.release', 'info'),
    ]
    const { adjustedFindings } = adjustFindings(findings, ENTERPRISE_POLICY)
    expect(adjustedFindings.map(f => f.severity)).toEqual(['warning', 'warning'])
  })

  it('escalates a high-risk capability-surface instance to warning', () => {
    const { adjustedFindings, severityAdjustments } = adjustFindings(
      [finding('safety.capability.high-risk:.mcp.json', 'info')],
      ENTERPRISE_POLICY,
    )
    expect(adjustedFindings[0].severity).toBe('warning')
    expect(severityAdjustments).toEqual([
      { findingId: 'safety.capability.high-risk:.mcp.json', from: 'info', to: 'warning', reason: expect.any(String) },
    ])
  })

  it('does not adjust findings outside its rule list', () => {
    const findings = [finding('files.large:a.bin', 'warning'), finding('docs.readme.missing', 'error')]
    const { adjustedFindings, severityAdjustments } = adjustFindings(findings, ENTERPRISE_POLICY)
    expect(adjustedFindings).toEqual(findings)
    expect(severityAdjustments).toEqual([])
  })

  it('never de-escalates: leaves an already-error finding at error', () => {
    const { adjustedFindings, severityAdjustments } = adjustFindings([finding('instructions.missing', 'error')], ENTERPRISE_POLICY)
    expect(adjustedFindings[0].severity).toBe('error')
    expect(severityAdjustments).toEqual([]) // "to" already equals current severity, so no-op
  })
})

describe('resolvePolicyPack', () => {
  it('resolves every documented policy name', () => {
    for (const name of POLICY_NAMES) {
      expect(resolvePolicyPack(name)).toBe(POLICY_PACKS[name])
    }
  })

  it('returns undefined for an unrecognized name', () => {
    expect(resolvePolicyPack('bogus')).toBeUndefined()
  })
})

describe('applyPolicy', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-policy-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): void => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  it('lowers effectiveScore relative to the raw score when a rule escalates, and reports why', () => {
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest', lint: 'eslint .' } }))
    write('src/index.ts', 'export const x = 1\n')
    // No AGENTS.md/instruction file, so `instructions.missing` (default: warning) fires.
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    expect(report.findings.some(f => f.id === 'instructions.missing')).toBe(true)

    const policyResult = applyPolicy(report, ENTERPRISE_POLICY)
    expect(policyResult.policy).toBe('enterprise')
    expect(policyResult.effectiveScore).toBeLessThan(report.summary.score)
    expect(policyResult.severityAdjustments).toEqual(
      expect.arrayContaining([expect.objectContaining({ findingId: 'instructions.missing', from: 'warning', to: 'error' })]),
    )
    expect(policyResult.effectiveThresholds['instructions.missing']).toBe('error')
    // Raw evidence is untouched.
    expect(report.findings.find(f => f.id === 'instructions.missing')?.severity).toBe('warning')
  })

  it('matches the raw report under the default policy', () => {
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest', lint: 'eslint .' } }))
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    const policyResult = applyPolicy(report, DEFAULT_POLICY)
    expect(policyResult.effectiveScore).toBe(report.summary.score)
    expect(policyResult.severityAdjustments).toEqual([])
  })
})

describe('policy-adjusted gating', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-policy-gate-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): void => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  it('evaluateScanGate fails under --fail-on error with the enterprise policy but not the default policy', () => {
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest', lint: 'eslint .' } }))
    write('README.md', '# demo\n')
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    // Confirm the only error-severity escalation comes from the enterprise
    // policy's instructions.missing rule, not an unrelated baseline finding.
    expect(report.findings.some(f => f.severity === 'error')).toBe(false)

    expect(evaluateScanGate(report, { failOnSeverity: 'error' }).failed).toBe(false)
    const enterpriseGate = evaluateScanGate(report, { failOnSeverity: 'error', policy: ENTERPRISE_POLICY })
    expect(enterpriseGate.failed).toBe(true)
    expect(enterpriseGate.failureReasons[0]).toContain('error')
  })

  it('evaluateDiffGate applies the policy to new findings and the head score', () => {
    const baseRoot = mkdtempSync(path.join(tmpdir(), 'agentready-policy-diff-base-'))
    try {
      const baseReport = scanLocalReadiness(baseRoot, { now: new Date('2026-05-30T00:00:00.000Z') })
      write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest', lint: 'eslint .' } }))
      const headReport = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })

      const diffReport = {
        base: 'base',
        head: 'head',
        generatedAt: '2026-05-30T00:00:00.000Z',
        baseReport,
        headReport,
        summary: {
          scoreDelta: headReport.summary.score - baseReport.summary.score,
          filesDelta: 0,
          bytesDelta: 0,
          findingsDelta: 0,
          newFindings: 0,
          resolvedFindings: 0,
        },
        newFindings: headReport.findings.filter(f => f.id === 'instructions.missing'),
        resolvedFindings: [],
        regressions: [],
      }

      expect(evaluateDiffGate(diffReport, { failOnSeverity: 'error' }).failed).toBe(false)
      expect(evaluateDiffGate(diffReport, { failOnSeverity: 'error', policy: ENTERPRISE_POLICY }).failed).toBe(true)
    } finally {
      rmSync(baseRoot, { recursive: true, force: true })
    }
  })
})
