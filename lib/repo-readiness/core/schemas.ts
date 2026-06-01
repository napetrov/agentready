import { z } from 'zod'
import type {
  CiEvidence,
  CommandEvidence,
  LocalReadinessConfig,
  LocalReadinessFile,
  LocalReadinessReport,
  ReadinessDiffReport,
  ReadinessFinding,
} from './types'

// Declarative schemas are the single source of truth for AgentReady's runtime
// contracts. `contracts.ts` validates reports against them, `config.ts`
// validates user config against them, and `bin/agentready-emit-schemas.ts`
// derives published JSON Schema from them. Keep these in sync with the
// interfaces in `types.ts`; the type-compatibility checks at the bottom of this
// file fail the build if they drift.

export const severitySchema = z.enum(['info', 'warning', 'error'])
export const packageManagerSchema = z.enum(['npm', 'pnpm', 'yarn', 'bun'])
export const commandEcosystemSchema = z.enum(['node', 'make', 'cmake', 'bazel', 'go', 'rust', 'python'])
export const capabilityKindSchema = z.enum(['mcp', 'skill', 'hook', 'plugin', 'lsp'])
export const safetyCategorySchema = z.enum(['install-hook', 'destructive', 'network-exec', 'deploy'])

export const instructionEcosystemSchema = z.enum([
  'codex',
  'claude-code',
  'github-copilot',
  'cursor',
  'gemini',
  'windsurf',
  'cline',
  'roo-code',
  'generic-agent',
])
export const instructionScopeSchema = z.enum([
  'root',
  'path-specific',
  'mode-specific',
  'local-private',
  'legacy',
  'capability',
  'unknown',
])
export const instructionActivationSchema = z.enum([
  'always',
  'path-scoped',
  'mode-scoped',
  'manual',
  'on-demand',
  'unknown',
])

export const readinessFindingSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: severitySchema,
  path: z.string().optional(),
  recommendation: z.string().min(1),
})

export const localReadinessFileSchema = z.strictObject({
  path: z.string(),
  sizeBytes: z.number(),
  extension: z.string(),
  binary: z.boolean(),
  generated: z.boolean(),
  minified: z.boolean(),
  documentation: z.boolean(),
  test: z.boolean(),
  source: z.boolean(),
})

export const commandEvidenceSchema = z.strictObject({
  packageManager: packageManagerSchema.optional(),
  ecosystems: z.array(commandEcosystemSchema),
  scripts: z.array(z.string()),
  hasBuild: z.boolean(),
  hasTest: z.boolean(),
  hasLint: z.boolean(),
  hasTypeCheck: z.boolean(),
})

export const ciCommandKindSchema = z.enum(['install', 'lint', 'typecheck', 'test', 'build'])

export const ciWorkflowJobSchema = z.strictObject({
  id: z.string(),
  commandKinds: z.array(ciCommandKindSchema),
})

export const ciWorkflowSchema = z.strictObject({
  file: z.string(),
  name: z.string().optional(),
  jobs: z.array(ciWorkflowJobSchema),
})

export const ciEvidenceSchema = z.strictObject({
  workflowFiles: z.array(z.string()),
  workflows: z.array(ciWorkflowSchema),
  hasInstall: z.boolean(),
  hasLint: z.boolean(),
  hasTypeCheck: z.boolean(),
  hasTest: z.boolean(),
  hasBuild: z.boolean(),
  orchestratorKinds: z.array(ciCommandKindSchema),
})

export const capabilitySurfaceSchema = z.strictObject({
  kind: capabilityKindSchema,
  path: z.string(),
  tool: z.string(),
  notes: z.array(z.string()),
})

export const safetySignalSchema = z.strictObject({
  category: safetyCategorySchema,
  source: z.string(),
  script: z.string(),
  command: z.string(),
  notes: z.array(z.string()),
})

export const instructionSurfaceSchema = z.strictObject({
  path: z.string(),
  ecosystems: z.array(instructionEcosystemSchema),
  scope: instructionScopeSchema,
  activation: instructionActivationSchema,
  sizeBytes: z.number().optional(),
  directoryScope: z.string().optional(),
  mode: z.string().optional(),
  legacy: z.boolean(),
  localPrivate: z.boolean(),
  notes: z.array(z.string()),
})

export const localReadinessReportSchema = z.strictObject({
  root: z.string(),
  generatedAt: z.string(),
  summary: z.strictObject({
    score: z.number(),
    totalFiles: z.number(),
    totalBytes: z.number(),
    sourceFiles: z.number(),
    testFiles: z.number(),
    documentationFiles: z.number(),
    largeFiles: z.number(),
    binaryFiles: z.number(),
    generatedFiles: z.number(),
    minifiedFiles: z.number(),
  }),
  docs: z.strictObject({
    readme: z.array(z.string()),
    contributing: z.array(z.string()),
    architecture: z.array(z.string()),
    environment: z.array(z.string()),
  }),
  commands: commandEvidenceSchema,
  ci: ciEvidenceSchema,
  instructions: z.array(instructionSurfaceSchema),
  capabilities: z.array(capabilitySurfaceSchema),
  safetySignals: z.array(safetySignalSchema),
  findings: z.array(readinessFindingSchema),
  files: z.array(localReadinessFileSchema),
})

export const readinessDiffReportSchema = z.strictObject({
  base: z.string(),
  head: z.string(),
  generatedAt: z.string(),
  baseReport: localReadinessReportSchema,
  headReport: localReadinessReportSchema,
  summary: z.strictObject({
    scoreDelta: z.number(),
    filesDelta: z.number(),
    bytesDelta: z.number(),
    findingsDelta: z.number(),
    newFindings: z.number(),
    resolvedFindings: z.number(),
  }),
  newFindings: z.array(readinessFindingSchema),
  resolvedFindings: z.array(readinessFindingSchema),
  regressions: z.array(readinessFindingSchema),
})

// User-facing config. Every field is optional; the loader merges the result
// over `defaultConfig`. Custom messages keep validation errors readable.
export const localReadinessConfigSchema = z
  .object({
    ignorePaths: z.array(z.string(), { error: 'must be an array of strings' }),
    largeFileWarningBytes: z.int({ error: 'must be a non-negative integer' }).min(0, { error: 'must be a non-negative integer' }),
    largeFileErrorBytes: z.int({ error: 'must be a non-negative integer' }).min(0, { error: 'must be a non-negative integer' }),
    allowMinifiedFiles: z.boolean({ error: 'must be a boolean' }),
    errorOnWarnings: z.boolean({ error: 'must be a boolean' }),
  })
  .partial()
  .strict()

// Compile-time drift guards: these aliases fail to type-check if a schema's
// inferred output stops matching the interface it represents.
type AssertExtends<Actual extends Expected, Expected> = Actual
type _Finding = AssertExtends<z.infer<typeof readinessFindingSchema>, ReadinessFinding>
type _File = AssertExtends<z.infer<typeof localReadinessFileSchema>, LocalReadinessFile>
type _Commands = AssertExtends<z.infer<typeof commandEvidenceSchema>, CommandEvidence>
type _Ci = AssertExtends<z.infer<typeof ciEvidenceSchema>, CiEvidence>
type _Report = AssertExtends<z.infer<typeof localReadinessReportSchema>, LocalReadinessReport>
type _Diff = AssertExtends<z.infer<typeof readinessDiffReportSchema>, ReadinessDiffReport>
type _Config = AssertExtends<z.infer<typeof localReadinessConfigSchema>, Partial<LocalReadinessConfig>>
