import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import {
  diffLocalReadiness,
  evaluateDiffGate,
  evaluateScanGate,
  formatDiffMarkdown,
  formatScanMarkdown,
  formatScanSarif,
  scanLocalReadiness,
  type FailOnSeverity,
  type LocalReadinessReport,
  type ReadinessDiffReport,
} from '../repo-readiness/local-readiness'
import {
  analyzeReport,
  detectProvider,
  formatAugmentedMarkdown,
  type AugmentedReport,
} from '../analyze'

export type ActionMode = 'scan' | 'diff'
export type { FailOnSeverity }

export interface ActionInputs {
  path: string
  mode: ActionMode
  baseRef?: string
  headRef?: string
  configPath?: string
  failOnSeverity: FailOnSeverity
  failOnRegression: boolean
  minScore?: number
  sarif: boolean
  /** Directory the report artifacts are written to. */
  outputDir: string
  /** Tool version recorded in the SARIF driver, when known. */
  toolVersion?: string
  /** Run the optional LLM analytics layer after the deterministic gates. */
  analyze?: boolean
  /** Fail when the augmented score drops below this value (0-100). */
  analyzeMinScore?: number
  /** Environment used for provider auto-detection (defaults to process.env). */
  env?: Record<string, string | undefined>
}

export interface ActionResult {
  score: number
  findingsCount: number
  regressionsCount: number
  jsonReportPath: string
  markdownReportPath: string
  sarifReportPath?: string
  /** Markdown suitable for a GitHub job summary / PR comment. */
  summaryMarkdown: string
  /** Whether the configured gates failed the run, with human-readable reasons. */
  failed: boolean
  failureReasons: string[]
  /** The augmented score, when the analytics layer ran. */
  augmentedScore?: number
  /** Path to the written augmented report, when the analytics layer ran. */
  augmentedReportPath?: string
}

/**
 * Runs a scan or diff, writes report artifacts, and evaluates the configured
 * gates. This is intentionally free of any GitHub Actions dependency so it can
 * be unit-tested directly; `index.ts` adapts it to the Actions runtime.
 */
export const runAction = async (inputs: ActionInputs): Promise<ActionResult> => {
  mkdirSync(inputs.outputDir, { recursive: true })
  const jsonReportPath = path.join(inputs.outputDir, 'report.json')
  const markdownReportPath = path.join(inputs.outputDir, 'report.md')
  const sarifReportPath = inputs.sarif ? path.join(inputs.outputDir, 'report.sarif') : undefined

  const failureReasons: string[] = []
  let score: number
  let findingsCount: number
  let regressionsCount = 0
  let summaryMarkdown: string
  let sarifSource: LocalReadinessReport
  // The deterministic scan report, captured for the optional analyze step. In
  // diff mode this is the head report.
  let scanReport: LocalReadinessReport

  if (inputs.mode === 'diff') {
    if (!inputs.baseRef || !inputs.headRef) {
      throw new Error('diff mode requires base-ref and head-ref inputs')
    }
    const report: ReadinessDiffReport = diffLocalReadiness(inputs.path, {
      base: inputs.baseRef,
      head: inputs.headRef,
      configPath: inputs.configPath,
    })
    writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`)
    summaryMarkdown = formatDiffMarkdown(report)
    writeFileSync(markdownReportPath, `${summaryMarkdown}\n`)

    score = report.headReport.summary.score
    findingsCount = report.newFindings.length
    regressionsCount = report.regressions.length
    sarifSource = report.headReport
    scanReport = report.headReport

    failureReasons.push(
      ...evaluateDiffGate(report, {
        failOnSeverity: inputs.failOnSeverity,
        failOnRegression: inputs.failOnRegression,
        minScore: inputs.minScore,
      }).failureReasons,
    )
  } else {
    const report: LocalReadinessReport = scanLocalReadiness(inputs.path, { configPath: inputs.configPath })
    writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`)
    summaryMarkdown = formatScanMarkdown(report)
    writeFileSync(markdownReportPath, `${summaryMarkdown}\n`)

    score = report.summary.score
    findingsCount = report.findings.length
    sarifSource = report
    scanReport = report

    failureReasons.push(
      ...evaluateScanGate(report, {
        failOnSeverity: inputs.failOnSeverity,
        minScore: inputs.minScore,
      }).failureReasons,
    )
  }

  if (sarifReportPath) {
    const sarif = formatScanSarif(sarifSource, { toolVersion: inputs.toolVersion })
    writeFileSync(sarifReportPath, `${JSON.stringify(sarif, null, 2)}\n`)
  }

  let augmentedScore: number | undefined
  let augmentedReportPath: string | undefined

  if (inputs.analyze) {
    // Opt-in LLM augmentation. Fail-open: a missing provider or any analyzer
    // failure yields a deterministic-only augmented report and never throws.
    const detected = detectProvider(inputs.env ?? process.env)
    const augmented: AugmentedReport = await analyzeReport(inputs.path, scanReport, {
      provider: detected?.provider,
    })
    augmentedReportPath = path.join(inputs.outputDir, 'augmented-report.json')
    writeFileSync(augmentedReportPath, `${JSON.stringify(augmented, null, 2)}\n`)
    augmentedScore = augmented.augmentedScore.augmented

    // Append the augmented analysis to the job summary so it surfaces in CI.
    summaryMarkdown = `${summaryMarkdown}\n\n---\n\n${formatAugmentedMarkdown(augmented)}`

    // Gate on the augmented score only when explicitly configured.
    if (inputs.analyzeMinScore !== undefined && augmentedScore < inputs.analyzeMinScore) {
      failureReasons.push(`augmented score ${augmentedScore} is below the minimum ${inputs.analyzeMinScore}`)
    }
  }

  return {
    score,
    findingsCount,
    regressionsCount,
    jsonReportPath,
    markdownReportPath,
    sarifReportPath,
    summaryMarkdown,
    failed: failureReasons.length > 0,
    failureReasons,
    ...(augmentedScore !== undefined ? { augmentedScore } : {}),
    ...(augmentedReportPath !== undefined ? { augmentedReportPath } : {}),
  }
}
