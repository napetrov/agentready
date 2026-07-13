#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { cloneOrFetch, sanitizeName, type RealWorldRepo } from './agentready-realworld-cron'
import {
  formatScanMarkdown,
  scanLocalReadiness,
  RULE_CATEGORIES,
  type LocalReadinessReport,
  type ReadinessSeverity,
} from '../lib/repo-readiness/local-readiness'

// Scaffold for the "Minimal public benchmark" in docs/product/evaluation.md.
//
// This automates the deterministic half of that plan: define a fixed,
// profile-diverse corpus, scan each repo, and aggregate the results into the
// milestone's tracked-summary shape. It intentionally does NOT automate the
// comparison half — giving the same bounded task to real coding agents and
// recording their operational friction — because that requires running actual
// agents against actual repos and a human judging the result; there is no
// deterministic substitute for that step. The generated report marks those
// columns TODO rather than inventing plausible-looking data.

export interface CorpusEntry {
  name: string
  /** A git remote URL, or "." for a local path (e.g. this repo, scanned in place, never cloned). */
  url: string
  /** One of the 10 profile categories from docs/product/evaluation.md's "Minimal public benchmark". */
  profile: string
  why: string
}

export interface CorpusScanResult {
  entry: CorpusEntry
  report?: LocalReadinessReport
  error?: string
}

const SEVERITY_RANK: Record<ReadinessSeverity, number> = { info: 1, warning: 2, error: 3 }

const isLocalPath = (url: string): boolean => !/^[a-z]+:\/\/|^git@/i.test(url)

const resolveTarget = (entry: CorpusEntry, workDir: string): string => {
  if (isLocalPath(entry.url)) {
    return path.resolve(entry.url)
  }
  const cloneDir = path.join(workDir, sanitizeName(entry.name))
  cloneOrFetch(entry as RealWorldRepo, cloneDir)
  return cloneDir
}

/** Scans every corpus entry independently; one repo's clone/scan failure never aborts the rest. */
export const scanCorpus = (corpus: CorpusEntry[], workDir: string): CorpusScanResult[] =>
  corpus.map((entry): CorpusScanResult => {
    try {
      const target = resolveTarget(entry, workDir)
      return { entry, report: scanLocalReadiness(target) }
    } catch (error) {
      return { entry, error: error instanceof Error ? error.message : String(error) }
    }
  })

const scanCommandFor = (entry: CorpusEntry): string =>
  isLocalPath(entry.url) ? `agentready scan ${entry.url}` : `agentready scan <clone of ${entry.url}>`

const topFindingSignal = (report: LocalReadinessReport): string => {
  const worst = [...report.findings].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0]
  return worst ? `\`${worst.id}\` (${worst.severity})` : 'no findings'
}

const aggregateFindingCountsByCategory = (results: CorpusScanResult[]): Record<string, number> => {
  const totals: Record<string, number> = Object.fromEntries(RULE_CATEGORIES.map(category => [category, 0]))
  for (const result of results) {
    if (!result.report) continue
    for (const dimension of result.report.dimensions) {
      totals[dimension.category] += dimension.findingCount
    }
  }
  return totals
}

/**
 * Renders the milestone report format from docs/product/evaluation.md's
 * "First milestone" section. Pure function of already-collected scan
 * results, so it is unit-testable without cloning anything.
 */
