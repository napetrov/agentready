import { execFileSync } from 'child_process'
import path from 'path'
import { z } from 'zod'
import {
  localReadinessConfigSchema,
  localReadinessReportSchema,
} from '../lib/repo-readiness/local-readiness'

const repoRoot = path.join(__dirname, '..')

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

describe('JSON Schema generation', () => {
  it('produces a draft-07 object schema for reports', () => {
    const jsonSchema = z.toJSONSchema(localReadinessReportSchema, { target: 'draft-7' }) as Record<string, unknown>
    expect(jsonSchema.type).toBe('object')
    expect(jsonSchema.properties).toHaveProperty('findings')
  })

  it('keeps committed schemas in sync with the source schemas', () => {
    // Mirrors the CI drift gate so a stale schemas/ directory fails locally too.
    expect(() =>
      execFileSync('npx', ['tsx', 'bin/agentready-emit-schemas.ts', '--check'], {
        cwd: repoRoot,
        stdio: 'pipe',
      }),
    ).not.toThrow()
  })
})
