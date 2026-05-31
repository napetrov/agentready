#!/usr/bin/env node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  aggregate,
  analyzeReport,
  calibration,
  metricsFor,
  scoreCase,
  type CalibrationBucket,
  type EvaluationMetrics,
  type GoldLabel,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from '../lib/analyze'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

// Offline evaluation harness for the optional LLM analytics layer (design §11).
//
// AgentReady must never call a live model in its own tests, so each corpus case
// pairs a fixture repository with *canned* model responses (what a correct model
// would return) and gold labels (which insight ids should / should not appear).
// Running the real analyzer pipeline over the canned responses and scoring the
// produced insights against the labels measures the layer's plumbing end-to-end:
// the hallucination guards, score folding, and id derivation. A regression there
// (e.g. a broken guard that lets a hallucinated finding through) drops precision
// or recall below the floor and fails CI.
//
// The same harness can score a *live* model by swapping `corpusProvider` for a
// real provider in a one-off recording run; the canned responses then become the
// refreshed fixtures. That keeps day-to-day CI deterministic and offline.

/** Canned model outputs for a case, keyed by the analyzer that consumes them. */
interface CaseResponses {
  instructionQuality?: unknown
  contradiction?: unknown
  falsePositive?: unknown
}

interface CorpusCase {
  name: string
  /** Writes the fixture repository into `root`. */
  setup: (root: string) => void
  responses: CaseResponses
  labels: GoldLabel[]
}

const EMPTY: Required<CaseResponses> = {
  instructionQuality: { assessments: [] },
  contradiction: { contradictions: [] },
  falsePositive: { assessments: [] },
}

/**
 * A provider that returns each case's canned output, routed by a marker in the
 * analyzer's system prompt (each analyzer's prompt is distinct). No inference.
 */
export const corpusProvider = (responses: CaseResponses): LlmProvider => ({
  id: 'corpus',
  model: 'corpus@1',
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const output = request.system.includes('contradictions')
      ? responses.contradiction ?? EMPTY.contradiction
      : request.system.includes('false positives')
        ? responses.falsePositive ?? EMPTY.falsePositive
        : responses.instructionQuality ?? EMPTY.instructionQuality
    return { output, model: 'corpus@1' }
  },
})

const writeFiles = (root: string, files: Record<string, string>): void => {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
}

// The labeled gold corpus. Cases are designed so a correctly-functioning layer
// yields a clean confusion matrix; the hallucinated entries (GHOST paths / ghost
// finding ids) must be rejected by the guards (expected: false).
export const CORPUS: CorpusCase[] = [
  {
    name: 'conflicting-instructions',
    setup: root =>
      writeFiles(root, {
        'README.md': '# Demo\n',
        'AGENTS.md': 'Use npm. Run `npm test` to validate.\n',
        '.cursorrules': 'Use yarn. Run `mocha` to validate.\n',
        'package.json': JSON.stringify({ scripts: { test: 'jest' } }),
        '.github/workflows/ci.yml': 'name: CI\n',
      }),
    responses: {
      instructionQuality: {
        assessments: [
          { path: 'AGENTS.md', actionable: true, confidence: 0.9, rationale: 'clear commands', missing: [] },
          { path: '.cursorrules', actionable: true, confidence: 0.9, rationale: 'clear commands', missing: [] },
        ],
      },
      contradiction: {
        contradictions: [
          { paths: ['AGENTS.md', '.cursorrules'], topic: 'package manager', confidence: 0.9, rationale: 'npm vs yarn' },
        ],
      },
    },
    labels: [
      { id: 'analysis.instruction-quality:AGENTS.md', expected: true },
      { id: 'analysis.instruction-quality:.cursorrules', expected: true },
      { id: 'analysis.contradiction:package-manager:.cursorrules|AGENTS.md', expected: true },
    ],
  },
  {
    name: 'clean-instructions-with-hallucination',
    setup: root =>
      writeFiles(root, {
        'README.md': '# Demo\n',
        'AGENTS.md': 'Use npm. Run `npm test`.\n',
        'CLAUDE.md': 'Use npm. Run `npm test`.\n',
        'package.json': JSON.stringify({ scripts: { test: 'jest' } }),
        '.github/workflows/ci.yml': 'name: CI\n',
      }),
    responses: {
      instructionQuality: {
        assessments: [
          { path: 'AGENTS.md', actionable: true, confidence: 0.85, rationale: 'clear', missing: [] },
          { path: 'CLAUDE.md', actionable: true, confidence: 0.85, rationale: 'clear', missing: [] },
        ],
      },
      // A hallucinated conflict citing a path the repo does not have: the guard
      // must drop it, so the labeled id below stays absent (expected: false).
      contradiction: {
        contradictions: [
          { paths: ['AGENTS.md', 'GHOST.md'], topic: 'package manager', confidence: 1, rationale: 'invented' },
        ],
      },
    },
    labels: [
      { id: 'analysis.instruction-quality:AGENTS.md', expected: true },
      { id: 'analysis.instruction-quality:CLAUDE.md', expected: true },
      // Must NOT fire (only one valid path after the guard, and no real conflict).
      { id: 'analysis.contradiction:package-manager:AGENTS.md|GHOST.md', expected: false },
      { id: 'analysis.contradiction:package-manager:AGENTS.md|CLAUDE.md', expected: false },
    ],
  },
  {
    name: 'false-positive-fixture',
    setup: root =>
      writeFiles(root, {
        'README.md': '# Demo\n',
        'package.json': JSON.stringify({ scripts: { test: 'jest' } }),
        '.agentready.json': JSON.stringify({ largeFileWarningBytes: 50, largeFileErrorBytes: 100000 }),
        'fixtures-data.bin': 'x'.repeat(200),
      }),
    responses: {
      falsePositive: {
        assessments: [
          { findingId: 'files.large:fixtures-data.bin', likelyFalsePositive: true, confidence: 0.8, rationale: 'intentional fixture' },
          // Hallucinated finding id: the guard must drop it.
          { findingId: 'files.large:ghost', likelyFalsePositive: true, confidence: 1, rationale: 'invented' },
        ],
      },
    },
    labels: [
      { id: 'analysis.false-positive:files.large:fixtures-data.bin', expected: true },
      { id: 'analysis.false-positive:files.large:ghost', expected: false },
    ],
  },
]

