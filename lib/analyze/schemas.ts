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

// Compile-time drift guards: these aliases fail to type-check if a schema's
// inferred output stops matching the interface it represents.
type AssertExtends<Actual extends Expected, Expected> = Actual
type _Insight = AssertExtends<z.infer<typeof llmInsightSchema>, LlmInsight>
type _Adjustment = AssertExtends<z.infer<typeof augmentedScoreAdjustmentSchema>, AugmentedScoreAdjustment>
type _Score = AssertExtends<z.infer<typeof augmentedScoreSchema>, AugmentedScore>
type _Provenance = AssertExtends<z.infer<typeof analysisProvenanceSchema>, AnalysisProvenance>
type _Report = AssertExtends<z.infer<typeof augmentedReportSchema>, AugmentedReport>
