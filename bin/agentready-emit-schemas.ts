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
  localReadinessConfigSchema,
  localReadinessReportSchema,
  readinessDiffReportSchema,
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

const render = (entry: SchemaEntry): string => {
  const jsonSchema = z.toJSONSchema(entry.schema, { target: 'draft-7' }) as Record<string, unknown>
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
