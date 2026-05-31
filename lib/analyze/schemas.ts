import { z } from 'zod'
import { localReadinessReportSchema } from '../repo-readiness/core/schemas'
import type {
  AnalysisProvenance,
  AugmentedReport,
  AugmentedScore,
  AugmentedScoreAdjustment,
  LlmInsight,
} from './types'

// Declarative schemas are the single source of truth for the analytics layer's
// runtime contracts, mirroring core/schemas.ts. `contracts.ts` validates
// insights and augmented reports against them, and the schema emitter derives
// published JSON Schema from them. The drift guards at the bottom fail the build
// if a schema stops matching the interface in `types.ts`.

export const insightKindSchema = z.enum([
  'false-positive',
  'quality',
  'contradiction',
  'remediation',
  'note',
])

export const llmInsightSchema = z.strictObject({
  id: z.string().min(1),
  kind: insightKindSchema,
  findingId: z.string().min(1).optional(),
  target: z.string().min(1).optional(),
  verdict: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  remediation: z.string().min(1).optional(),
  scoreImpact: z.number().optional(),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
})

export const augmentedScoreAdjustmentSchema = z.strictObject({
  insightId: z.string().min(1),
  delta: z.number(),
})

export const augmentedScoreSchema = z.strictObject({
  deterministic: z.number(),
  augmented: z.number(),
  adjustments: z.array(augmentedScoreAdjustmentSchema),
})

export const analysisProvenanceSchema = z.strictObject({
  enabled: z.boolean(),
  providers: z.array(z.string()),
  insightsConsidered: z.number().int().min(0),
  insightsApplied: z.number().int().min(0),
})

export const augmentedReportSchema = z.strictObject({
  baseReport: localReadinessReportSchema,
  generatedAt: z.string(),
  insights: z.array(llmInsightSchema),
  augmentedScore: augmentedScoreSchema,
  analysis: analysisProvenanceSchema,
})

// Compile-time drift guards: each alias resolves to `true` only when the
// schema's inferred output and the interface are *mutually* assignable, and is
// then assigned to a `true` constant — so a mismatch in either direction
// (schema drops/retypes a field, OR adds one the interface doesn't declare)
// produces a type error here. This is bidirectional, unlike a one-way `extends`.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const _insight: Exact<z.infer<typeof llmInsightSchema>, LlmInsight> = true
const _adjustment: Exact<z.infer<typeof augmentedScoreAdjustmentSchema>, AugmentedScoreAdjustment> = true
const _score: Exact<z.infer<typeof augmentedScoreSchema>, AugmentedScore> = true
const _provenance: Exact<z.infer<typeof analysisProvenanceSchema>, AnalysisProvenance> = true
const _report: Exact<z.infer<typeof augmentedReportSchema>, AugmentedReport> = true
// Reference the guards so they are not flagged as unused.
void _insight, _adjustment, _score, _provenance, _report
