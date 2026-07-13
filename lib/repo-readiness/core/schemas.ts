import { z } from 'zod'
import type {
  CapabilitySurfaceEvidence,
  DesignStateSummary,
  DocumentSurfaceEvidence,
  CiEvidence,
  CommandEvidence,
  CommandReferenceEvidence,
  GovernanceEvidence,
  LocalReadinessConfig,
  LocalReadinessFile,
  LocalReadinessReport,
  PortfolioReport,
  RepositoryEvidence,
  ReadinessDiffReport,
  ReadinessDimensionScore,
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
export const commandEcosystemSchema = z.enum([
  'node',
  'make',
  'cmake',
  'bazel',
  'go',
  'rust',
  'python',
  'gradle',
  'maven',
  'dotnet',
  'autotools',
])
export const capabilityKindSchema = z.enum(['mcp', 'skill', 'hook', 'plugin', 'lsp'])
export const capabilityRiskTierSchema = z.enum(['low', 'medium', 'high'])
export const safetyCategorySchema = z.enum(['install-hook', 'destructive', 'network-exec', 'deploy'])
export const evidenceConfidenceSchema = z.enum(['low', 'medium', 'high'])
export const evidenceSourceKindSchema = z.enum(['file', 'manifest', 'workflow', 'config', 'inference'])
export const documentRoleSchema = z.enum([
  'entrypoint',
  'development',
  'architecture',
  'decision-record',
  'contribution',
  'environment',
  'agent-instruction',
  'operation',
  'api',
])
export const repositoryRootKindSchema = z.enum(['app', 'library', 'package', 'service', 'tool', 'docs', 'test', 'unknown'])
export const architectureBoundaryRoleSchema = z.enum([
  'entrypoint',
  'public-api',
  'internal-module',
  'adapter',
  'domain',
  'infrastructure',
  'test-support',
  'generated',
  'unknown',
])
export const readinessRuleCategorySchema = z.enum(['docs', 'commands', 'ci', 'instructions', 'files', 'safety'])

export const readinessDimensionScoreSchema = z.strictObject({
  category: readinessRuleCategorySchema,
  score: z.number().int().min(0).max(100),
  findingCount: z.number().int().min(0),
  bySeverity: z.strictObject({
    info: z.number().int().min(0),
    warning: z.number().int().min(0),
    error: z.number().int().min(0),
  }),
})

const DIMENSION_CATEGORY_COUNT = readinessRuleCategorySchema.options.length

/**
 * One entry per `readinessRuleCategorySchema` value. `.length` alone rejects
 * the `dimensions: []` case; combined with the size-6 uniqueness check below,
 * an array of exactly 6 distinct categories drawn from a 6-value enum is
 * necessarily a full, non-duplicated set, so a single refine covers both
 * "missing a category" and "reports one twice".
 */
export const readinessDimensionScoreListSchema = z
  .array(readinessDimensionScoreSchema)
  .length(DIMENSION_CATEGORY_COUNT)
  .refine(dimensions => new Set(dimensions.map(dimension => dimension.category)).size === DIMENSION_CATEGORY_COUNT, {
    error: `dimensions must include exactly one entry for each category (${readinessRuleCategorySchema.options.join(', ')})`,
  })

export const designStateCategorySchema = z.enum([
  'documentation-evidence',
  'architecture-boundary',
  'verification-locality',
  'context-selection',
  'generated-content',
  'safety',
  'agent-instruction',
  'ci-alignment',
])

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
  makeTargets: z.array(z.string()),
  hasBuild: z.boolean(),
  hasTest: z.boolean(),
  hasLint: z.boolean(),
  hasTypeCheck: z.boolean(),
})

export const commandReferenceKindSchema = z.enum(['npm-script', 'make-target', 'package-manager-mismatch'])

export const commandReferenceEvidenceSchema = z.strictObject({
  path: z.string(),
  reference: z.string(),
  kind: commandReferenceKindSchema,
  detail: z.string(),
})

export const governanceEvidenceSchema = z.strictObject({
  codeownersPath: z.string().optional(),
  pullRequestTemplatePath: z.string().optional(),
})

export const ciCommandKindSchema = z.enum(['install', 'lint', 'typecheck', 'test', 'build'])

export const ciWorkflowJobSchema = z.strictObject({
  id: z.string(),
  commandKinds: z.array(ciCommandKindSchema),
  concreteKinds: z.array(ciCommandKindSchema),
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
  riskTier: capabilityRiskTierSchema,
})

export const safetySignalSchema = z.strictObject({
  category: safetyCategorySchema,
  source: z.string(),
  script: z.string(),
  command: z.string(),
  notes: z.array(z.string()),
})

export const evidenceSourceSchema = z.strictObject({
  detector: z.string(),
  kind: evidenceSourceKindSchema,
  path: z.string().optional(),
  note: z.string().optional(),
})

