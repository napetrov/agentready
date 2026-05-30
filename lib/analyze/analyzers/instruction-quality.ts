import { z } from 'zod'
import type { LocalReadinessReport } from '../../repo-readiness/core/types'
import type { LlmInsight } from '../types'
import { sliceFiles, summarizeEvidence } from '../slicing'
import type { Analyzer, AnalyzerContext } from './types'

// The first Tier-2 analyzer: judges whether the repository's agent instruction
// surfaces (AGENTS.md and tool-specific equivalents) are actually *actionable*,
// not merely present. The deterministic `instructions.missing` rule only checks
// presence; quality is a semantic judgment a model is suited for.

const PROMPT_VERSION = 'instruction-quality/v1'

// The shape we ask the model for and validate before trusting. Kept small and
// strict; one object per analyzed instruction file.
const itemSchema = z.object({
  path: z.string(),
  actionable: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  missing: z.array(z.string()).default([]),
})
const responseSchema = z.object({ assessments: z.array(itemSchema) })

// JSON Schema handed to the provider (broadly supported json_object mode).
const outputSchema = {
  type: 'object',
  properties: {
    assessments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          actionable: { type: 'boolean' },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
          missing: { type: 'array', items: { type: 'string' } },
        },
        required: ['path', 'actionable', 'confidence', 'rationale'],
      },
    },
  },
  required: ['assessments'],
}

const SYSTEM = [
  'You assess whether a repository\'s AI-agent instruction files are actionable.',
  'An actionable instruction file lets an unfamiliar coding agent set up, make a change, and verify it:',
  'it should convey purpose, where the code lives, and the concrete commands to validate a change.',
  'A file that is present but vague, empty, or boilerplate is NOT actionable.',
  'For each file, decide actionable (true/false), a confidence in [0,1], a one-sentence rationale,',
  'and a short list of what is missing. Be strict but fair.',
].join(' ')

/** The instruction files worth judging: real shared instruction surfaces. */
const targetPaths = (report: LocalReadinessReport): string[] =>
  report.instructions.filter(surface => !surface.localPrivate).map(surface => surface.path)

export const instructionQualityAnalyzer: Analyzer = {
  id: 'instruction-quality',

  applicable(report: LocalReadinessReport): boolean {
    return targetPaths(report).length > 0
  },

  async run(context: AnalyzerContext): Promise<LlmInsight[]> {
    const { root, report, runner } = context
    const paths = targetPaths(report)
    if (paths.length === 0) return []

    const sliced = sliceFiles(root, paths)
    if (sliced.includedPaths.length === 0) return []

    const input = `Repository summary:\n${summarizeEvidence(report)}\n\nInstruction files:\n${sliced.text}`
    const outcome = await runner.run(
      {
        task: 'triage',
        system: SYSTEM,
        input,
        outputSchema,
        maxTokens: 800,
      },
      PROMPT_VERSION,
    )
    if (outcome.output === undefined) return []

    const parsed = responseSchema.safeParse(outcome.output)
    if (!parsed.success) return []

    const model = outcome.model ?? `${runner.providerId}:unknown`
    const insights: LlmInsight[] = []
    for (const item of parsed.data.assessments) {
      // Only emit insights for files we actually sent, to avoid hallucinated paths.
      if (!sliced.includedPaths.includes(item.path)) continue
      const missing = item.missing.length > 0 ? ` Missing: ${item.missing.join(', ')}.` : ''
      insights.push({
        id: `analysis.instruction-quality:${item.path}`,
        kind: 'quality',
        target: item.path,
        verdict: item.actionable
          ? 'Instruction file is actionable'
          : 'Instruction file is present but not actionable',
        confidence: item.confidence,
        rationale: `${item.rationale}${missing}`.trim(),
        ...(item.actionable
          ? {}
          : {
              remediation: 'Add the concrete validation commands and a brief orientation so an unfamiliar agent can set up, change, and verify.',
              // A non-actionable instruction file is a quality gap; penalize modestly.
              scoreImpact: -5,
            }),
        model,
        promptVersion: PROMPT_VERSION,
      })
    }
    return insights
  },
}
