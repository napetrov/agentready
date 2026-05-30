import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { runAction, type ActionInputs } from '../lib/action/run'

const goodFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo')
const badFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'bad-repo')

const baseInputs = (overrides: Partial<ActionInputs>): ActionInputs => ({
  path: goodFixture,
  mode: 'scan',
  failOnSeverity: 'error',
  failOnRegression: false,
  sarif: false,
  outputDir: mkdtempSync(path.join(tmpdir(), 'agentready-action-')),
  ...overrides,
})

describe('runAction (scan mode)', () => {
  const dirs: string[] = []
  const run = (overrides: Partial<ActionInputs>): ReturnType<typeof runAction> => {
    const inputs = baseInputs(overrides)
    dirs.push(inputs.outputDir)
    return runAction(inputs)
  }

  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  })

  it('passes a ready repository and writes report artifacts', () => {
    const result = run({ path: goodFixture })
    expect(result.failed).toBe(false)
    expect(result.score).toBe(100)
    expect(result.findingsCount).toBe(0)
    expect(existsSync(result.jsonReportPath)).toBe(true)
    expect(existsSync(result.markdownReportPath)).toBe(true)
    expect(JSON.parse(readFileSync(result.jsonReportPath, 'utf8')).summary.score).toBe(100)
  })

  it('fails a repository with error-severity findings under the default gate', () => {
    const result = run({ path: badFixture })
    expect(result.failed).toBe(true)
    expect(result.failureReasons.join(' ')).toMatch(/error/)
    expect(result.findingsCount).toBeGreaterThan(0)
  })

  it('respects fail-on-severity=off', () => {
    const result = run({ path: badFixture, failOnSeverity: 'off' })
    expect(result.failed).toBe(false)
  })

  it('enforces a minimum score', () => {
    const result = run({ path: badFixture, failOnSeverity: 'off', minScore: 100 })
    expect(result.failed).toBe(true)
    expect(result.failureReasons.join(' ')).toMatch(/below the minimum/)
  })

  it('writes a SARIF report when requested', () => {
    const result = run({ path: badFixture, failOnSeverity: 'off', sarif: true })
    expect(result.sarifReportPath).toBeDefined()
    expect(existsSync(result.sarifReportPath as string)).toBe(true)
    const sarif = JSON.parse(readFileSync(result.sarifReportPath as string, 'utf8'))
    expect(sarif.version).toBe('2.1.0')
  })

  it('requires base and head refs in diff mode', () => {
    expect(() => run({ mode: 'diff' })).toThrow(/base-ref and head-ref/)
  })
})
