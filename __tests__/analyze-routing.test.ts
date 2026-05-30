import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  analyzeReport,
  contradictionAnalyzer,
  resolveProvider,
  routingProviderIds,
  singleProviderRouting,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
  type ProviderRouting,
} from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

const fixedNow = new Date('2026-05-30T00:00:00.000Z')

// A provider that returns a canned response and records the task it saw.
const stubProvider = (id: string, output: unknown, seen: Array<{ id: string; task: string }>): LlmProvider => ({
  id,
  async complete(request: LlmRequest): Promise<LlmResponse> {
    seen.push({ id, task: request.task })
    return { output, model: `${id}@1` }
  },
})

const makeRepo = (files: Record<string, string>): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'agentready-routing-'))
  writeFileSync(path.join(root, 'README.md'), '# Demo\n')
  mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
  writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\n')
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(root, name), content)
  }
  return root
}

describe('routing helpers', () => {
  const a: LlmProvider = { id: 'a', complete: async () => ({ output: {}, model: 'a@1' }) }
  const b: LlmProvider = { id: 'b', complete: async () => ({ output: {}, model: 'b@1' }) }

  it('resolves per-task overrides and falls back to default', () => {
    const routing: ProviderRouting = { default: a, byTask: { contradiction: b } }
    expect(resolveProvider(routing, 'triage').id).toBe('a')
    expect(resolveProvider(routing, 'contradiction').id).toBe('b')
    expect(resolveProvider(routing, 'remediation').id).toBe('a')
  })

  it('singleProviderRouting routes every task to one provider', () => {
    const routing = singleProviderRouting(a)
    expect(resolveProvider(routing, 'triage').id).toBe('a')
    expect(resolveProvider(routing, 'remediation').id).toBe('a')
  })

  it('reports the distinct provider ids', () => {
    expect(routingProviderIds({ default: a, byTask: { contradiction: b } }).sort()).toEqual(['a', 'b'])
    expect(routingProviderIds(singleProviderRouting(a))).toEqual(['a'])
  })
})

describe('contradiction analyzer', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('is applicable only with two or more instruction surfaces', () => {
    root = makeRepo({ 'AGENTS.md': 'use npm\n' })
    expect(contradictionAnalyzer.applicable(scanLocalReadiness(root))).toBe(false)
    rmSync(root, { recursive: true, force: true })

    root = makeRepo({ 'AGENTS.md': 'use npm\n', '.cursorrules': 'use yarn\n' })
    expect(contradictionAnalyzer.applicable(scanLocalReadiness(root))).toBe(true)
  })

  it('emits a contradiction insight only for real, ≥2 instruction paths', () => {
    root = makeRepo({ 'AGENTS.md': 'use npm\n', '.cursorrules': 'use yarn\n' })
    const report = scanLocalReadiness(root)
    const output = {
      contradictions: [
        { paths: ['AGENTS.md', '.cursorrules'], topic: 'package manager', confidence: 0.9, rationale: 'npm vs yarn' },
        { paths: ['AGENTS.md', 'GHOST.md'], topic: 'hallucinated', confidence: 1, rationale: 'x' },
      ],
    }
    const insights = contradictionAnalyzer.buildInsights(output, 'm@1', report)
    expect(insights).toHaveLength(1)
    expect(insights[0].kind).toBe('contradiction')
    expect(insights[0].scoreImpact).toBe(-8)
  })
})

describe('analyzeReport with task routing', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('routes triage and contradiction analyzers to their mapped providers', async () => {
    root = makeRepo({ 'AGENTS.md': '# AGENTS\n', '.cursorrules': 'use yarn\n' })
    const report = scanLocalReadiness(root)
    const seen: Array<{ id: string; task: string }> = []

    // Triage (instruction-quality) → "small"; contradiction → "strong".
    const small = stubProvider('small', { assessments: [] }, seen)
    const strong = stubProvider('strong', { contradictions: [] }, seen)
    const routing: ProviderRouting = { default: small, byTask: { contradiction: strong } }

    const augmented = await analyzeReport(root, report, { routing, now: fixedNow })

    expect(seen).toContainEqual({ id: 'small', task: 'triage' })
    expect(seen).toContainEqual({ id: 'strong', task: 'contradiction' })
    expect(augmented.analysis.providers.sort()).toEqual(['small', 'strong'])
  })
})
