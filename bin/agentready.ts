#!/usr/bin/env node
import { writeFileSync } from 'fs'
import { Command, InvalidArgumentError, Option } from 'commander'
import {
  compactDiffReport,
  compactReport,
  diffLocalReadiness,
  evaluateDiffGate,
  evaluateScanGate,
  FAIL_ON_SEVERITIES,
  formatDiffMarkdown,
  formatDiffSummary,
  formatScanMarkdown,
  formatScanSarif,
  formatScanSummary,
  loadConfig,
  scanLocalReadiness,
  validateLocalReadinessReportContract,
  validateReadinessDiffReportContract,
  type FailOnSeverity,
} from '../lib/repo-readiness/local-readiness'

type OutputFormat = 'summary' | 'json' | 'markdown' | 'sarif'

const OUTPUT_FORMATS: OutputFormat[] = ['summary', 'json', 'markdown', 'sarif']

/** Options shared by the `scan` and `diff` commands. */
interface ReportOptions {
  json?: boolean
  markdown?: boolean
  sarif?: boolean
  compact?: boolean
  format?: OutputFormat
  output?: string
  config?: string
  failOn?: FailOnSeverity
  minScore?: number
}

/**
 * Resolves the effective output format. An explicit `--format` wins; otherwise
 * the legacy `--sarif`/`--json`/`--markdown` flags map to a format, defaulting
 * to the human summary.
 */
const resolveFormat = (options: ReportOptions): OutputFormat => {
  if (options.format) return options.format
  if (options.sarif) return 'sarif'
  if (options.json) return 'json'
  if (options.markdown) return 'markdown'
  return 'summary'
}

/** Writes rendered output to `--output <path>` when set, otherwise to stdout. */
const emit = (content: string, output?: string): void => {
  if (output) {
    writeFileSync(output, content.endsWith('\n') ? content : `${content}\n`)
  } else {
    console.log(content)
  }
}

/** Parses and validates the `--min-score` value (0-100). */
const parseMinScore = (value: string): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new InvalidArgumentError('value must be a number between 0 and 100')
  }
  return parsed
}

/**
 * Adds the output/gating options common to `scan` and `diff`. The legacy
 * `--json`/`--markdown`/`--sarif` boolean flags remain accepted alongside the
 * canonical `--format`.
 */
const withReportOptions = (command: Command): Command =>
  command
    .addOption(new Option('--format <fmt>', 'output format').choices(OUTPUT_FORMATS))
    .option('--json', 'shorthand for --format json')
    .option('--markdown', 'shorthand for --format markdown')
    .option('--sarif', 'shorthand for --format sarif')
    .option('--compact', 'omit per-file detail from json output')
    .option('--output <file>', 'write the report to a file instead of stdout')
    .option('--config <path>', 'path to an explicit config file')
    .addOption(
      new Option('--fail-on <severity>', 'fail on findings at or above this severity').choices(FAIL_ON_SEVERITIES),
    )
    .option('--min-score <n>', 'fail when the score drops below n (0-100)', parseMinScore)

const program = new Command()

program
  .name('agentready')
  .description('AgentReady local readiness checker — deterministic, offline repository scanning for AI coding agents.')
  .showHelpAfterError()
  .addHelpText(
    'after',
    `
Examples:
  agentready scan .
  agentready scan . --format sarif --output agentready.sarif
  agentready scan . --fail-on warning --min-score 80
  agentready diff --base origin/main --head HEAD . --fail-on-regression
  agentready validate-config .`,
  )

withReportOptions(
  program
    .command('scan')
    .description('Scan a repository for agent readiness')
    .argument('[path]', 'path to scan', '.'),
).action((path: string, options: ReportOptions) => {
  const report = scanLocalReadiness(path, { configPath: options.config })
  const validation = validateLocalReadinessReportContract(report)
  if (!validation.valid) {
    throw new Error(`scan report contract validation failed: ${validation.errors.join('; ')}`)
  }

  const format = resolveFormat(options)
  if (format === 'json') {
    emit(JSON.stringify(options.compact ? compactReport(report) : report, null, 2), options.output)
  } else if (format === 'markdown') {
    emit(formatScanMarkdown(report), options.output)
  } else if (format === 'sarif') {
    emit(JSON.stringify(formatScanSarif(report), null, 2), options.output)
  } else {
    emit(formatScanSummary(report), options.output)
  }

  const gate = evaluateScanGate(report, { failOnSeverity: options.failOn, minScore: options.minScore })
  if (gate.failed) {
    console.error(`Readiness gate failed: ${gate.failureReasons.join('; ')}`)
    process.exitCode = 1
  }
})

withReportOptions(
  program
    .command('diff')
    .description('Diff readiness between two git refs')
    .argument('[path]', 'path to scan', '.')
    .requiredOption('--base <ref>', 'base git ref')
    .requiredOption('--head <ref>', 'head git ref')
    .option('--fail-on-regression', 'fail when a readiness regression is introduced'),
).action((path: string, options: ReportOptions & { base: string; head: string; failOnRegression?: boolean }) => {
  const report = diffLocalReadiness(path, {
    base: options.base,
    head: options.head,
    configPath: options.config,
  })
  const validation = validateReadinessDiffReportContract(report)
  if (!validation.valid) {
    throw new Error(`diff report contract validation failed: ${validation.errors.join('; ')}`)
  }

  const format = resolveFormat(options)
  if (format === 'json') {
    emit(JSON.stringify(options.compact ? compactDiffReport(report) : report, null, 2), options.output)
  } else if (format === 'markdown') {
    emit(formatDiffMarkdown(report), options.output)
  } else if (format === 'sarif') {
    // SARIF describes the head state; PR code scanning surfaces head findings.
    emit(JSON.stringify(formatScanSarif(report.headReport), null, 2), options.output)
  } else {
    emit(formatDiffSummary(report), options.output)
  }

  const gate = evaluateDiffGate(report, {
    failOnSeverity: options.failOn,
    failOnRegression: options.failOnRegression,
    minScore: options.minScore,
  })
  if (gate.failed) {
    console.error(`Readiness gate failed: ${gate.failureReasons.join('; ')}`)
    process.exitCode = 1
  }
})

program
  .command('validate-config')
  .description('Validate discovered/explicit config and print the effective configuration')
  .argument('[path]', 'path to scan', '.')
  .option('--config <path>', 'path to an explicit config file')
  .option('--json', 'print only the normalized JSON config')
  .action((path: string, options: { config?: string; json?: boolean }) => {
    // loadConfig validates the discovered/explicit config and merges it over
    // the defaults; it throws with a readable message on invalid input.
    const effectiveConfig = loadConfig(path, { configPath: options.config })

    if (!options.json) {
      console.log('AgentReady config is valid. Effective configuration:')
    }
    console.log(JSON.stringify(effectiveConfig, null, 2))
  })

try {
  program.parse(process.argv)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
