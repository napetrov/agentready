import { z } from 'zod'
import type { LocalReadinessReport } from '../../repo-readiness/core/types'
import type { LlmInsight } from '../types'
import { sliceFiles, summarizeEvidence } from '../slicing'
import type { AnalyzerContext, AnalyzerRequest, HostDelegatingAnalyzer, SliceHelpers } from './types'

// The first Tier-2 analyzer: judges whether the repository's agent instruction
// surfaces (AGENTS.md and tool-specific equivalents) are actually *actionable*,
// not merely present. The deterministic `instructions.missing` rule only checks
// presence; quality is a semantic judgment a model is suited for.
//
// It implements HostDelegatingAnalyzer so the same request/insight logic powers
// both the provider pipeline (`run`) and the host-delegated path
// (`buildRequest` + `buildInsights`).

const PROMPT_VERSION = 'instruction-quality/v1'

const itemSchema = z.object({
  path: z.string(),
  actionable: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  missing: z.array(z.string()).default([]),
})
const responseSchema = z.object({ assessments: z.array(itemSchema) })

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

const buildRequest = (helpers: SliceHelpers): AnalyzerRequest | undefined => {
  const paths = targetPaths(helpers.report)
  if (paths.length === 0) return undefined

  const sliced = helpers.sliceFiles(helpers.root, paths)
  if (sliced.includedPaths.length === 0) return undefined

  const input = `Repository summary:\n${helpers.summarizeEvidence(helpers.report)}\n\nInstruction files:\n${sliced.text}`
  return { promptVersion: PROMPT_VERSION, system: SYSTEM, input, outputSchema, maxTokens: 800 }
}

const buildInsights = (output: unknown, model: string, report: LocalReadinessReport): LlmInsight[] => {
  const parsed = responseSchema.safeParse(output)
  if (!parsed.success) return []

  // Reject hallucinated paths: only accept assessments for instruction surfaces
  // that actually exist in the report.
  const known = new Set(targetPaths(report))
  const insights: LlmInsight[] = []
  for (const item of parsed.data.assessments) {
    if (!known.has(item.path)) continue
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
            scoreImpact: -5,
          }),
      model,
      promptVersion: PROMPT_VERSION,
    })
  }
  return insights
}

export const instructionQualityAnalyzer: HostDelegatingAnalyzer = {
  id: 'instruction-quality',
  task: 'triage',

  applicable(report: LocalReadinessReport): boolean {
    return targetPaths(report).length > 0
  },

  buildRequest,
  buildInsights,

  async run(context: AnalyzerContext): Promise<LlmInsight[]> {
    const { root, report, runner } = context
    const request = buildRequest({ root, report, sliceFiles, summarizeEvidence })
    if (!request) return []

    const outcome = await runner.run(
      {
        task: 'triage',
        system: request.system,
        input: request.input,
        outputSchema: request.outputSchema,
        maxTokens: request.maxTokens,
      },
      request.promptVersion,
    )
    if (outcome.output === undefined) return []

    return buildInsights(outcome.output, outcome.model ?? `${runner.providerId}:unknown`, report)
  },
}
