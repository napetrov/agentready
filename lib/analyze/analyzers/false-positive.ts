import { z } from 'zod'
import type { LocalReadinessReport } from '../../repo-readiness/core/types'
import type { LlmInsight } from '../types'
import { sliceFiles, summarizeEvidence } from '../slicing'
import type { AnalyzerContext, AnalyzerRequest, HostDelegatingAnalyzer, SliceHelpers } from './types'

// False-positive triage analyzer (design §3). Reviews the deterministic findings
// against the evidence and flags ones likely to be false positives — e.g. a
// "large file" that is an intentional fixture, or a "minified file" that is
// actually hand-written. It does not silently suppress findings; it emits a
// `false-positive` insight (with a small positive score impact) that a human can
// weigh. Only path-bearing findings are triaged, since those are the
// context-dependent ones.

const PROMPT_VERSION = 'false-positive/v1'

const itemSchema = z.object({
  findingId: z.string(),
  likelyFalsePositive: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
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
          findingId: { type: 'string' },
          likelyFalsePositive: { type: 'boolean' },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['findingId', 'likelyFalsePositive', 'confidence', 'rationale'],
      },
    },
  },
  required: ['assessments'],
}

const SYSTEM = [
  'You triage static repository findings for likely false positives.',
  'A finding is a likely false positive when the flagged file is intentional and not a real readiness problem',
  '(e.g. a test fixture, vendored data, or hand-written code misclassified as generated/minified).',
  'Only mark a finding as a likely false positive when the evidence supports it; otherwise leave it.',
  'For each finding, return its findingId, likelyFalsePositive (true/false), a confidence in [0,1], and a one-sentence rationale.',
].join(' ')

/** Path-bearing findings are the context-dependent ones worth triaging. */
const triageable = (report: LocalReadinessReport) => report.findings.filter(f => f.path)

const buildRequest = (helpers: SliceHelpers): AnalyzerRequest | undefined => {
  const findings = triageable(helpers.report)
  if (findings.length === 0) return undefined

  // Send the findings plus a slice of each referenced file so the model can judge.
  const referenced = [...new Set(findings.map(f => f.path as string))]
  const sliced = helpers.sliceFiles(helpers.root, referenced)
  const findingsList = findings.map(f => `- ${f.id} (${f.severity}) @ ${f.path}: ${f.title}`).join('\n')

  const input = [
    `Repository summary:\n${helpers.summarizeEvidence(helpers.report)}`,
    `Findings to triage:\n${findingsList}`,
    sliced.text ? `Referenced files:\n${sliced.text}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return { promptVersion: PROMPT_VERSION, system: SYSTEM, input, outputSchema, maxTokens: 800 }
}

const buildInsights = (output: unknown, model: string, report: LocalReadinessReport): LlmInsight[] => {
  const parsed = responseSchema.safeParse(output)
  if (!parsed.success) return []

  const knownIds = new Set(report.findings.map(f => f.id))
  const insights: LlmInsight[] = []
  for (const item of parsed.data.assessments) {
    if (!item.likelyFalsePositive) continue
    if (!knownIds.has(item.findingId)) continue // reject hallucinated finding ids
    insights.push({
      id: `analysis.false-positive:${item.findingId}`,
      kind: 'false-positive',
      findingId: item.findingId,
      verdict: 'Finding is likely a false positive',
      confidence: item.confidence,
      rationale: item.rationale,
      // Triaging a false positive credits the score modestly (it offsets a
      // deterministic deduction the human can confirm).
      scoreImpact: 3,
      model,
      promptVersion: PROMPT_VERSION,
    })
  }
  return insights
}

export const falsePositiveAnalyzer: HostDelegatingAnalyzer = {
  id: 'false-positive',
  task: 'triage',

  applicable(report: LocalReadinessReport): boolean {
    return triageable(report).length > 0
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
