#!/usr/bin/env node
// Derives published JSON Schema from the Zod schemas that back AgentReady's
// runtime contracts, so editors and CI can validate config and reports against
// the same source of truth the scanner uses.
//
//   npm run agentready:schemas           # (re)write schemas/*.json
//   npm run agentready:schemas -- --check # fail if committed schemas are stale
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import {
  agentStageSchema,
  autonomyStageResultListSchema,
  localReadinessConfigSchema,
  localReadinessReportSchema,
  portfolioReportSchema,
  readinessDiffReportSchema,
  readinessDimensionScoreListSchema,
  readinessRuleCategorySchema,
} from '../lib/repo-readiness/local-readiness'
import { augmentedReportSchema, llmInsightSchema } from '../lib/analyze'

const repoRoot = process.cwd()
const schemasDir = path.join(repoRoot, 'schemas')

const { version } = JSON.parse(
  readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
) as { version: string }

const baseId = 'https://napetrov.github.io/agentready/schemas'

interface SchemaEntry {
  file: string
  id: string
  title: string
  schema: z.ZodType
}

const entries: SchemaEntry[] = [
  {
    file: 'config.schema.json',
    id: 'config',
    title: 'AgentReady configuration',
    schema: localReadinessConfigSchema,
  },
  {
    file: 'local-readiness-report.schema.json',
    id: 'local-readiness-report',
    title: 'AgentReady scan report',
    schema: localReadinessReportSchema,
  },
  {
    file: 'readiness-diff-report.schema.json',
    id: 'readiness-diff-report',
    title: 'AgentReady diff report',
    schema: readinessDiffReportSchema,
  },
  {
    file: 'portfolio-report.schema.json',
    id: 'portfolio-report',
    title: 'AgentReady portfolio (multi-repo) scan report',
    schema: portfolioReportSchema,
  },
  {
    file: 'llm-insight.schema.json',
    id: 'llm-insight',
    title: 'AgentReady LLM insight',
    schema: llmInsightSchema,
  },
  {
    file: 'augmented-report.schema.json',
    id: 'augmented-report',
    title: 'AgentReady augmented report',
    schema: augmentedReportSchema,
  },
]

// draft-7 has no keyword for "distinct values of a sub-property across array
// items" (that needs 2019-09's minContains/maxContains), but combining
// `contains` (supported since draft-6) with the schema's own `.length(6)`
// gets the same result by pigeonhole: requiring each of the 6 categories to
// appear at least once in an array of exactly 6 items forces each to appear
// exactly once. This mirrors the runtime Zod `.refine()` uniqueness check in
// `readinessDimensionScoreListSchema`, which JSON Schema can't otherwise
// express, so generated consumers (CI, editors) reject the same malformed
// `dimensions` arrays the scanner's own runtime validation does.
const isSchema = (candidate: unknown, target: z.ZodType): boolean => candidate === target

const dimensionCategoryOverride = (ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }): void => {
  if (!isSchema(ctx.zodSchema, readinessDimensionScoreListSchema)) return
  ctx.jsonSchema.allOf = readinessRuleCategorySchema.options.map(category => ({
    contains: { properties: { category: { const: category } } },
  }))
}

// Same pigeonhole trick as `dimensionCategoryOverride`, for `AGENT_STAGES`
// instead of `RULE_CATEGORIES` -- mirrors the runtime Zod `.refine()`
// uniqueness check in `autonomyStageResultListSchema`.
const autonomyStageOverride = (ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }): void => {
  if (!isSchema(ctx.zodSchema, autonomyStageResultListSchema)) return
  ctx.jsonSchema.allOf = agentStageSchema.options.map(stage => ({
    contains: { properties: { stage: { const: stage } } },
  }))
}

// draft-07 tuple validation is `items: [schema1, schema2, ...]` with no
// implied length bound — an array with fewer or extra elements still passes
// unless `minItems`/`maxItems` are set explicitly. `z.toJSONSchema` does not
// add them for a fixed-length (non-rest) Zod tuple, so every such tuple gets
// them here rather than as a one-off patch on a single field.
const isFixedLengthTupleSchema = (
  candidate: unknown,
): candidate is { def: { type: 'tuple'; items: unknown[]; rest: null } } => (
  typeof candidate === 'object'
  && candidate !== null
  && 'def' in candidate
  && typeof (candidate as { def?: unknown }).def === 'object'
  && (candidate as { def: { type?: unknown } }).def !== null
  && (candidate as { def: { type?: unknown } }).def.type === 'tuple'
  && (candidate as { def: { rest?: unknown } }).def.rest === null
)

const tupleLengthOverride = (ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }): void => {
  if (!isFixedLengthTupleSchema(ctx.zodSchema)) return
  const length = ctx.zodSchema.def.items.length
  ctx.jsonSchema.minItems = length
  ctx.jsonSchema.maxItems = length
}

const combinedOverride = (ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }): void => {
  dimensionCategoryOverride(ctx)
  autonomyStageOverride(ctx)
  tupleLengthOverride(ctx)
}

const render = (entry: SchemaEntry): string => {
  const jsonSchema = z.toJSONSchema(entry.schema, {
    target: 'draft-7',
    override: combinedOverride,
  }) as Record<string, unknown>
  const document = {
    $id: `${baseId}/v${version}/${entry.id}.schema.json`,
    title: entry.title,
    ...jsonSchema,
  }
  return `${JSON.stringify(document, null, 2)}\n`
}

const check = process.argv.includes('--check')
const stale: string[] = []

for (const entry of entries) {
  const target = path.join(schemasDir, entry.file)
  const rendered = render(entry)

  if (check) {
    let current = ''
    try {
      current = readFileSync(target, 'utf8')
    } catch {
      current = ''
    }
    if (current !== rendered) {
      stale.push(entry.file)
    }
  } else {
    writeFileSync(target, rendered)
    console.log(`wrote schemas/${entry.file}`)
  }
}

if (check) {
  if (stale.length > 0) {
    console.error(
      `Schemas are out of date: ${stale.join(', ')}. Run "npm run agentready:schemas" and commit the result.`,
    )
    process.exitCode = 1
  } else {
    console.log('Schemas are up to date.')
  }
}
