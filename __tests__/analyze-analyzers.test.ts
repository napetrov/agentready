import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  contradictionAnalyzer,
  falsePositiveAnalyzer,
  instructionQualityAnalyzer,
  type LlmRequest,
  type Runner,
  type RunOutcome,
} from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

// These exercise the analyzers' `run()` host-delegated orchestration end-to-end
// (buildRequest → runner → buildInsights), which the existing tests only cover
// through the pure `buildInsights` helper. A stub Runner stands in for the
// fail-open provider spine so no model is called.

/** A Runner that returns canned output and records the requests it received. */
const stubRunner = (output: unknown, opts: { model?: string; seen?: LlmRequest[] } = {}): Runner => ({
  providerId: 'stub',
  async run(request: LlmRequest): Promise<RunOutcome> {
    opts.seen?.push(request)
    return { output, model: opts.model ?? 'stub@1', cached: false, skipped: false }
  },
})

/** A Runner that fails open (no output) — e.g. budget exhausted or call failed. */
const emptyRunner = (): Runner => ({
  providerId: 'stub',
  async run(): Promise<RunOutcome> {
    return { cached: false, skipped: true }
  },
})

const tmp = (prefix: string): string => mkdtempSync(path.join(tmpdir(), prefix))

const makeInstructionRepo = (files: Record<string, string>): string => {
  const root = tmp('agentready-an-')
  writeFileSync(path.join(root, 'README.md'), '# Demo\n')
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }))
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(root, name), content)
  return root
}

const makeLargeFileRepo = (): string => {
  const root = tmp('agentready-an-fp-')
  writeFileSync(path.join(root, 'README.md'), '# Demo\n')
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }))
  writeFileSync(path.join(root, '.agentready.json'), JSON.stringify({ largeFileWarningBytes: 50, largeFileErrorBytes: 100000 }))
  writeFileSync(path.join(root, 'fixtures-data.bin'), 'x'.repeat(200))
  return root
}

describe('instructionQualityAnalyzer.run', () => {
  let root: string
  afterEach(() => root && rmSync(root, { recursive: true, force: true }))

  it('builds a request from the instruction surface and folds the model output', async () => {
    root = makeInstructionRepo({ 'AGENTS.md': '# AGENTS\n' })
    const report = scanLocalReadiness(root)
    const seen: LlmRequest[] = []
    const runner = stubRunner({ assessments: [{ path: 'AGENTS.md', actionable: false, confidence: 0.8, rationale: 'vague', missing: ['commands'] }] }, { seen })

    const insights = await instructionQualityAnalyzer.run({ root, report, runner })

    expect(seen).toHaveLength(1)
    expect(seen[0].task).toBe('triage')
    expect(seen[0].input).toContain('AGENTS.md')
    expect(insights).toHaveLength(1)
    expect(insights[0].target).toBe('AGENTS.md')
    expect(insights[0].scoreImpact).toBe(-5)
    expect(insights[0].model).toBe('stub@1')
  })

  it('returns [] when the runner produces no output (fail-open)', async () => {
    root = makeInstructionRepo({ 'AGENTS.md': '# AGENTS\n' })
    const report = scanLocalReadiness(root)
    expect(await instructionQualityAnalyzer.run({ root, report, runner: emptyRunner() })).toEqual([])
  })

  it('returns [] without building a request when there is no instruction surface', async () => {
    root = tmp('agentready-an-noinstr-')
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    const report = scanLocalReadiness(root)
    const seen: LlmRequest[] = []
    const insights = await instructionQualityAnalyzer.run({ root, report, runner: stubRunner({ assessments: [] }, { seen }) })
    expect(insights).toEqual([])
    expect(seen).toEqual([]) // no request was ever issued
  })
})

describe('contradictionAnalyzer.run', () => {
  let root: string
  afterEach(() => root && rmSync(root, { recursive: true, force: true }))

  it('folds a contradiction reported over two real instruction files', async () => {
    root = makeInstructionRepo({ 'AGENTS.md': 'use npm\n', '.cursorrules': 'use yarn\n' })
    const report = scanLocalReadiness(root)
    const runner = stubRunner({
      contradictions: [{ paths: ['AGENTS.md', '.cursorrules'], topic: 'package manager', confidence: 0.9, rationale: 'npm vs yarn' }],
    })
    const insights = await contradictionAnalyzer.run({ root, report, runner })
    expect(insights).toHaveLength(1)
    expect(insights[0].kind).toBe('contradiction')
    expect(insights[0].scoreImpact).toBe(-8)
  })

  it('returns [] when fewer than two instruction surfaces exist', async () => {
    root = makeInstructionRepo({ 'AGENTS.md': 'use npm\n' })
    const report = scanLocalReadiness(root)
    const seen: LlmRequest[] = []
    expect(await contradictionAnalyzer.run({ root, report, runner: stubRunner({ contradictions: [] }, { seen }) })).toEqual([])
    expect(seen).toEqual([])
  })

  it('returns [] when the runner produces no output (fail-open)', async () => {
    root = makeInstructionRepo({ 'AGENTS.md': 'use npm\n', '.cursorrules': 'use yarn\n' })
    const report = scanLocalReadiness(root)
    expect(await contradictionAnalyzer.run({ root, report, runner: emptyRunner() })).toEqual([])
  })
})

describe('falsePositiveAnalyzer.run', () => {
  let root: string
  afterEach(() => root && rmSync(root, { recursive: true, force: true }))

  it('credits a real path-bearing finding the model flags as a false positive', async () => {
    root = makeLargeFileRepo()
    const report = scanLocalReadiness(root)
    const realId = report.findings.find(f => f.path)?.id as string
    const seen: LlmRequest[] = []
    const runner = stubRunner({ assessments: [{ findingId: realId, likelyFalsePositive: true, confidence: 0.8, rationale: 'intentional fixture' }] }, { seen })

    const insights = await falsePositiveAnalyzer.run({ root, report, runner })

    expect(seen[0].input).toContain(realId)
    expect(insights).toHaveLength(1)
    expect(insights[0].kind).toBe('false-positive')
    expect(insights[0].findingId).toBe(realId)
    expect(insights[0].scoreImpact).toBe(3)
  })

  it('returns [] when there are no path-bearing findings to triage', async () => {
    root = makeInstructionRepo({ 'AGENTS.md': 'Run npm test.\n' })
    const report = scanLocalReadiness(root)
    const seen: LlmRequest[] = []
    expect(await falsePositiveAnalyzer.run({ root, report, runner: stubRunner({ assessments: [] }, { seen }) })).toEqual([])
    expect(seen).toEqual([])
  })

  it('returns [] when the runner produces no output (fail-open)', async () => {
    root = makeLargeFileRepo()
    const report = scanLocalReadiness(root)
    expect(await falsePositiveAnalyzer.run({ root, report, runner: emptyRunner() })).toEqual([])
  })
})
