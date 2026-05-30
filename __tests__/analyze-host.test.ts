import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  buildHostRequests,
  ingestHostResponses,
  validateAugmentedReportContract,
} from '../lib/analyze'
import { handleRequest, type JsonRpcRequest } from '../lib/mcp'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

const fixedNow = new Date('2026-05-30T00:00:00.000Z')

const makeRepo = (agents: string): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'agentready-host-'))
  writeFileSync(path.join(root, 'README.md'), '# Demo\n')
  writeFileSync(path.join(root, 'AGENTS.md'), agents)
  mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
  writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\n')
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }))
  return root
}

const goodAnswer = {
  analyzerId: 'instruction-quality',
  model: 'host-model@1',
  output: {
    assessments: [
      { path: 'AGENTS.md', actionable: false, confidence: 0.8, rationale: 'too vague', missing: ['commands'] },
    ],
  },
}

describe('host-delegated flow', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('builds requests for an applicable repo and none otherwise', () => {
    root = makeRepo('# AGENTS\n')
    const report = scanLocalReadiness(root)
    const requests = buildHostRequests(root, report)
    expect(requests).toHaveLength(1)
    expect(requests[0].analyzerId).toBe('instruction-quality')
    expect(requests[0].input).toContain('AGENTS.md')
    expect(requests[0].outputSchema).toBeDefined()

    const empty = mkdtempSync(path.join(tmpdir(), 'agentready-noinstr-'))
    writeFileSync(path.join(empty, 'README.md'), '# Demo\n')
    expect(buildHostRequests(empty, scanLocalReadiness(empty))).toEqual([])
    rmSync(empty, { recursive: true, force: true })
  })

  it('folds host answers into a valid augmented report', () => {
    root = makeRepo('# AGENTS\n')
    const report = scanLocalReadiness(root)
    const augmented = ingestHostResponses(report, [goodAnswer], { now: fixedNow })

    expect(augmented.insights).toHaveLength(1)
    expect(augmented.insights[0].model).toBe('host-model@1')
    expect(augmented.augmentedScore.augmented).toBe(report.summary.score - 4) // round(-5*0.8)
    expect(validateAugmentedReportContract(augmented)).toEqual({ valid: true, errors: [] })
  })

  it('drops hallucinated paths and malformed output (fail-open)', () => {
    root = makeRepo('# AGENTS\n')
    const report = scanLocalReadiness(root)

    const hallucinated = ingestHostResponses(report, [
      { analyzerId: 'instruction-quality', model: 'm@1', output: { assessments: [{ path: 'NOPE.md', actionable: false, confidence: 1, rationale: 'x', missing: [] }] } },
    ], { now: fixedNow })
    expect(hallucinated.insights).toEqual([])

    const malformed = ingestHostResponses(report, [
      { analyzerId: 'instruction-quality', model: 'm@1', output: { not: 'the schema' } },
    ], { now: fixedNow })
    expect(malformed.insights).toEqual([])
    expect(malformed.augmentedScore.augmented).toBe(report.summary.score)
  })

  it('ignores responses for unknown analyzers and warns', () => {
    root = makeRepo('# AGENTS\n')
    const report = scanLocalReadiness(root)
    const warnings: string[] = []
    const augmented = ingestHostResponses(report, [{ analyzerId: 'nonexistent', model: 'm@1', output: {} }], {
      now: fixedNow,
      onWarn: m => warnings.push(m),
    })
    expect(augmented.insights).toEqual([])
    expect(warnings.join(' ')).toMatch(/no host-delegating analyzer "nonexistent"/)
  })
})

describe('MCP server handler', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  const call = (method: string, params?: unknown, id: number | null = 1): JsonRpcRequest => ({
    jsonrpc: '2.0',
    id,
    method,
    ...(params !== undefined ? { params } : {}),
  })

  it('responds to initialize with protocol + server info', () => {
    const res = handleRequest(call('initialize'))
    expect(res?.result).toMatchObject({ serverInfo: { name: 'agentready' } })
  })

  it('lists the AgentReady tools', () => {
    const res = handleRequest(call('tools/list'))
    const names = (res?.result as { tools: Array<{ name: string }> }).tools.map(t => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['agentready_scan', 'agentready_analyze_prepare', 'agentready_analyze_finalize']),
    )
  })

  it('returns no response for the initialized notification', () => {
    expect(handleRequest({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined()
  })

  it('runs the full prepare → finalize flow over MCP', () => {
    root = makeRepo('# AGENTS\n')

    const prepare = handleRequest(call('tools/call', { name: 'agentready_analyze_prepare', arguments: { path: root } }))
    const prepText = (prepare?.result as { content: Array<{ text: string }> }).content[0].text
    const requests = JSON.parse(prepText).requests as Array<{ analyzerId: string }>
    expect(requests[0].analyzerId).toBe('instruction-quality')

    const finalize = handleRequest(
      call('tools/call', { name: 'agentready_analyze_finalize', arguments: { path: root, responses: [goodAnswer] } }),
    )
    const finText = (finalize?.result as { content: Array<{ text: string }> }).content[0].text
    const augmented = JSON.parse(finText)
    expect(augmented.insights).toHaveLength(1)
    expect(augmented.augmentedScore.augmented).toBeLessThan(augmented.augmentedScore.deterministic)
  })

  it('errors on an unknown tool and unknown method', () => {
    expect(handleRequest(call('tools/call', { name: 'bogus' }))?.error?.code).toBe(-32602)
    expect(handleRequest(call('does/not/exist'))?.error?.code).toBe(-32601)
  })
})
