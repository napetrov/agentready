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
  it('rejects unknown keys so runtime parsing matches the JSON Schema', () => {
    const report = scanLocalReadiness(path.join(repoRoot, 'fixtures', 'readiness', 'good-repo'), {
      now: new Date('2026-05-30T00:00:00.000Z'),
    })
    expect(localReadinessReportSchema.safeParse(report).success).toBe(true)
    expect(localReadinessReportSchema.safeParse({ ...report, surprise: true }).success).toBe(false)
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
