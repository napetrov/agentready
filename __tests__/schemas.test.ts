import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import {
  localReadinessConfigSchema,
  localReadinessReportSchema,
  readinessRuleCategorySchema,
  scanLocalReadiness,
} from '../lib/repo-readiness/local-readiness'

const repoRoot = path.join(__dirname, '..')
const tsxBin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
)

describe('config schema', () => {
  it('accepts a valid partial config', () => {
    const result = localReadinessConfigSchema.safeParse({ ignorePaths: ['dist/**'], allowMinifiedFiles: true })
    expect(result.success).toBe(true)
  })

  it('accepts an empty config', () => {
    expect(localReadinessConfigSchema.safeParse({}).success).toBe(true)
  })

  it('rejects unknown keys', () => {
    const result = localReadinessConfigSchema.safeParse({ bogus: 1 })
    expect(result.success).toBe(false)
  })

  it('rejects a non-array ignorePaths with a readable message', () => {
    const result = localReadinessConfigSchema.safeParse({ ignorePaths: 'dist/**' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('must be an array of strings')
    }
  })

  it('rejects negative byte thresholds', () => {
    expect(localReadinessConfigSchema.safeParse({ largeFileWarningBytes: -1 }).success).toBe(false)
  })
})

describe('report schema strictness', () => {
  const validReport = () =>
    scanLocalReadiness(path.join(repoRoot, 'fixtures', 'readiness', 'good-repo'), {
      now: new Date('2026-05-30T00:00:00.000Z'),
    })

  it('rejects unknown keys so runtime parsing matches the JSON Schema', () => {
    const report = validReport()
    expect(localReadinessReportSchema.safeParse(report).success).toBe(true)
    expect(localReadinessReportSchema.safeParse({ ...report, surprise: true }).success).toBe(false)
  })

  it('rejects a dimensions array of the wrong length', () => {
    const report = validReport()
    expect(localReadinessReportSchema.safeParse({ ...report, dimensions: [] }).success).toBe(false)
    expect(localReadinessReportSchema.safeParse({ ...report, dimensions: [report.dimensions[0]] }).success).toBe(
      false,
    )
  })

  it('rejects a same-length dimensions array that duplicates a category instead of covering all six', () => {
    const report = validReport()
    // Same length (6) as a valid report, but the last entry's category is
    // overwritten with the first's, so one category repeats and another is
    // missing entirely — the case a bare `.length(6)` check would miss.
    const withDuplicateCategory = [
      ...report.dimensions.slice(0, -1),
      { ...report.dimensions[report.dimensions.length - 1], category: report.dimensions[0].category },
    ]
    expect(withDuplicateCategory).toHaveLength(report.dimensions.length)
    expect(localReadinessReportSchema.safeParse({ ...report, dimensions: withDuplicateCategory }).success).toBe(
      false,
    )
  })

  it('rejects a dimension score outside 0-100 or a negative finding count', () => {
    const report = validReport()
    const [first, ...rest] = report.dimensions
    expect(
      localReadinessReportSchema.safeParse({ ...report, dimensions: [{ ...first, score: 101 }, ...rest] }).success,
    ).toBe(false)
    expect(
      localReadinessReportSchema.safeParse({ ...report, dimensions: [{ ...first, findingCount: -1 }, ...rest] })
        .success,
    ).toBe(false)
  })
})

describe('JSON Schema generation', () => {
  it('produces a draft-07 object schema for reports', () => {
    const jsonSchema = z.toJSONSchema(localReadinessReportSchema, { target: 'draft-7' }) as Record<string, unknown>
    expect(jsonSchema.type).toBe('object')
    expect(jsonSchema.properties).toHaveProperty('findings')
  })

  it('keeps committed schemas in sync with the source schemas', () => {
    // Mirrors the CI drift gate so a stale schemas/ directory fails locally too.
    expect(() =>
      execFileSync(tsxBin, ['bin/agentready-emit-schemas.ts', '--check'], {
        cwd: repoRoot,
        stdio: 'pipe',
      }),
    ).not.toThrow()
  })

  // draft-7 JSON Schema has no `minContains`/`maxContains` (2019-09+), so the
  // runtime Zod `.refine()` that rejects a duplicated/missing dimensions
  // category can't be translated directly. bin/agentready-emit-schemas.ts
  // works around this with a `contains`-per-category `allOf`, which combined
  // with the array's `minItems`/`maxItems: 6` forces (by pigeonhole) each
  // category to appear exactly once. Assert that workaround made it into the
  // committed artifact a real external consumer (CI, an editor) would load —
  // the previous test only proves the file is in sync with the generator, not
  // that the generator still emits this specific constraint.
  const dimensionsContainsClauses = (dimensionsSchema: unknown): string[] => {
    const schema = dimensionsSchema as { minItems?: number; maxItems?: number; allOf?: unknown[] }
    expect(schema.minItems).toBe(6)
    expect(schema.maxItems).toBe(6)
    return (schema.allOf ?? []).map(clause => {
      const contains = (clause as { contains?: { properties?: { category?: { const?: string } } } }).contains
      const category = contains?.properties?.category?.const
      expect(typeof category).toBe('string')
      return category as string
    })
  }

  it('local-readiness-report.schema.json requires every dimension category exactly once', () => {
    const schema = JSON.parse(readFileSync(path.join(repoRoot, 'schemas', 'local-readiness-report.schema.json'), 'utf8'))
    const categories = dimensionsContainsClauses(schema.properties.dimensions)
    expect(categories.sort()).toEqual([...readinessRuleCategorySchema.options].sort())
  })

  it('readiness-diff-report.schema.json requires it for both baseReport and headReport', () => {
    const schema = JSON.parse(readFileSync(path.join(repoRoot, 'schemas', 'readiness-diff-report.schema.json'), 'utf8'))
    for (const side of ['baseReport', 'headReport']) {
      const categories = dimensionsContainsClauses(schema.properties[side].properties.dimensions)
      expect(categories.sort()).toEqual([...readinessRuleCategorySchema.options].sort())
    }
  })
})
