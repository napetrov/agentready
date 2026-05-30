import path from 'path'
import { formatScanSarif, scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

const badFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'bad-repo')

describe('SARIF reporter', () => {
  const report = scanLocalReadiness(badFixture, { now: new Date('2026-05-30T00:00:00.000Z') })
  const sarif = formatScanSarif(report)

  it('emits a SARIF 2.1.0 log with the AgentReady driver', () => {
    expect(sarif.version).toBe('2.1.0')
    expect(sarif.$schema).toContain('sarif-2.1.0')
    expect(sarif.runs).toHaveLength(1)
    expect(sarif.runs[0].tool.driver.name).toBe('AgentReady')
  })

  it('emits one result per finding', () => {
    expect(report.findings.length).toBeGreaterThan(0)
    expect(sarif.runs[0].results).toHaveLength(report.findings.length)
  })

  it('collapses instance ids into stable rule keys', () => {
    const rules = sarif.runs[0].tool.driver.rules
    const ruleIds = rules.map(rule => rule.id)
    // Rules are deduplicated and never carry the `:instance` suffix.
    expect(new Set(ruleIds).size).toBe(ruleIds.length)
    for (const id of ruleIds) {
      expect(id).not.toContain(':')
    }
    // Every result references a declared rule.
    for (const result of sarif.runs[0].results) {
      expect(ruleIds).toContain(result.ruleId)
    }
  })

  it('maps severities to SARIF levels and includes file locations', () => {
    const levels = new Set(sarif.runs[0].results.map(result => result.level))
    for (const level of levels) {
      expect(['error', 'warning', 'note']).toContain(level)
    }
    const located = sarif.runs[0].results.filter(result => result.locations)
    const findingsWithPath = report.findings.filter(finding => finding.path)
    expect(located).toHaveLength(findingsWithPath.length)
  })

  it('records the tool version when provided', () => {
    const versioned = formatScanSarif(report, { toolVersion: '9.9.9' })
    expect(versioned.runs[0].tool.driver.version).toBe('9.9.9')
  })
})
