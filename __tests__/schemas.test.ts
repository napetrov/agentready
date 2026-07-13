import { execFileSync } from 'child_process'
import path from 'path'
import { z } from 'zod'
import {
  localReadinessConfigSchema,
  localReadinessReportSchema,
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
})
