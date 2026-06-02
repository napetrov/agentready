#!/usr/bin/env tsx
import { execFileSync } from 'child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { formatScanMarkdown, scanLocalReadiness } from '../lib/repo-readiness/local-readiness'
import { analyzeReport, detectProvider, formatAugmentedMarkdown } from '../lib/analyze'

interface DogfoodRepo {
  name: string
  url: string
}

const defaultRepos: DogfoodRepo[] = [
  { name: 'oneDAL', url: 'https://github.com/uxlfoundation/oneDAL.git' },
  { name: 'scikit-learn-intelex', url: 'https://github.com/uxlfoundation/scikit-learn-intelex.git' },
]

const sanitizeName = (name: string): string => name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'repo'

const repoFromArg = (arg: string): DogfoodRepo => {
  const [maybeName, maybeUrl] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : ['', arg]
  const url = maybeUrl || arg
  const inferred = url.replace(/\.git$/i, '').split('/').filter(Boolean).pop() ?? 'repo'
  return { name: maybeName || inferred, url }
}

const parseArgs = (argv: string[]): { outDir: string; repos: DogfoodRepo[]; analyze: boolean } => {
  const repos: DogfoodRepo[] = []
  let outDir = mkdtempSync(path.join(tmpdir(), 'agentready-dogfood-'))
  let analyze = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out') {
      const value = argv[i + 1]
      if (!value) {
        throw new Error('--out requires a directory')
      }
      outDir = value
      i += 1
    } else if (arg === '--analyze') {
      analyze = true
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write([
        'Usage: npm run agentready:dogfood -- [--out <dir>] [--analyze] [name=https://github.com/org/repo.git ...]',
        '',
        'Clones configured repositories into the output directory and writes AgentReady reports there.',
        'With --analyze, also runs the optional LLM analytics layer when a provider is configured in the',
        'environment (AGENTREADY_LLM_BASE_URL / OLLAMA_HOST / OPENAI_API_KEY); the deterministic scan never',
        'depends on a model. No external repository is vendored into this repo, and no scanned repository',
        'scripts are executed.',
        '',
      ].join('\n'))
      process.exit(0)
    } else {
      repos.push(repoFromArg(arg))
    }
  }

  return { outDir, repos: repos.length > 0 ? repos : defaultRepos, analyze }
}

const assertScratchOutputDir = (outDir: string): void => {
  const cwd = path.resolve(process.cwd())
  const resolved = path.resolve(outDir)
  if (resolved === cwd || resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error('--out must point outside the current repository; use a scratch directory such as /tmp/agentready-dogfood')
  }
}

const run = async (): Promise<void> => {
  const { outDir, repos, analyze } = parseArgs(process.argv.slice(2))
  assertScratchOutputDir(outDir)
  mkdirSync(outDir, { recursive: true })

  // The LLM layer is opt-in and provider-gated: the deterministic scan below is
  // never affected. `detectProvider` returns undefined when no provider is
  // configured, in which case --analyze degrades to deterministic-only.
  const detected = analyze ? detectProvider() : undefined
  if (analyze && !detected) {
    process.stdout.write(
      'note: --analyze requested but no LLM provider is configured (set AGENTREADY_LLM_BASE_URL / OLLAMA_HOST / OPENAI_API_KEY); writing deterministic reports only.\n',
    )
  }

  const summary: string[] = [
    '# AgentReady dogfood summary',
    '',
    `Output directory: ${outDir}`,
    ...(detected ? [`LLM analysis: enabled (${detected.source})`] : []),
    '',
    '| Repo | Score | Files | Findings | Report |',
    '|---|---:|---:|---|---|',
  ]

  for (const repo of repos) {
    const safeName = sanitizeName(repo.name)
    const cloneDir = path.join(outDir, safeName)
    if (!existsSync(cloneDir)) {
      execFileSync('git', ['clone', '--depth', '1', repo.url, cloneDir], { stdio: 'inherit' })
    }

    const report = scanLocalReadiness(cloneDir)
    const jsonPath = path.join(outDir, `${safeName}.agentready.json`)
    const markdownPath = path.join(outDir, `${safeName}.agentready.md`)
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(markdownPath, `${formatScanMarkdown(report)}\n`)

    const counts = report.findings.reduce<Record<string, number>>((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1
      return acc
    }, {})
    const findingSummary = `e:${counts.error ?? 0} w:${counts.warning ?? 0} i:${counts.info ?? 0}`
    summary.push(`| ${repo.name} | ${report.summary.score} | ${report.summary.totalFiles} | ${findingSummary} | ${path.basename(jsonPath)} |`)

    // Optional LLM augmentation (instruction-quality, false-positive triage,
    // remediation, …). Fail-open: analyzeReport never throws and never mutates
    // the deterministic report.
    if (detected) {
      const augmented = await analyzeReport(cloneDir, report, { provider: detected.provider })
      const augmentedJson = path.join(outDir, `${safeName}.augmented.json`)
      const augmentedMd = path.join(outDir, `${safeName}.augmented.md`)
      writeFileSync(augmentedJson, `${JSON.stringify(augmented, null, 2)}\n`)
      writeFileSync(augmentedMd, `${formatAugmentedMarkdown(augmented)}\n`)
      summary.push(
        `| ${repo.name} (augmented) | ${augmented.augmentedScore.augmented} | — | insights:${augmented.analysis.insightsApplied} | ${path.basename(augmentedMd)} |`,
      )
    }
  }

  const summaryPath = path.join(outDir, 'summary.md')
  writeFileSync(summaryPath, `${summary.join('\n')}\n`)
  process.stdout.write(`AgentReady dogfood reports written to ${outDir}\n`)
}

run().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