export const buildEvaluationReport = (results: CorpusScanResult[], generatedAt: string): string => {
  const scanned = results.filter((result): result is CorpusScanResult & { report: LocalReadinessReport } => result.report !== undefined)
  const failed = results.filter(result => result.report === undefined)
  const categoryTotals = aggregateFindingCountsByCategory(results)

  const lines = [
    '# AgentReady Evaluation: Minimal Public Benchmark',
    '',
    `Generated: ${generatedAt}`,
    '',
    'Structural scaffold for the "Minimal public benchmark" in',
    '[docs/product/evaluation.md](../../docs/product/evaluation.md), produced by',
    '`npm run agentready:evaluate`. This automates the deterministic half: corpus',
    'definition, scanning, and finding-count aggregation. It does NOT automate',
    'giving the same bounded task to real coding agents and recording their',
    'friction — that requires an actual agent run and human judgment, so those',
    'columns below are marked TODO rather than synthesized.',
    '',
    '## Corpus',
    '',
    '| Repo | Profile | Source | Scan command |',
    '| --- | --- | --- | --- |',
    ...results.map(
      result =>
        `| \`${result.entry.name}\` | ${result.entry.profile} | ${isLocalPath(result.entry.url) ? 'this repo' : result.entry.url} | \`${scanCommandFor(result.entry)}\` |`,
    ),
    '',
    '## Scan outcome',
    '',
    `Scanned: ${scanned.length}/${results.length}` +
      (failed.length > 0 ? ` (failed: ${failed.map(result => result.entry.name).join(', ')})` : ''),
    '',
    '### Finding counts by category (summed across scanned repos)',
    '',
    '| Category | Findings |',
    '| --- | --- |',
    ...RULE_CATEGORIES.map(category => `| ${category} | ${categoryTotals[category]} |`),
    '',
    '## Tracked summary',
    '',
    '| Repo | AgentReady signal | Observed agent friction | Decision |',
    '| --- | --- | --- | --- |',
    ...scanned.map(
      result =>
        `| \`${result.entry.name}\` | ${topFindingSignal(result.report)} | TODO: run a bounded coding task and record friction | TODO |`,
    ),
    '',
    '## Confirmed true positives',
    '',
    '_TODO — requires comparing the signal above against an observed agent run; not inferable from a scan alone._',
    '',
    '## Confirmed false positives / severity adjustments',
    '',
    '_TODO — same as above._',
    '',
    '## Missing signals to add next',
    '',
    '_TODO — record friction the report did not predict, once an agent run exists._',
    '',
  ]

  if (failed.length > 0) {
    lines.push('## Scan failures', '', ...failed.map(result => `- \`${result.entry.name}\`: ${result.error}`), '')
  }

  return `${lines.join('\n')}\n`
}

const DEFAULT_OUTPUT_DIR = path.join('reports', 'evaluation')
const DEFAULT_CORPUS_PATH = path.join(DEFAULT_OUTPUT_DIR, 'corpus.json')

interface Args {
  corpusPath: string
  outputDir: string
  keepWork: boolean
}

const parseArgs = (argv: string[]): Args => {
  let corpusPath = DEFAULT_CORPUS_PATH
  let outputDir = DEFAULT_OUTPUT_DIR
  let keepWork = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--corpus') {
      const value = argv[i + 1]
      if (!value) throw new Error('--corpus requires a JSON file path')
      corpusPath = value
      i += 1
    } else if (arg === '--output-dir') {
      const value = argv[i + 1]
      if (!value) throw new Error('--output-dir requires a directory')
      outputDir = value
      i += 1
    } else if (arg === '--keep-work') {
      keepWork = true
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        [
          'Usage: npm run agentready:evaluate -- [options]',
          '',
          'Options:',
          '  --corpus <file>      Corpus JSON file (default: reports/evaluation/corpus.json)',
          '  --output-dir <dir>   Output directory (default: reports/evaluation)',
          '  --keep-work          Keep cloned repositories under <output-dir>/work/ for debugging',
          '',
        ].join('\n'),
      )
      process.exit(0)
    } else {
      throw new Error(`unrecognized argument: ${arg}`)
    }
  }

  return { corpusPath, outputDir, keepWork }
}

const run = (): void => {
  const args = parseArgs(process.argv.slice(2))
  const corpus = JSON.parse(readFileSync(args.corpusPath, 'utf8')) as CorpusEntry[]
  if (corpus.length === 0) {
    throw new Error(`corpus is empty: ${args.corpusPath}`)
  }

  const workDir = path.join(args.outputDir, 'work')
  mkdirSync(workDir, { recursive: true })
  const now = new Date()
  const artifactsDir = path.join(args.outputDir, 'artifacts', now.toISOString().replace(/[:.]/g, '-'))
  mkdirSync(artifactsDir, { recursive: true })

  const results = scanCorpus(corpus, workDir)

  for (const result of results) {
    if (!result.report) continue
    const safeName = sanitizeName(result.entry.name)
    writeFileSync(path.join(artifactsDir, `${safeName}.json`), `${JSON.stringify(result.report, null, 2)}\n`)
    writeFileSync(path.join(artifactsDir, `${safeName}.md`), `${formatScanMarkdown(result.report)}\n`)
  }

  const reportPath = path.join(args.outputDir, 'README.md')
  writeFileSync(reportPath, buildEvaluationReport(results, now.toISOString()))

  if (!args.keepWork) {
    rmSync(workDir, { recursive: true, force: true })
  }

  const scannedCount = results.filter(result => result.report).length
  process.stdout.write(`Wrote ${reportPath} (${scannedCount}/${results.length} repos scanned)\n`)
}

if (require.main === module) {
  try {
    run()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
}
