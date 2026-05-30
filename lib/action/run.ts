import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import {
  diffLocalReadiness,
  formatDiffMarkdown,
  formatScanMarkdown,
  formatScanSarif,
  scanLocalReadiness,
  type LocalReadinessReport,
  type ReadinessDiffReport,
  type ReadinessSeverity,
} from '../repo-readiness/local-readiness'

export type ActionMode = 'scan' | 'diff'
export type FailOnSeverity = 'off' | 'info' | 'warning' | 'error'

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
}

const severityRank: Record<ReadinessSeverity, number> = { info: 1, warning: 2, error: 3 }

const meetsThreshold = (severity: ReadinessSeverity, threshold: FailOnSeverity): boolean =>
  threshold !== 'off' && severityRank[severity] >= severityRank[threshold]

/**
 * Runs a scan or diff, writes report artifacts, and evaluates the configured
 * gates. This is intentionally free of any GitHub Actions dependency so it can
 * be unit-tested directly; `index.ts` adapts it to the Actions runtime.
 */
export const runAction = (inputs: ActionInputs): ActionResult => {
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

    if (inputs.failOnRegression && regressionsCount > 0) {
      failureReasons.push(`${regressionsCount} readiness regression(s) introduced`)
    }
    const severityHits = report.newFindings.filter(finding => meetsThreshold(finding.severity, inputs.failOnSeverity))
    if (severityHits.length > 0) {
      failureReasons.push(`${severityHits.length} new finding(s) at or above "${inputs.failOnSeverity}"`)
    }
  } else {
    const report: LocalReadinessReport = scanLocalReadiness(inputs.path, { configPath: inputs.configPath })
    writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`)
    summaryMarkdown = formatScanMarkdown(report)
    writeFileSync(markdownReportPath, `${summaryMarkdown}\n`)

    score = report.summary.score
    findingsCount = report.findings.length
    sarifSource = report

    const severityHits = report.findings.filter(finding => meetsThreshold(finding.severity, inputs.failOnSeverity))
    if (severityHits.length > 0) {
      failureReasons.push(`${severityHits.length} finding(s) at or above "${inputs.failOnSeverity}"`)
    }
  }

  if (inputs.minScore !== undefined && score < inputs.minScore) {
    failureReasons.push(`score ${score} is below the minimum ${inputs.minScore}`)
  }

  if (sarifReportPath) {
    const sarif = formatScanSarif(sarifSource, { toolVersion: inputs.toolVersion })
    writeFileSync(sarifReportPath, `${JSON.stringify(sarif, null, 2)}\n`)
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
  }
}
