import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  analyzeReport,
  computeAugmentedScore,
  formatAugmentedMarkdown,
  formatAugmentedSummary,
  instructionQualityAnalyzer,
  validateAugmentedReportContract,
  type LlmInsight,
  type LlmRequest,
  type LlmResponse,
} from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

const fixedNow = new Date('2026-05-30T00:00:00.000Z')

const makeInsight = (overrides: Partial<LlmInsight> = {}): LlmInsight => ({
  id: 'analysis.instruction-quality:AGENTS.md',
  kind: 'quality',
  target: 'AGENTS.md',
  verdict: 'present but not actionable',
  confidence: 0.8,
  rationale: 'no commands',
  scoreImpact: -5,
  model: 'test@1',
  promptVersion: 'instruction-quality/v1',
  ...overrides,
})

describe('computeAugmentedScore', () => {
  it('leaves the score unchanged when no insight carries an impact', () => {
    const score = computeAugmentedScore(90, [makeInsight({ scoreImpact: undefined })])
    expect(score).toEqual({ deterministic: 90, augmented: 90, adjustments: [] })
  })

  it('weights impact by confidence and itemizes adjustments', () => {
    const score = computeAugmentedScore(90, [makeInsight({ scoreImpact: -5, confidence: 0.8 })])
    // round(-5 * 0.8) = -4
    expect(score.augmented).toBe(86)
    expect(score.adjustments).toEqual([{ insightId: 'analysis.instruction-quality:AGENTS.md', delta: -4 }])
  })

  it('clamps to the 0–100 range', () => {
    expect(computeAugmentedScore(2, [makeInsight({ scoreImpact: -50, confidence: 1 })]).augmented).toBe(0)
    expect(computeAugmentedScore(99, [makeInsight({ scoreImpact: 50, confidence: 1 })]).augmented).toBe(100)
  })

  it('never mutates the deterministic score', () => {
    const score = computeAugmentedScore(75, [makeInsight()])
    expect(score.deterministic).toBe(75)
  })
})

// A repo with an instruction file so the analyzer is applicable.
const makeRepo = (agentsContent: string): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'agentready-analyze-'))
  writeFileSync(path.join(root, 'README.md'), '# Demo\n')
  writeFileSync(path.join(root, 'AGENTS.md'), agentsContent)
  mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
  writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\n')
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest', lint: 'eslint .' } }))
  return root
}

describe('analyzeReport (orchestrator)', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('returns a deterministic-only report when no provider is given', async () => {
    root = makeRepo('# AGENTS\nRun npm test.\n')
    const report = scanLocalReadiness(root)
    const augmented = await analyzeReport(root, report, { now: fixedNow })

    expect(augmented.analysis.enabled).toBe(false)
    expect(augmented.insights).toEqual([])
    expect(augmented.augmentedScore.augmented).toBe(report.summary.score)
    expect(validateAugmentedReportContract(augmented)).toEqual({ valid: true, errors: [] })
  })

  it('produces and folds insights from a provider (via replay)', async () => {
    root = makeRepo('# AGENTS\n')
    const report = scanLocalReadiness(root)

    // Capture the request the analyzer issues and return a canned response.
    const captured: LlmRequest[] = []
    const response: LlmResponse = {
      output: {
        assessments: [
          { path: 'AGENTS.md', actionable: false, confidence: 0.9, rationale: 'no setup or validation commands', missing: ['validation commands'] },
        ],
      },
      model: 'replay@1',
    }
    const provider = {
      id: 'replay',
      async complete(request: LlmRequest): Promise<LlmResponse> {
        captured.push(request)
        return response
      },
    }

    const augmented = await analyzeReport(root, report, { provider, now: fixedNow })

    expect(augmented.analysis.enabled).toBe(true)
    expect(augmented.analysis.providers).toEqual(['replay'])
    expect(augmented.insights).toHaveLength(1)
    expect(augmented.insights[0].target).toBe('AGENTS.md')
    expect(augmented.insights[0].scoreImpact).toBe(-5)
    // round(-5 * 0.9) = -4 (rounds toward +inf for -4.5)
    expect(augmented.augmentedScore.augmented).toBe(report.summary.score - 4)
    expect(validateAugmentedReportContract(augmented)).toEqual({ valid: true, errors: [] })
    // The analyzer sent the instruction file and a summary.
    expect(captured[0].input).toContain('AGENTS.md')
  })

  it('fails open: a throwing provider yields a deterministic-only-style report', async () => {
    root = makeRepo('# AGENTS\n')
    const report = scanLocalReadiness(root)
    const provider = {
      id: 'boom',
      async complete(): Promise<LlmResponse> {
        throw new Error('network down')
      },
    }
    const warnings: string[] = []
    const augmented = await analyzeReport(root, report, { provider, now: fixedNow, onWarn: m => warnings.push(m) })

    expect(augmented.insights).toEqual([])
    expect(augmented.augmentedScore.augmented).toBe(report.summary.score)
    expect(warnings.join(' ')).toMatch(/continuing without it/)
  })
})

describe('instructionQualityAnalyzer.applicable', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('is not applicable when there is no instruction surface', () => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-noinstr-'))
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    const report = scanLocalReadiness(root)
    expect(instructionQualityAnalyzer.applicable(report)).toBe(false)
  })

  it('is applicable when an instruction surface exists', () => {
    root = makeRepo('# AGENTS\n')
    const report = scanLocalReadiness(root)
    expect(instructionQualityAnalyzer.applicable(report)).toBe(true)
  })
})

describe('augmented report reporters', () => {
  it('summary shows both scores and labels deterministic-only runs', () => {
    const base = scanLocalReadiness(path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo'))
    const summary = formatAugmentedSummary({
      baseReport: base,
      generatedAt: fixedNow.toISOString(),
      insights: [],
      augmentedScore: { deterministic: base.summary.score, augmented: base.summary.score, adjustments: [] },
      analysis: { enabled: false, providers: [], insightsConsidered: 0, insightsApplied: 0 },
    })
    expect(summary).toContain('Deterministic score:')
    expect(summary).toContain('Augmented score:')
    expect(summary).toMatch(/deterministic-only/)
  })

  it('markdown renders an insights table when present', () => {
    const base = scanLocalReadiness(path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo'))
    const md = formatAugmentedMarkdown({
      baseReport: base,
      generatedAt: fixedNow.toISOString(),
      insights: [makeInsight({ confidence: 0.5 })],
      augmentedScore: computeAugmentedScore(base.summary.score, [makeInsight({ confidence: 0.5 })]),
      analysis: { enabled: true, providers: ['replay'], insightsConsidered: 1, insightsApplied: 1 },
    })
    expect(md).toContain('# AgentReady Augmented Analysis')
    expect(md).toContain('## Insights')
    expect(md).toContain('AGENTS.md')
  })
})
