import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  cacheKey,
  createBudgetTracker,
  createFileCache,
  createMemoryCache,
  createReplayProvider,
  createRunner,
  replayKey,
  sliceFiles,
  summarizeEvidence,
  type LlmRequest,
  type LlmResponse,
} from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

const goodFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo')

const makeRequest = (overrides: Partial<LlmRequest> = {}): LlmRequest => ({
  task: 'triage',
  system: 'judge',
  input: 'evidence',
  outputSchema: { type: 'object' },
  maxTokens: 100,
  ...overrides,
})

describe('slicing', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-slice-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('concatenates files with headers and reports inclusions', () => {
    writeFileSync(path.join(root, 'a.md'), 'alpha')
    mkdirSync(path.join(root, 'docs'))
    writeFileSync(path.join(root, 'docs', 'b.md'), 'bravo')

    const sliced = sliceFiles(root, ['a.md', 'docs/b.md'])
    expect(sliced.includedPaths).toEqual(['a.md', 'docs/b.md'])
    expect(sliced.droppedPaths).toEqual([])
    expect(sliced.text).toContain('=== a.md ===')
    expect(sliced.text).toContain('alpha')
    expect(sliced.text).toContain('=== docs/b.md ===')
  })

  it('skips unreadable files without throwing', () => {
    const sliced = sliceFiles(root, ['nope.md'])
    expect(sliced.includedPaths).toEqual([])
    expect(sliced.droppedPaths).toEqual(['nope.md'])
  })

  it('enforces the total byte budget by dropping overflow files', () => {
    writeFileSync(path.join(root, 'big.txt'), 'x'.repeat(500))
    writeFileSync(path.join(root, 'small.txt'), 'y'.repeat(10))
    const sliced = sliceFiles(root, ['big.txt', 'small.txt'], { maxBytes: 200, maxBytesPerFile: 1000 })
    // big.txt's block exceeds 200 bytes and is dropped; small.txt fits.
    expect(sliced.droppedPaths).toContain('big.txt')
    expect(sliced.includedPaths).toContain('small.txt')
  })

  it('truncates a file exceeding the per-file budget and marks it', () => {
    writeFileSync(path.join(root, 'big.txt'), 'z'.repeat(500))
    const sliced = sliceFiles(root, ['big.txt'], { maxBytes: 10_000, maxBytesPerFile: 100 })
    expect(sliced.text).toContain('(truncated)')
    expect(sliced.bytes).toBeLessThan(500)
  })

  it('summarizes a real scan report compactly', () => {
    const summary = summarizeEvidence(scanLocalReadiness(goodFixture))
    expect(summary).toMatch(/files: \d+/)
    expect(summary).toMatch(/commands: test=/)
  })
})

describe('cacheKey', () => {
  it('is stable for identical parts and sensitive to each part', () => {
    const base = { model: 'm', promptVersion: 'p', schemaVersion: 's', input: 'i' }
    expect(cacheKey(base)).toBe(cacheKey({ ...base }))
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, model: 'm2' }))
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, promptVersion: 'p2' }))
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, schemaVersion: 's2' }))
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, input: 'i2' }))
  })
})

describe('file cache', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'agentready-cache-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('round-trips a value and misses on unknown keys', () => {
    const cache = createFileCache(dir)
    expect(cache.get('absent')).toBeUndefined()
    cache.set('k', { verdict: 'ok' })
    expect(cache.get('k')).toEqual({ verdict: 'ok' })
  })

  it('treats a corrupt cache file as a miss', () => {
    const cache = createFileCache(dir)
    writeFileSync(path.join(dir, 'bad.json'), '{ not json')
    expect(cache.get('bad')).toBeUndefined()
  })
})

describe('budget tracker', () => {
  it('caps per-task tokens and tracks the run total', () => {
    const budget = createBudgetTracker({ perTaskTokens: 50, perRunTokens: 120 })
    expect(budget.maxTokensFor('triage')).toBe(50)
    expect(budget.canAfford(50)).toBe(true)
    budget.record(100)
    expect(budget.remaining()).toBe(20)
    expect(budget.maxTokensFor('triage')).toBe(20) // clamped by remaining run budget
    expect(budget.canAfford(50)).toBe(false)
  })
})

describe('runner (fail-open spine)', () => {
  const response = (output: unknown): LlmResponse => ({ output, model: 'test@1', usage: { inputTokens: 5, outputTokens: 9 } })

  it('returns provider output and caches it', async () => {
    const request = makeRequest()
    const provider = createReplayProvider([{ key: replayKey(request), response: response({ verdict: 'ok' }) }])
    const cache = createMemoryCache()
    const runner = createRunner({ provider, cache, schemaVersion: 'v1' })

    const first = await runner.run(request, 'prompt/v1')
    expect(first.output).toEqual({ verdict: 'ok' })
    expect(first.cached).toBe(false)

    const second = await runner.run(request, 'prompt/v1')
    expect(second.cached).toBe(true)
    expect(second.output).toEqual({ verdict: 'ok' })
  })

  it('does not return a cross-model false cache hit', async () => {
    const request = makeRequest()
    const cache = createMemoryCache()
    // Same adapter id and request, different concrete model → must be a miss.
    const modelA = createReplayProvider([{ key: replayKey(request), response: response({ from: 'A' }) }], { model: 'model-a' })
    const modelB = createReplayProvider([{ key: replayKey(request), response: response({ from: 'B' }) }], { model: 'model-b' })

    const a = await createRunner({ provider: modelA, cache, schemaVersion: 'v1' }).run(request, 'p')
    expect(a.output).toEqual({ from: 'A' })

    const b = await createRunner({ provider: modelB, cache, schemaVersion: 'v1' }).run(request, 'p')
    expect(b.cached).toBe(false)
    expect(b.output).toEqual({ from: 'B' })
  })

  it('skips the call when the budget is exhausted', async () => {
    const request = makeRequest({ maxTokens: 100 })
    const provider = createReplayProvider([{ key: replayKey(request), response: response({}) }])
    const budget = createBudgetTracker({ perRunTokens: 10 })
    const warnings: string[] = []
    const runner = createRunner({ provider, budget, schemaVersion: 'v1', onWarn: m => warnings.push(m) })

    const outcome = await runner.run(request, 'p')
    expect(outcome.skipped).toBe(true)
    expect(outcome.output).toBeUndefined()
    expect(warnings.join(' ')).toMatch(/budget exhausted/)
  })

  it('fails open when the provider throws', async () => {
    const failing = {
      id: 'boom',
      complete: async () => {
        throw new Error('network down')
      },
    }
    const warnings: string[] = []
    const runner = createRunner({ provider: failing, schemaVersion: 'v1', onWarn: m => warnings.push(m) })
    const outcome = await runner.run(makeRequest(), 'p')
    expect(outcome.output).toBeUndefined()
    expect(outcome.skipped).toBe(false)
    expect(warnings.join(' ')).toMatch(/call failed, continuing/)
  })
})

describe('replay provider', () => {
  it('throws on an unknown request when no onMiss is given', async () => {
    const provider = createReplayProvider([])
    await expect(provider.complete(makeRequest())).rejects.toThrow(/no fixture/)
  })
})
