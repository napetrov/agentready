import { z } from 'zod'
import type { LocalReadinessReport } from '../../repo-readiness/core/types'
import type { LlmInsight } from '../types'
import { sliceFiles, summarizeEvidence } from '../slicing'
import type { AnalyzerContext, AnalyzerRequest, HostDelegatingAnalyzer, SliceHelpers } from './types'

// Cross-surface contradiction / overlap analyzer (design §3). When a repo has
// two or more instruction surfaces (e.g. AGENTS.md and .cursorrules, or a
// CONTRIBUTING that prescribes commands), they can disagree — "use yarn" vs
// "use npm", `make test` vs `jest`. Detecting *semantic* conflict needs a model;
// it is not a textual diff.

const PROMPT_VERSION = 'contradiction/v1'

const itemSchema = z.object({
  paths: z.array(z.string()).min(2),
  topic: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
})
const responseSchema = z.object({ contradictions: z.array(itemSchema) })

const outputSchema = {
  type: 'object',
  properties: {
    contradictions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' } },
          topic: { type: 'string' },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['paths', 'topic', 'confidence', 'rationale'],
      },
    },
  },
  required: ['contradictions'],
}

const SYSTEM = [
  'You find direct contradictions between a repository\'s AI-agent instruction files.',
  'A contradiction is when two files give conflicting guidance an agent cannot satisfy at once',
  '(e.g. different package managers, different test/build commands, opposing conventions).',
  'Report only genuine conflicts, not mere differences in emphasis or topic coverage.',
  'For each, list the conflicting file paths, the topic, a confidence in [0,1], and a one-sentence rationale.',
].join(' ')

/** Shared instruction surfaces; ≥2 are needed for a contradiction to exist. */
const targetPaths = (report: LocalReadinessReport): string[] =>
  report.instructions.filter(surface => !surface.localPrivate).map(surface => surface.path)

const buildRequest = (helpers: SliceHelpers): AnalyzerRequest | undefined => {
  const paths = targetPaths(helpers.report)
  if (paths.length < 2) return undefined

  const sliced = helpers.sliceFiles(helpers.root, paths)
  if (sliced.includedPaths.length < 2) return undefined

  const input = `Repository summary:\n${helpers.summarizeEvidence(helpers.report)}\n\nInstruction files:\n${sliced.text}`
  return { promptVersion: PROMPT_VERSION, system: SYSTEM, input, outputSchema, maxTokens: 800 }
}

const buildInsights = (output: unknown, model: string, report: LocalReadinessReport): LlmInsight[] => {
  const parsed = responseSchema.safeParse(output)
  if (!parsed.success) return []

  const known = new Set(targetPaths(report))
  const insights: LlmInsight[] = []
  for (const item of parsed.data.contradictions) {
    // Every cited path must be a real instruction surface, and at least two.
    const validPaths = item.paths.filter(p => known.has(p))
    if (validPaths.length < 2) continue
    const sorted = [...validPaths].sort()
    insights.push({
      id: `analysis.contradiction:${item.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      kind: 'contradiction',
      target: sorted.join(', '),
      verdict: `Conflicting guidance on ${item.topic}`,
      confidence: item.confidence,
      rationale: item.rationale,
      remediation: `Reconcile ${sorted.join(' and ')} so they agree on ${item.topic}, or designate one as canonical.`,
      // Contradictions actively mislead an agent; penalize more than a quality gap.
      scoreImpact: -8,
      model,
      promptVersion: PROMPT_VERSION,
    })
  }
  return insights
}

export const contradictionAnalyzer: HostDelegatingAnalyzer = {
  id: 'contradiction',
  task: 'contradiction',

  applicable(report: LocalReadinessReport): boolean {
    return targetPaths(report).length >= 2
  },

  buildRequest,
  buildInsights,

  async run(context: AnalyzerContext): Promise<LlmInsight[]> {
    const { root, report, runner } = context
    const request = buildRequest({ root, report, sliceFiles, summarizeEvidence })
    if (!request) return []

    const outcome = await runner.run(
      {
        task: 'contradiction',
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
