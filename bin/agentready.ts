#!/usr/bin/env tsx
import {
  compactDiffReport,
  compactReport,
  diffLocalReadiness,
  formatDiffMarkdown,
  formatDiffSummary,
  formatScanMarkdown,
  formatScanSummary,
  scanLocalReadiness,
  validateLocalReadinessReportContract,
  validateReadinessDiffReportContract,
} from '../lib/repo-readiness/local-readiness'

interface CliOptions {
  json: boolean
  markdown: boolean
  compact: boolean
  failOnRegression: boolean
  base?: string
  head?: string
  configPath?: string
  path: string
}

const printUsage = (): void => {
  console.log(`AgentReady local readiness checker

Usage:
  npm run agentready -- scan [path] [--json] [--compact]
  npm run agentready -- scan [path] [--markdown] [--config <path>]
  npm run agentready -- diff --base <ref> --head <ref> [path] [--json] [--compact] [--markdown] [--fail-on-regression] [--config <path>]

Examples:
  npm run agentready -- scan .
  npm run agentready -- diff --base origin/main --head HEAD . --fail-on-regression
`)
}

const parseArgs = (argv: string[]): { command?: string; options: CliOptions } => {
  const [command, ...rest] = argv
  const options: CliOptions = {
    json: false,
    markdown: false,
    compact: false,
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
    } else if (arg === '--compact') {
      options.compact = true
    } else if (arg === '--fail-on-regression') {
      options.failOnRegression = true
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
    const output = options.compact ? compactReport(report) : report

    if (options.json) {
      console.log(JSON.stringify(output, null, 2))
    } else if (options.markdown) {
      console.log(formatScanMarkdown(report))
    } else {
      console.log(formatScanSummary(report))
    }

    return report.findings.some(finding => finding.severity === 'error') ? 1 : 0
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
    const output = options.compact ? compactDiffReport(report) : report

    if (options.json) {
      console.log(JSON.stringify(output, null, 2))
    } else if (options.markdown) {
      console.log(formatDiffMarkdown(report))
    } else {
      console.log(formatDiffSummary(report))
    }

    return options.failOnRegression && report.regressions.length > 0 ? 1 : 0
  }

  throw new Error(`Unknown command: ${command}`)
}

try {
  process.exitCode = run()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
