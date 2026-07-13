import path from 'path'
import {
  RULE_CATALOG,
  RULE_CATEGORIES,
  calculateDimensionScores,
  formatRuleDoc,
  getRuleDoc,
  listRuleIds,
  ruleKeyFor,
  scanLocalReadiness,
} from '../lib/repo-readiness/local-readiness'
import type { ReadinessFinding } from '../lib/repo-readiness/local-readiness'

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

const finding = (id: string, severity: ReadinessFinding['severity']): ReadinessFinding => ({
  id,
  title: 'title',
  severity,
  recommendation: 'do the thing',
})

describe('calculateDimensionScores', () => {
  it('returns one entry per category, in RULE_CATEGORIES order, scored 100 with no findings', () => {
    const dimensions = calculateDimensionScores([])
    expect(dimensions.map(dimension => dimension.category)).toEqual(RULE_CATEGORIES)
    for (const dimension of dimensions) {
      expect(dimension.score).toBe(100)
      expect(dimension.findingCount).toBe(0)
      expect(dimension.bySeverity).toEqual({ info: 0, warning: 0, error: 0 })
    }
  })

  it('scopes a penalty to only the category the finding belongs to', () => {
    const dimensions = calculateDimensionScores([finding('commands.test.missing', 'error')])
    const byCategory = new Map(dimensions.map(dimension => [dimension.category, dimension]))
    expect(byCategory.get('commands')?.score).toBe(82) // 100 - the 18-point error penalty
    expect(byCategory.get('commands')?.findingCount).toBe(1)
    expect(byCategory.get('commands')?.bySeverity).toEqual({ info: 0, warning: 0, error: 1 })
    for (const category of RULE_CATEGORIES.filter(category => category !== 'commands')) {
      expect(byCategory.get(category)?.score).toBe(100)
      expect(byCategory.get(category)?.findingCount).toBe(0)
    }
  })

  it('resolves instance finding ids (rule:instance) to their rule category', () => {
    const dimensions = calculateDimensionScores([finding('files.large:big.bin', 'warning')])
    const files = dimensions.find(dimension => dimension.category === 'files')
    expect(files?.findingCount).toBe(1)
    expect(files?.bySeverity.warning).toBe(1)
  })

  it('ignores findings whose rule id is not in the catalog rather than throwing', () => {
    expect(() => calculateDimensionScores([finding('not.a.rule', 'error')])).not.toThrow()
    const dimensions = calculateDimensionScores([finding('not.a.rule', 'error')])
    expect(dimensions.reduce((total, dimension) => total + dimension.findingCount, 0)).toBe(0)
  })

  it('every dimension bySeverity count sums to findingCount, and every findingCount sums to the input length on real fixtures', () => {
    for (const fixture of [goodFixture, badFixture]) {
      const report = scanLocalReadiness(fixture)
      const total = report.dimensions.reduce((sum, dimension) => sum + dimension.findingCount, 0)
      expect(total).toBe(report.findings.length)
      for (const dimension of report.dimensions) {
        const severitySum = dimension.bySeverity.info + dimension.bySeverity.warning + dimension.bySeverity.error
        expect(severitySum).toBe(dimension.findingCount)
        expect(dimension.score).toBeGreaterThanOrEqual(0)
        expect(dimension.score).toBeLessThanOrEqual(100)
      }
    }
  })
})