export const evidenceClaimSchema = z.strictObject({
  kind: z.string(),
  value: z.string(),
  confidence: evidenceConfidenceSchema,
  signals: z.array(z.string()),
  sources: z.array(evidenceSourceSchema),
})

export const documentCommandBlockSchema = z.strictObject({
  index: z.number().int().min(0),
  language: z.string().optional(),
  text: z.string(),
  truncated: z.boolean(),
})

export const documentSurfaceSchema = z.strictObject({
  id: z.string(),
  kind: z.literal('document-surface'),
  path: z.string(),
  paths: z.array(z.string()),
  roleClaims: z.array(evidenceClaimSchema.extend({
    kind: z.literal('document-role'),
    value: documentRoleSchema,
  })),
  title: z.string().optional(),
  headings: z.array(z.string()),
  linkedPaths: z.array(z.string()),
  commandBlocks: z.array(documentCommandBlockSchema),
  sources: z.array(evidenceSourceSchema),
})

export const repositoryRootSchema = z.strictObject({
  id: z.string(),
  kind: z.literal('repository-root'),
  rootKind: repositoryRootKindSchema,
  path: z.string(),
  paths: z.array(z.string()),
  languages: z.array(z.string()),
  packageManager: packageManagerSchema.optional(),
  manifests: z.array(z.string()),
  sourceFiles: z.number(),
  testFiles: z.number(),
  documentationFiles: z.number(),
  generatedFiles: z.number(),
  confidence: evidenceConfidenceSchema,
  sources: z.array(evidenceSourceSchema),
})

export const architectureBoundarySchema = z.strictObject({
  id: z.string(),
  kind: z.literal('architecture-boundary'),
  path: z.string(),
  paths: z.array(z.string()),
  role: architectureBoundaryRoleSchema,
  signals: z.array(z.string()),
  confidence: evidenceConfidenceSchema,
  sources: z.array(evidenceSourceSchema),
})

export const verificationSurfaceSchema = z.strictObject({
  id: z.string(),
  kind: z.literal('verification-surface'),
  paths: z.array(z.string()),
  rootIds: z.array(z.string()),
  commandKind: ciCommandKindSchema,
  commandText: z.string().optional(),
  workflowJobId: z.string().optional(),
  confidence: evidenceConfidenceSchema,
  sources: z.array(evidenceSourceSchema),
})

export const dependencyHintSchema = z.strictObject({
  id: z.string(),
  kind: z.literal('dependency-hint'),
  paths: z.array(z.string()),
  sources: z.array(evidenceSourceSchema),
  fromRootId: z.string(),
  toRootId: z.string().optional(),
  relationship: z.enum(['workspace', 'manifest', 'import-path', 'unknown']),
  confidence: evidenceConfidenceSchema,
})

export const testProximityHintSchema = z.strictObject({
  id: z.string(),
  kind: z.literal('test-proximity-hint'),
  paths: z.array(z.string()),
  sources: z.array(evidenceSourceSchema),
  rootId: z.string(),
  nearbyTestPaths: z.array(z.string()),
  confidence: evidenceConfidenceSchema,
})

export const documentationProximityHintSchema = z.strictObject({
  id: z.string(),
  kind: z.literal('documentation-proximity-hint'),
  paths: z.array(z.string()),
  sources: z.array(evidenceSourceSchema),
  rootId: z.string(),
  documentSurfaceIds: z.array(z.string()),
  roleClaims: z.array(documentRoleSchema),
  confidence: evidenceConfidenceSchema,
})

export const generatedPressureSchema = z.strictObject({
  id: z.string(),
  kind: z.literal('generated-pressure'),
  paths: z.array(z.string()),
  sources: z.array(evidenceSourceSchema),
  rootId: z.string(),
  generatedFileRatio: z.number(),
  generatedBytesRatio: z.number(),
  confidence: evidenceConfidenceSchema,
})

export const repositoryTopologySchema = z.strictObject({
  dependencyHints: z.array(dependencyHintSchema),
  testProximityHints: z.array(testProximityHintSchema),
  documentationProximityHints: z.array(documentationProximityHintSchema),
  generatedPressure: z.array(generatedPressureSchema),
  metrics: z.strictObject({
    rootCount: z.number(),
    languageCount: z.number(),
    sourceToNearbyTestRatio: z.number().optional(),
    docsToSourceProximityRatio: z.number().optional(),
    generatedFileRatio: z.number(),
    largestRootShare: z.number(),
    publicApiSurfaceCount: z.number(),
    rootsWithoutLocalTests: z.number(),
    rootsWithoutLocalDocs: z.number(),
    verificationMappedRootCount: z.number(),
  }),
})

export const repositoryEvidenceSchema = z.strictObject({
  roots: z.array(repositoryRootSchema),
  boundaries: z.array(architectureBoundarySchema),
  documentSurfaces: z.array(documentSurfaceSchema),
  verificationSurfaces: z.array(verificationSurfaceSchema),
  topology: repositoryTopologySchema,
})

