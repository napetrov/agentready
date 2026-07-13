import path from 'path'
import {
  evaluateScanGate,
  meetsThreshold,
  scanLocalReadiness,
  type LocalReadinessReport,
  type PolicyPack,
  type ReadinessDiffReport,
  type ReadinessFinding,
} from '../lib/repo-readiness/local-readiness'
import { evaluateDiffGate } from '../lib/repo-readiness/core/gate'

const goodFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo')
const badFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'bad-repo')

const goodReport = scanLocalReadiness(goodFixture)
const badReport = scanLocalReadiness(badFixture)

describe('meetsThreshold', () => {
  it('never trips when the threshold is off', () => {
    expect(meetsThreshold('error', 'off')).toBe(false)
  })

  it('trips at or above the configured severity', () => {
    expect(meetsThreshold('warning', 'warning')).toBe(true)
    expect(meetsThreshold('error', 'warning')).toBe(true)
    expect(meetsThreshold('info', 'warning')).toBe(false)
  })
})

describe('evaluateScanGate', () => {
  it('passes a clean report under the default error gate', () => {
    const gate = evaluateScanGate(goodReport)
    expect(gate.failed).toBe(false)
    expect(gate.failureReasons).toHaveLength(0)
  })

  it('fails a report with error-severity findings under the default gate', () => {
    expect(badReport.findings.some(finding => finding.severity === 'error')).toBe(true)
    const gate = evaluateScanGate(badReport)
    expect(gate.failed).toBe(true)
    expect(gate.failureReasons.join(' ')).toMatch(/at or above "error"/)
  })

  it('respects fail-on-severity=off', () => {
    expect(evaluateScanGate(badReport, { failOnSeverity: 'off' }).failed).toBe(false)
  })

  it('enforces a minimum score independently of severity', () => {
    const gate = evaluateScanGate(badReport, { failOnSeverity: 'off', minScore: 100 })
    expect(gate.failed).toBe(true)
    expect(gate.failureReasons.join(' ')).toMatch(/below the minimum 100/)
  })

  it('passes when the score meets the minimum', () => {
    expect(evaluateScanGate(goodReport, { minScore: goodReport.summary.score }).failed).toBe(false)
  })
})

describe('evaluateDiffGate', () => {
  const finding = (severity: ReadinessFinding['severity']): ReadinessFinding => ({
    id: `rule:${severity}`,
    severity,
    title: `${severity} finding`,
    recommendation: 'synthetic',
  })

  const diffReport = (overrides: Partial<ReadinessDiffReport>): ReadinessDiffReport =>
    ({
      newFindings: [],
      resolvedFindings: [],
      regressions: [],
      headReport: { summary: { score: 100 } } as LocalReadinessReport,
      ...overrides,
    } as ReadinessDiffReport)

  it('passes when nothing regressed and no new findings exist', () => {
    expect(evaluateDiffGate(diffReport({})).failed).toBe(false)
  })

  it('fails on new error-severity findings under the default gate', () => {
    const gate = evaluateDiffGate(diffReport({ newFindings: [finding('error')] }))
    expect(gate.failed).toBe(true)
    expect(gate.failureReasons.join(' ')).toMatch(/new finding\(s\) at or above "error"/)
  })

  it('fails on regressions only when fail-on-regression is set', () => {
    const report = diffReport({ regressions: [finding('warning')] })
    expect(evaluateDiffGate(report, { failOnSeverity: 'off' }).failed).toBe(false)
    const gate = evaluateDiffGate(report, { failOnSeverity: 'off', failOnRegression: true })
    expect(gate.failed).toBe(true)
    expect(gate.failureReasons.join(' ')).toMatch(/regression\(s\) introduced/)
  })

  it('gates on the head score against min-score', () => {
    const report = diffReport({ headReport: { summary: { score: 50 } } as LocalReadinessReport })
    expect(evaluateDiffGate(report, { minScore: 80 }).failed).toBe(true)
  })

  it('recomputes regressions against policy-adjusted severities, not the raw regression set', () => {
    // A new info-severity finding is invisible to the raw `regressions` field
    // (only warning/error are gateable), but a policy that escalates it to
    // warning must still be able to fail --fail-on-regression.
    const newInfoFinding = finding('info')
    const escalatingPolicy: PolicyPack = {
      name: 'enterprise',
      description: 'test policy',
      adjust: f => (f.id === newInfoFinding.id ? { to: 'warning', reason: 'test escalation' } : undefined),
    }
    const report = diffReport({
      baseReport: { findings: [] } as unknown as LocalReadinessReport,
      headReport: { findings: [newInfoFinding], summary: { score: 100 } } as LocalReadinessReport,
      regressions: [],
    })

    expect(evaluateDiffGate(report, { failOnSeverity: 'off', failOnRegression: true }).failed).toBe(false)
    const gate = evaluateDiffGate(report, { failOnSeverity: 'off', failOnRegression: true, policy: escalatingPolicy })
    expect(gate.failed).toBe(true)
    expect(gate.failureReasons.join(' ')).toMatch(/regression\(s\) introduced/)
  })
})
