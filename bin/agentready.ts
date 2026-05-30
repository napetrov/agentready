#!/usr/bin/env node
import { writeFileSync } from 'fs'
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

interface CliOptions {
  json: boolean
  markdown: boolean
  compact: boolean
  sarif: boolean
  format?: OutputFormat
  output?: string
  failOnRegression: boolean
  failOnSeverity?: FailOnSeverity
  minScore?: number
  base?: string
  head?: string
  configPath?: string
  path: string
}

/**
 * Resolves the effective output format. An explicit `--format` wins; otherwise
 * the legacy `--sarif`/`--json`/`--markdown` flags map to a format, defaulting
 * to the human summary.
 */
const resolveFormat = (options: CliOptions): OutputFormat => {
  if (options.format) return options.format
  if (options.sarif) return 'sarif'
  if (options.json) return 'json'
  if (options.markdown) return 'markdown'
  return 'summary'
}

/** Writes rendered output to `--output <path>` when set, otherwise to stdout. */
const emit = (content: string, options: CliOptions): void => {
  if (options.output) {
    writeFileSync(options.output, content.endsWith('\n') ? content : `${content}\n`)
  } else {
    console.log(content)
  }
}

const printUsage = (): void => {
  console.log(`AgentReady local readiness checker

Usage:
  npm run agentready -- scan [path] [--format summary|json|markdown|sarif] [--compact] [--output <file>] [--config <path>] [--fail-on <severity>] [--min-score <n>]
  npm run agentready -- diff --base <ref> --head <ref> [path] [--format ...] [--compact] [--output <file>] [--fail-on-regression] [--fail-on <severity>] [--min-score <n>] [--config <path>]
  npm run agentready -- validate-config [path] [--config <path>] [--json]

Output:
  --format <fmt>   summary (default), json, markdown, or sarif
  --output <file>  write the report to a file instead of stdout
  --compact        omit per-file detail from json output
  (legacy --json / --markdown / --sarif flags are still accepted)

Gating (exit code 1 when a gate trips):
  --fail-on <sev>      fail on findings at or above off|info|warning|error (default error)
  --min-score <n>      fail when the score drops below n (0-100)
  --fail-on-regression (diff only) fail when a readiness regression is introduced

Examples:
  npm run agentready -- scan .
  npm run agentready -- scan . --format sarif --output agentready.sarif
  npm run agentready -- scan . --fail-on warning --min-score 80
  npm run agentready -- diff --base origin/main --head HEAD . --fail-on-regression
  npm run agentready -- validate-config .
`)
}

const parseArgs = (argv: string[]): { command?: string; options: CliOptions } => {
  const [command, ...rest] = argv
  const options: CliOptions = {
    json: false,
    markdown: false,
    compact: false,
    sarif: false,
    failOnRegression: false,
    path: '.',
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    const readOptionValue = (flag: string): string => {
      const value = rest[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`${flag} requires a value`)
      }
      index += 1
      return value
    }

    if (arg === '--json') {
      options.json = true
    } else if (arg === '--markdown') {
      options.markdown = true
    } else if (arg === '--sarif') {
      options.sarif = true
    } else if (arg === '--compact') {
      options.compact = true
    } else if (arg === '--format') {
      const value = readOptionValue('--format')
      if (!(OUTPUT_FORMATS as string[]).includes(value)) {
        throw new Error(`--format must be one of: ${OUTPUT_FORMATS.join(', ')}`)
      }
      options.format = value as OutputFormat
    } else if (arg === '--output') {
      options.output = readOptionValue('--output')
    } else if (arg === '--fail-on-regression') {
      options.failOnRegression = true
    } else if (arg === '--fail-on') {
      const value = readOptionValue('--fail-on')
      if (!(FAIL_ON_SEVERITIES as string[]).includes(value)) {
        throw new Error(`--fail-on must be one of: ${FAIL_ON_SEVERITIES.join(', ')}`)
      }
      options.failOnSeverity = value as FailOnSeverity
    } else if (arg === '--min-score') {
      const value = readOptionValue('--min-score')
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error('--min-score must be a number between 0 and 100')
      }
      options.minScore = parsed
    } else if (arg === '--base') {
      options.base = readOptionValue('--base')
    } else if (arg === '--head') {
      options.head = readOptionValue('--head')
    } else if (arg === '--config') {
      options.configPath = readOptionValue('--config')
    } else if (!arg.startsWith('--')) {
      options.path = arg
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return { command, options }
}

const run = (): number => {
  const { command, options } = parseArgs(process.argv.slice(2))

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage()
    return 0
  }

  if (command === 'scan') {
    const report = scanLocalReadiness(options.path, { configPath: options.configPath })
    const validation = validateLocalReadinessReportContract(report)
    if (!validation.valid) {
      throw new Error(`scan report contract validation failed: ${validation.errors.join('; ')}`)
    }
    const format = resolveFormat(options)
    if (format === 'json') {
      emit(JSON.stringify(options.compact ? compactReport(report) : report, null, 2), options)
    } else if (format === 'markdown') {
      emit(formatScanMarkdown(report), options)
    } else if (format === 'sarif') {
      emit(JSON.stringify(formatScanSarif(report), null, 2), options)
    } else {
      emit(formatScanSummary(report), options)
    }

    const gate = evaluateScanGate(report, {
      failOnSeverity: options.failOnSeverity,
      minScore: options.minScore,
    })
    if (gate.failed) {
      console.error(`Readiness gate failed: ${gate.failureReasons.join('; ')}`)
    }
    return gate.failed ? 1 : 0
  }

  if (command === 'validate-config') {
    // loadConfig validates the discovered/explicit config and merges it over
    // the defaults; it throws with a readable message on invalid input.
    const effectiveConfig = loadConfig(options.path, { configPath: options.configPath })

    if (options.json) {
      console.log(JSON.stringify(effectiveConfig, null, 2))
    } else {
      console.log('AgentReady config is valid. Effective configuration:')
      console.log(JSON.stringify(effectiveConfig, null, 2))
    }

    return 0
  }

  if (command === 'diff') {
    if (!options.base || !options.head) {
      throw new Error('diff requires --base <ref> and --head <ref>')
    }

    const report = diffLocalReadiness(options.path, {
      base: options.base,
      head: options.head,
      configPath: options.configPath,
    })
    const validation = validateReadinessDiffReportContract(report)
    if (!validation.valid) {
      throw new Error(`diff report contract validation failed: ${validation.errors.join('; ')}`)
    }
    const format = resolveFormat(options)
    if (format === 'json') {
      emit(JSON.stringify(options.compact ? compactDiffReport(report) : report, null, 2), options)
    } else if (format === 'markdown') {
      emit(formatDiffMarkdown(report), options)
    } else if (format === 'sarif') {
      // SARIF describes the head state; PR code scanning surfaces head findings.
      emit(JSON.stringify(formatScanSarif(report.headReport), null, 2), options)
    } else {
      emit(formatDiffSummary(report), options)
    }

    const gate = evaluateDiffGate(report, {
      failOnSeverity: options.failOnSeverity,
      failOnRegression: options.failOnRegression,
      minScore: options.minScore,
    })
    if (gate.failed) {
      console.error(`Readiness gate failed: ${gate.failureReasons.join('; ')}`)
    }
    return gate.failed ? 1 : 0
  }

  throw new Error(`Unknown command: ${command}`)
}

try {
  process.exitCode = run()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