export const designStateInsightSchema = z.strictObject({
  id: z.string(),
  category: designStateCategorySchema,
  title: z.string(),
  severity: severitySchema,
  gateable: z.boolean(),
  summary: z.string(),
  evidenceIds: z.array(z.string()),
  findingIds: z.array(z.string()).optional(),
  paths: z.array(z.string()),
  confidence: evidenceConfidenceSchema,
  recommendation: z.string().optional(),
})

export const designStateSummarySchema = z.strictObject({
  strengths: z.array(designStateInsightSchema),
  risks: z.array(designStateInsightSchema),
  ambiguities: z.array(designStateInsightSchema),
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
  commandReferences: z.array(commandReferenceEvidenceSchema),
  governance: governanceEvidenceSchema,
  ci: ciEvidenceSchema,
  instructions: z.array(instructionSurfaceSchema),
  capabilities: z.array(capabilitySurfaceSchema),
  safetySignals: z.array(safetySignalSchema),
  repositoryEvidence: repositoryEvidenceSchema,
  designState: designStateSummarySchema,
  dimensions: readinessDimensionScoreListSchema,
  reportContract: z.strictObject({
    schemaVersion: z.literal('local-readiness/v2'),
    experimentalFields: z.array(z.enum(['repositoryEvidence', 'designState', 'dimensions'])),
  }),
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

const severityCountsSchema = z.strictObject({
  info: z.number().int().min(0),
  warning: z.number().int().min(0),
  error: z.number().int().min(0),
})

export const portfolioRepoResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    path: z.string(),
    ok: z.literal(true),
    score: z.number(),
    findingCount: z.number().int().min(0),
    bySeverity: severityCountsSchema,
    topFindings: z.array(readinessFindingSchema),
  }),
  z.strictObject({
    path: z.string(),
    ok: z.literal(false),
    error: z.string(),
  }),
])

export const portfolioSummarySchema = z.strictObject({
  repoCount: z.number().int().min(0),
  scannedCount: z.number().int().min(0),
  scanErrorCount: z.number().int().min(0),
  averageScore: z.number().nullable(),
  minScore: z.number().nullable(),
  maxScore: z.number().nullable(),
  totalFindings: z.number().int().min(0),
  bySeverity: severityCountsSchema,
})

export const portfolioReportSchema = z.strictObject({
  generatedAt: z.string(),
  repos: z.array(portfolioRepoResultSchema),
  summary: portfolioSummarySchema,
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

// Compile-time drift guards: each alias resolves to `true` only when the
// schema's inferred output and the interface are mutually assignable. A
// mismatch in either direction (schema drops/retypes a field, OR interface adds
// one the schema does not emit) produces a type error here.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const assertSchemaDriftGuards = (..._guards: true[]): void => {}
const _finding: Exact<z.infer<typeof readinessFindingSchema>, ReadinessFinding> = true
const _file: Exact<z.infer<typeof localReadinessFileSchema>, LocalReadinessFile> = true
const _commands: Exact<z.infer<typeof commandEvidenceSchema>, CommandEvidence> = true
const _commandReference: Exact<z.infer<typeof commandReferenceEvidenceSchema>, CommandReferenceEvidence> = true
const _governance: Exact<z.infer<typeof governanceEvidenceSchema>, GovernanceEvidence> = true
const _capabilitySurface: Exact<z.infer<typeof capabilitySurfaceSchema>, CapabilitySurfaceEvidence> = true
const _ci: Exact<z.infer<typeof ciEvidenceSchema>, CiEvidence> = true
const _documentSurface: Exact<z.infer<typeof documentSurfaceSchema>, DocumentSurfaceEvidence> = true
const _repositoryEvidence: Exact<z.infer<typeof repositoryEvidenceSchema>, RepositoryEvidence> = true
const _designState: Exact<z.infer<typeof designStateSummarySchema>, DesignStateSummary> = true
const _dimensionScore: Exact<z.infer<typeof readinessDimensionScoreSchema>, ReadinessDimensionScore> = true
const _report: Exact<z.infer<typeof localReadinessReportSchema>, LocalReadinessReport> = true
const _diff: Exact<z.infer<typeof readinessDiffReportSchema>, ReadinessDiffReport> = true
const _portfolio: Exact<z.infer<typeof portfolioReportSchema>, PortfolioReport> = true
const _config: Exact<z.infer<typeof localReadinessConfigSchema>, Partial<LocalReadinessConfig>> = true
assertSchemaDriftGuards(
  _finding,
  _file,
  _commands,
  _commandReference,
  _governance,
  _ci,
  _documentSurface,
  _repositoryEvidence,
  _designState,
  _dimensionScore,
  _report,
  _diff,
  _config,
)
