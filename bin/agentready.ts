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
  formatRuleDoc,
  formatScanMarkdown,
  formatScanSarif,
  formatScanSummary,
  getRuleDoc,
  listRuleIds,
  loadConfig,
  scaffoldInit,
  scanLocalReadiness,
  validateLocalReadinessReportContract,
  validateReadinessDiffReportContract,
  type FailOnSeverity,
} from '../lib/repo-readiness/local-readiness'
import {
  analyzeReport,
  detectProvider,
  formatAugmentedMarkdown,
  formatAugmentedSummary,
  createFileCache,
} from '../lib/analyze'

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

const ANALYZE_FORMATS = ['summary', 'json', 'markdown'] as const
type AnalyzeFormat = (typeof ANALYZE_FORMATS)[number]

program
  .command('analyze')
  .description('Scan, then run the optional LLM analytics layer to produce an augmented report')
  .argument('[path]', 'path to scan', '.')
  .addOption(new Option('--format <fmt>', 'output format').choices(ANALYZE_FORMATS).default('summary'))
  .option('--output <file>', 'write the report to a file instead of stdout')
  .option('--config <path>', 'path to an explicit config file')
  .option('--no-cache', 'disable the on-disk analysis cache')
  .option('--cache-dir <dir>', 'directory for the analysis cache', '.agentready/analyze-cache')
  .option('--min-score <n>', 'fail when the augmented score drops below n (0-100)', parseMinScore)
  .action(
    async (
      path: string,
      options: { format: AnalyzeFormat; output?: string; config?: string; cache?: boolean; cacheDir: string; minScore?: number },
    ) => {
      const report = scanLocalReadiness(path, { configPath: options.config })
      const validation = validateLocalReadinessReportContract(report)
      if (!validation.valid) {
        throw new Error(`scan report contract validation failed: ${validation.errors.join('; ')}`)
      }

      // Auto-detect a provider from the environment; absent one, analyze runs
      // deterministic-only (still a valid augmented report, just no insights).
      const detected = detectProvider()
      if (!detected) {
        console.error(
          'AgentReady analyze: no LLM provider configured (set AGENTREADY_LLM_BASE_URL, OLLAMA_HOST, or OPENAI_API_KEY). Running deterministic-only.',
        )
      }

      const augmented = await analyzeReport(path, report, {
        provider: detected?.provider,
        cache: options.cache === false ? undefined : createFileCache(options.cacheDir),
      })

      if (options.format === 'json') {
        emit(JSON.stringify(augmented, null, 2), options.output)
      } else if (options.format === 'markdown') {
        emit(formatAugmentedMarkdown(augmented), options.output)
      } else {
        emit(formatAugmentedSummary(augmented), options.output)
      }

      if (options.minScore !== undefined && augmented.augmentedScore.augmented < options.minScore) {
        console.error(
          `Augmented score ${augmented.augmentedScore.augmented} is below the minimum ${options.minScore}`,
        )
        process.exitCode = 1
      }
    },
  )

program
  .command('init')
  .description('Scaffold a starter AgentReady config (and optionally AGENTS.md)')
  .argument('[path]', 'directory to scaffold into', '.')
  .option('--agents', 'also create a starter AGENTS.md')
  .option('--force', 'overwrite files that already exist')
  .action((path: string, options: { agents?: boolean; force?: boolean }) => {
    const result = scaffoldInit(path, { agents: options.agents, force: options.force })
    for (const file of result.created) console.log(`created ${file}`)
    for (const file of result.skipped) {
      console.log(`skipped ${file} (already exists; use --force to overwrite)`)
    }
    if (result.created.length === 0) {
      console.log('Nothing created. Use --force to overwrite existing files.')
    }
  })

program
  .command('explain')
  .description('Explain a readiness rule: rationale, remediation, and references')
  .argument('[finding-id]', 'a finding id or rule id (e.g. files.large or commands.test.missing)')
  .option('--json', 'print the rule documentation as JSON')
  .option('--list', 'list all documented rule ids')
  .action((findingId: string | undefined, options: { json?: boolean; list?: boolean }) => {
    if (options.list || !findingId) {
      const ids = listRuleIds()
      if (options.json) {
        console.log(JSON.stringify(ids, null, 2))
      } else {
        console.log('Documented readiness rules:')
        for (const id of ids) console.log(`  ${id}`)
        console.log('\nRun "agentready explain <rule-id>" for details.')
      }
      return
    }

    const doc = getRuleDoc(findingId)
    if (!doc) {
      console.error(
        `Unknown rule or finding id: ${findingId}\nRun "agentready explain --list" to see documented rule ids.`,
      )
      process.exitCode = 1
      return
    }

    console.log(options.json ? JSON.stringify(doc, null, 2) : formatRuleDoc(doc))
  })

try {
  program.parse(process.argv)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
