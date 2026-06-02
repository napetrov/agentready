import { z } from 'zod'
import type { LocalReadinessReport } from '../../repo-readiness/core/types'
import type { LlmInsight } from '../types'
import { sliceFiles, summarizeEvidence } from '../slicing'
import type { AnalyzerContext, AnalyzerRequest, HostDelegatingAnalyzer, SliceHelpers } from './types'

// Remediation analyzer (design §3, "finding explanation / remediation"). Turns
// the deterministic findings' generic recommendations into repo-specific,
// actionable remediation tailored to the project's stack and layout — the
// enrichment behind a richer `explain`/`fix` experience. It is advisory: it
// emits `analysis.remediation:*` insights (with the concrete steps in the
// insight's `remediation` field) and never adjusts the score, since fixing is a
// human decision and the deterministic deduction already stands.

const PROMPT_VERSION = 'remediation/v1'

const itemSchema = z.object({
  findingId: z.string(),
  remediation: z.string().min(1),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
})
const responseSchema = z.object({ remediations: z.array(itemSchema) })

const outputSchema = {
  type: 'object',
  properties: {
    remediations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          findingId: { type: 'string' },
          remediation: { type: 'string' },
          rationale: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['findingId', 'remediation', 'rationale', 'confidence'],
      },
    },
  },
  required: ['remediations'],
}

const SYSTEM = [
  'You propose concrete, repo-specific remediation for static repository readiness findings.',
  'Each finding already has a generic recommendation; your job is to make it actionable for THIS repository,',
  'using its detected stack, command ecosystems, and file layout.',
  'Prefer specific commands, file names, and config keys over generic advice. Keep each remediation to a few imperative steps.',
  'Do not invent files, scripts, or tools the evidence does not show. Only address the findings provided.',
  'For each finding you can help with, return its findingId, the remediation steps, a one-sentence rationale, and a confidence in [0,1].',
].join(' ')

const buildRequest = (helpers: SliceHelpers): AnalyzerRequest | undefined => {
  const { findings } = helpers.report
  if (findings.length === 0) return undefined

  // Include a slice of any path-bearing finding's file so steps can reference
  // real contents; non-path findings are remediated from the evidence summary.
  const referenced = [...new Set(findings.map(f => f.path).filter((p): p is string => Boolean(p)))]
  const sliced = referenced.length > 0 ? helpers.sliceFiles(helpers.root, referenced) : undefined
  const findingsList = findings
    .map(f => `- ${f.id} (${f.severity})${f.path ? ` @ ${f.path}` : ''}: ${f.title} — current advice: ${f.recommendation}`)
    .join('\n')

  const input = [
    `Repository summary:\n${helpers.summarizeEvidence(helpers.report)}`,
    `Findings to remediate:\n${findingsList}`,
    sliced?.text ? `Referenced files:\n${sliced.text}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return { promptVersion: PROMPT_VERSION, system: SYSTEM, input, outputSchema, maxTokens: 1200 }
}

const buildInsights = (output: unknown, model: string, report: LocalReadinessReport): LlmInsight[] => {
  const parsed = responseSchema.safeParse(output)
  if (!parsed.success) return []

  const findingsById = new Map(report.findings.map(f => [f.id, f]))
  const insights: LlmInsight[] = []
  const seen = new Set<string>()
  for (const item of parsed.data.remediations) {
    const finding = findingsById.get(item.findingId)
    if (!finding) continue // reject hallucinated finding ids
    if (seen.has(item.findingId)) continue // one remediation per finding
    seen.add(item.findingId)
    insights.push({
      id: `analysis.remediation:${item.findingId}`,
      kind: 'remediation',
      findingId: item.findingId,
      ...(finding.path ? { target: finding.path } : {}),
      verdict: `Repo-specific remediation for ${item.findingId}`,
      confidence: item.confidence,
      rationale: item.rationale,
      remediation: item.remediation,
      // Remediation is advisory — it explains how to fix, it does not change the
      // deterministic deduction, so it carries no score impact.
      model,
      promptVersion: PROMPT_VERSION,
    })
  }
  return insights
}

export const remediationAnalyzer: HostDelegatingAnalyzer = {
  id: 'remediation',
  task: 'remediation',

  applicable(report: LocalReadinessReport): boolean {
    return report.findings.length > 0
  },

  buildRequest,
  buildInsights,

  async run(context: AnalyzerContext): Promise<LlmInsight[]> {
    const { root, report, runner } = context
    const request = buildRequest({ root, report, sliceFiles, summarizeEvidence })
    if (!request) return []

    const outcome = await runner.run(
      {
        task: 'remediation',
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
