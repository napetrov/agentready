import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import {
  adjustFindings,
  applyPolicy,
  diffLocalReadiness,
  evaluateDiffGate,
  evaluateScanGate,
  formatDiffMarkdown,
  formatPolicySummary,
  formatScanMarkdown,
  formatScanSarif,
  resolvePolicyPack,
  scanLocalReadiness,
  type FailOnSeverity,
  type LocalReadinessReport,
  type PolicyName,
  type PolicyPack,
  type ReadinessDiffReport,
  type ReadinessFinding,
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
  /** Policy pack name; defaults to 'default' (a no-op) when not set. */
  policy?: PolicyName
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
  /** Number of findings the policy pack adjusted the severity of (0 for the default policy). */
  policyAdjustmentsCount: number
  /** The policy-adjusted score, when a non-default policy ran. `score` is always the raw, policy-independent value. */
  policyEffectiveScore?: number
}

interface PolicySummary {
  effectiveScore: number
  adjustmentsCount: number
  summaryText: string
}

/**
 * Shared by both scan and diff mode: applies `policy` to `report` for the
 * effective score/adjustment summary, but counts adjustments over
 * `adjustmentTargetFindings` — the full report in scan mode, only
 * `newFindings` in diff mode (matching evaluateDiffGate's severity gate,
 * which reacts to new findings, not the whole head report).
 */
const summarizePolicy = (
  policy: PolicyPack,
  report: LocalReadinessReport,
  adjustmentTargetFindings: ReadinessFinding[],
): PolicySummary => {
  const policyResult = applyPolicy(report, policy)
  return {
    effectiveScore: policyResult.effectiveScore,
    adjustmentsCount: adjustFindings(adjustmentTargetFindings, policy).severityAdjustments.length,
    summaryText: formatPolicySummary(policyResult),
  }
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
  const policy = resolvePolicyPack(inputs.policy ?? 'default')
  if (!policy) {
    throw new Error(`unknown policy "${inputs.policy}"`)
  }

  const failureReasons: string[] = []
  let score: number
  let findingsCount: number
  let regressionsCount = 0
  let summaryMarkdown: string
  let sarifSource: LocalReadinessReport
  // The deterministic scan report, captured for the optional analyze step. In
  // diff mode this is the head report.
  let scanReport: LocalReadinessReport
  let policyAdjustmentsCount = 0
  // score/report outputs stay the raw deterministic values, matching how
  // augmentedScore is a separate additive output rather than overwriting
  // score — only set when a non-default policy actually adjusted something.
  let policyEffectiveScore: number | undefined

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

    score = report.headReport.summary.score
    findingsCount = report.newFindings.length
    regressionsCount = report.regressions.length
    sarifSource = report.headReport
    scanReport = report.headReport

    if (policy.name !== 'default') {
      const summary = summarizePolicy(policy, report.headReport, report.newFindings)
      policyEffectiveScore = summary.effectiveScore
      policyAdjustmentsCount = summary.adjustmentsCount
      summaryMarkdown = `${summaryMarkdown}\n\n---\n\n${summary.summaryText}`
    }

    failureReasons.push(
      ...evaluateDiffGate(report, {
        failOnSeverity: inputs.failOnSeverity,
        failOnRegression: inputs.failOnRegression,
        minScore: inputs.minScore,
        policy,
      }).failureReasons,
    )
  } else {
    const report: LocalReadinessReport = scanLocalReadiness(inputs.path, { configPath: inputs.configPath })
    writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`)
    summaryMarkdown = formatScanMarkdown(report)

    score = report.summary.score
    findingsCount = report.findings.length
    sarifSource = report
    scanReport = report

    if (policy.name !== 'default') {
      const summary = summarizePolicy(policy, report, report.findings)
      policyEffectiveScore = summary.effectiveScore
      policyAdjustmentsCount = summary.adjustmentsCount
      summaryMarkdown = `${summaryMarkdown}\n\n---\n\n${summary.summaryText}`
    }

    failureReasons.push(
      ...evaluateScanGate(report, {
        failOnSeverity: inputs.failOnSeverity,
        minScore: inputs.minScore,
        policy,
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
    // Opt-in LLM augmentation. analyzeReport (and the runner in
    // lib/analyze/runner.ts) are fail-open over analyzer/provider failures: a
    // missing provider or a failed/timed-out call yields a deterministic-only or
    // partial augmented report instead of throwing. (The surrounding I/O here —
    // writeFileSync/path.join — can still throw, as elsewhere in runAction.)
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

  // Written once, after every summaryMarkdown mutation above (policy summary,
  // augmented analysis) — otherwise the markdown-report-path artifact stays
  // raw while the job summary/PR comment (same summaryMarkdown value) carries
  // the full picture, which is misleading for anyone who uploads or inspects
  // that file directly.
  writeFileSync(markdownReportPath, `${summaryMarkdown}\n`)

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
    policyAdjustmentsCount,
    ...(augmentedScore !== undefined ? { augmentedScore } : {}),
    ...(augmentedReportPath !== undefined ? { augmentedReportPath } : {}),
    ...(policyEffectiveScore !== undefined ? { policyEffectiveScore } : {}),
  }
}
