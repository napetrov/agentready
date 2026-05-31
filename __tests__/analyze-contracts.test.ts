import path from 'path'
import {
  augmentedReportSchema,
  llmInsightSchema,
  validateAugmentedReportContract,
  validateLlmInsightContract,
  type AugmentedReport,
  type LlmInsight,
} from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

const goodFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo')

const validInsight: LlmInsight = {
  id: 'analysis.instruction-quality:AGENTS.md',
  kind: 'quality',
  findingId: 'instructions.missing',
  target: 'AGENTS.md',
  verdict: 'Instruction file is present but lacks validation commands',
  confidence: 0.72,
  rationale: 'The file has an overview but no test/lint/build commands an agent can run.',
  remediation: 'Add a Validation section listing the canonical commands.',
  scoreImpact: -3,
  model: 'claude-haiku-4-5@2025-10-01',
  promptVersion: 'instruction-quality/v1',
}

describe('LlmInsight contract', () => {
  it('accepts a fully-populated valid insight', () => {
    expect(llmInsightSchema.safeParse(validInsight).success).toBe(true)
    expect(validateLlmInsightContract(validInsight)).toEqual({ valid: true, errors: [] })
  })

  it('accepts a minimal insight without optional fields', () => {
    const minimal: LlmInsight = {
      id: 'analysis.note:repo',
      kind: 'note',
      verdict: 'No additional concerns',
      confidence: 0,
      rationale: 'Nothing ambiguous to analyze.',
      model: 'local/llama-3.1-8b@q4',
      promptVersion: 'triage/v1',
    }
    expect(validateLlmInsightContract(minimal)).toEqual({ valid: true, errors: [] })
  })

  it('rejects confidence outside 0–1 with a readable path', () => {
    const result = validateLlmInsightContract({ ...validInsight, confidence: 1.5 })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/confidence/)
  })

  it('rejects an unknown insight kind', () => {
    expect(validateLlmInsightContract({ ...validInsight, kind: 'bogus' }).valid).toBe(false)
  })

  it('rejects unknown keys (strict object)', () => {
    expect(validateLlmInsightContract({ ...validInsight, extra: true }).valid).toBe(false)
  })

  it('requires the model and promptVersion stamps', () => {
    const { model: _model, ...noModel } = validInsight
    const { promptVersion: _pv, ...noPrompt } = validInsight
    expect(validateLlmInsightContract(noModel).valid).toBe(false)
    expect(validateLlmInsightContract(noPrompt).valid).toBe(false)
  })
})

describe('AugmentedReport contract', () => {
  const buildReport = (): AugmentedReport => {
    const baseReport = scanLocalReadiness(goodFixture)
    return {
      baseReport,
      generatedAt: '2026-05-30T00:00:00.000Z',
      insights: [validInsight],
      augmentedScore: {
        deterministic: baseReport.summary.score,
        augmented: baseReport.summary.score - 3,
        adjustments: [{ insightId: validInsight.id, delta: -3 }],
      },
      analysis: {
        enabled: true,
        providers: ['anthropic'],
        insightsConsidered: 2,
        insightsApplied: 1,
      },
    }
  }

  it('accepts a well-formed augmented report wrapping a real scan', () => {
    const report = buildReport()
    expect(augmentedReportSchema.safeParse(report).success).toBe(true)
    expect(validateAugmentedReportContract(report)).toEqual({ valid: true, errors: [] })
  })

  it('accepts a deterministic-only (disabled) report with no insights', () => {
    const baseReport = scanLocalReadiness(goodFixture)
    const report: AugmentedReport = {
      baseReport,
      generatedAt: '2026-05-30T00:00:00.000Z',
      insights: [],
      augmentedScore: { deterministic: baseReport.summary.score, augmented: baseReport.summary.score, adjustments: [] },
      analysis: { enabled: false, providers: [], insightsConsidered: 0, insightsApplied: 0 },
    }
    expect(validateAugmentedReportContract(report)).toEqual({ valid: true, errors: [] })
  })

  it('rejects a report whose embedded base report is invalid', () => {
    const report = buildReport()
    // Corrupt the embedded deterministic report; the nested schema should catch it.
    ;(report.baseReport.summary as { score: unknown }).score = 'not-a-number'
    const result = validateAugmentedReportContract(report)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/baseReport\.summary\.score/)
  })

  it('rejects an invalid nested insight and reports its array path', () => {
    const report = buildReport()
    ;(report.insights[0] as { confidence: unknown }).confidence = 2
    const result = validateAugmentedReportContract(report)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/insights\[0\]\.confidence/)
  })
})