export interface EvaluationReport {
  metrics: EvaluationMetrics
  calibration: CalibrationBucket[]
  perCase: Array<{ name: string; producedIds: string[] }>
}

const fixedNow = new Date('2026-05-30T00:00:00.000Z')

/** Runs every corpus case through the real analyzer pipeline and scores it. */
export const evaluateCorpus = async (corpus: CorpusCase[] = CORPUS): Promise<EvaluationReport> => {
  const confusions = []
  const perCase: EvaluationReport['perCase'] = []
  const calibrationInsights: Parameters<typeof calibration>[0] = []
  const expectedById = new Map<string, boolean>()

  for (const testCase of corpus) {
    const root = mkdtempSync(path.join(tmpdir(), 'agentready-eval-'))
    try {
      testCase.setup(root)
      const report = scanLocalReadiness(root, { now: fixedNow })
      const augmented = await analyzeReport(root, report, { provider: corpusProvider(testCase.responses), now: fixedNow })
      confusions.push(scoreCase(augmented.insights, testCase.labels))
      perCase.push({ name: testCase.name, producedIds: augmented.insights.map(i => i.id) })
      // Calibration needs an expected flag for every produced insight; labels
      // supply the intent, and any unlabeled insight defaults to "not expected".
      for (const label of testCase.labels) expectedById.set(label.id, label.expected)
      for (const insight of augmented.insights) {
        if (!expectedById.has(insight.id)) expectedById.set(insight.id, false)
      }
      calibrationInsights.push(...augmented.insights)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  return {
    metrics: metricsFor(aggregate(confusions)),
    calibration: calibration(calibrationInsights, expectedById),
    perCase,
  }
}

/** The CI floor: a correctly-functioning layer scores at or above these. */
export const FLOOR = { precision: 0.8, recall: 0.8, f1: 0.8 }

const main = async (): Promise<void> => {
  const { metrics, calibration: buckets, perCase } = await evaluateCorpus()
  console.log('AgentReady analytics-layer evaluation (offline, canned responses)\n')
  for (const c of perCase) console.log(`  ${c.name}: ${c.producedIds.length} insight(s)`)
  console.log('')
  console.log(`  precision: ${metrics.precision.toFixed(3)}  recall: ${metrics.recall.toFixed(3)}  f1: ${metrics.f1.toFixed(3)}`)
  console.log(`  confusion: TP=${metrics.truePositives} FP=${metrics.falsePositives} FN=${metrics.falseNegatives} TN=${metrics.trueNegatives}`)
  const populated = buckets.filter(b => b.count > 0)
  console.log(`  calibration buckets (populated): ${populated.length}`)

  const failures = (['precision', 'recall', 'f1'] as const).filter(k => metrics[k] < FLOOR[k])
  if (failures.length > 0) {
    console.error(`\nEvaluation below floor for: ${failures.join(', ')}`)
    process.exitCode = 1
    return
  }
  console.log('\nEvaluation passed the floor.')
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
