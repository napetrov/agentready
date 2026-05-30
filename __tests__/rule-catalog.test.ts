import path from 'path'
import {
  RULE_CATALOG,
  formatRuleDoc,
  getRuleDoc,
  listRuleIds,
  ruleKeyFor,
  scanLocalReadiness,
} from '../lib/repo-readiness/local-readiness'

const goodFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo')
const badFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'bad-repo')

describe('rule catalog', () => {
  it('keys every entry by its own id', () => {
    for (const [key, doc] of Object.entries(RULE_CATALOG)) {
      expect(doc.id).toBe(key)
    }
  })

  it('gives every rule a non-empty rationale and at least one remediation step', () => {
    for (const doc of Object.values(RULE_CATALOG)) {
      expect(doc.title.length).toBeGreaterThan(0)
      expect(doc.rationale.length).toBeGreaterThan(0)
      expect(doc.remediation.length).toBeGreaterThan(0)
    }
  })

  it('documents every rule the detectors actually emit', () => {
    // Scanning the fixtures exercises the breadth of built-in checks; every
    // emitted finding must map to a documented rule so `explain` never 404s on
    // something a user can see in a report.
    const emitted = new Set(
      [...scanLocalReadiness(goodFixture).findings, ...scanLocalReadiness(badFixture).findings].map(finding =>
        ruleKeyFor(finding.id),
      ),
    )
    expect(emitted.size).toBeGreaterThan(0)
    for (const ruleId of emitted) {
      expect(RULE_CATALOG[ruleId]).toBeDefined()
    }
  })

  it('resolves docs from both rule ids and instance finding ids', () => {
    expect(getRuleDoc('files.large')?.id).toBe('files.large')
    expect(getRuleDoc('files.large:path/to/blob.bin')?.id).toBe('files.large')
    expect(getRuleDoc('not.a.rule')).toBeUndefined()
  })

  it('renders human-readable text including the rule id and references', () => {
    const text = formatRuleDoc(RULE_CATALOG['docs.readme.missing'])
    expect(text).toContain('docs.readme.missing')
    expect(text).toContain('Why it matters:')
    expect(text).toContain('How to fix:')
  })

  it('listRuleIds returns a sorted, complete list', () => {
    const ids = listRuleIds()
    expect(ids).toEqual([...ids].sort())
    expect(ids).toEqual(Object.keys(RULE_CATALOG).sort())
  })
})
