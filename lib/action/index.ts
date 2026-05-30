import { runAction, type ActionInputs, type ActionMode, type FailOnSeverity } from './run'
import * as core from './runtime'

const VALID_MODES: ActionMode[] = ['scan', 'diff']
const VALID_SEVERITIES: FailOnSeverity[] = ['off', 'info', 'warning', 'error']

const optionalInput = (name: string): string | undefined => {
  const value = core.getInput(name)
  return value ? value : undefined
}

const parseInputs = (): ActionInputs => {
  const mode = (core.getInput('mode') || 'scan') as ActionMode
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`mode must be one of: ${VALID_MODES.join(', ')}`)
  }

  const failOnSeverity = (core.getInput('fail-on-severity') || 'error') as FailOnSeverity
  if (!VALID_SEVERITIES.includes(failOnSeverity)) {
    throw new Error(`fail-on-severity must be one of: ${VALID_SEVERITIES.join(', ')}`)
  }

  const minScoreRaw = optionalInput('min-score')
  const minScore = minScoreRaw === undefined ? undefined : Number(minScoreRaw)
  if (minScore !== undefined && (!Number.isFinite(minScore) || minScore < 0 || minScore > 100)) {
    throw new Error('min-score must be a finite number between 0 and 100')
  }

  return {
    path: core.getInput('path') || '.',
    mode,
    baseRef: optionalInput('base-ref'),
    headRef: optionalInput('head-ref'),
    configPath: optionalInput('config'),
    failOnSeverity,
    failOnRegression: core.getBooleanInput('fail-on-regression'),
    minScore,
    sarif: core.getBooleanInput('upload-sarif'),
    outputDir: core.getInput('output-dir') || '.agentready',
    toolVersion: optionalInput('tool-version'),
  }
}

const main = (): void => {
  const inputs = parseInputs()
  const result = runAction(inputs)

  core.setOutput('score', String(result.score))
  core.setOutput('findings-count', String(result.findingsCount))
  core.setOutput('regressions-count', String(result.regressionsCount))
  core.setOutput('json-report-path', result.jsonReportPath)
  core.setOutput('markdown-report-path', result.markdownReportPath)
  if (result.sarifReportPath) {
    core.setOutput('sarif-report-path', result.sarifReportPath)
  }

  if (core.getBooleanInput('job-summary')) {
    core.writeSummary(result.summaryMarkdown)
  }

  if (result.failed) {
    core.setFailed(`AgentReady gate failed: ${result.failureReasons.join('; ')}`)
  } else {
    core.info(`AgentReady passed: score ${result.score}, ${result.findingsCount} finding(s).`)
  }
}

try {
  main()
} catch (error) {
  core.setFailed(error instanceof Error ? error.message : String(error))
}
