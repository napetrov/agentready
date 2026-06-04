#!/usr/bin/env node
import { execFileSync } from 'child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import path from 'path'
import { formatScanMarkdown, scanLocalReadiness, type LocalReadinessReport } from '../lib/repo-readiness/local-readiness'

interface RealWorldRepo {
  name: string
  url: string
  tags?: string[]
}

type Classification =
  | 'product-readiness-evidence'
  | 'compatible-no-material-findings'
  | 'suspected-agentready-false-positive'
  | 'repo-selection-blocker'

interface Args {
  reportsDir: string
  repoPoolPath: string
  batchSize: number
  repos: RealWorldRepo[]
  keepWorktree: boolean
}

interface RotationState {
  nextIndex: number
  lastRunAt?: string
}

interface IndependentSignals {
  trackedFiles: number
  manifests: string[]
  workflows: string[]
  agentInstructionFiles: string[]
}

interface LedgerEntry {
  runId: string
  generatedAt: string
  repo: RealWorldRepo
  commit: string
  classification: Classification
  score?: number
  findings?: Record<string, number>
  independentSignals?: IndependentSignals
  artifacts: string[]
  notes: string[]
}

const DEFAULT_REPORTS_DIR = path.join('reports', 'agentready-realworld-cron')
const DEFAULT_BATCH_SIZE = 3
const FALSE_POSITIVE_PATH_HINT = /(^|\/)(benchmarks?|data|examples?|fixtures?|golden|samples?|snapshots?|testdata|tests?)\//i
const GENERATED_OR_VENDOR_HINT = /(^|\/)(vendor|third_party|node_modules|dist|build|target|coverage)\//i

const sanitizeName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'repo'

const timestampForPath = (date: Date): string => date.toISOString().replace(/[:.]/g, '-')

const parseRepoArg = (arg: string): RealWorldRepo => {
  const [maybeName, maybeUrl] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : ['', arg]
  const url = maybeUrl || arg
  const inferred = url.replace(/\.git$/i, '').split('/').filter(Boolean).pop() ?? 'repo'
  return { name: maybeName || inferred, url }
}

const parsePositiveInt = (value: string, flag: string): number => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer`)
  }
  return parsed
}

const parseArgs = (argv: string[]): Args => {
  let reportsDir = DEFAULT_REPORTS_DIR
  let repoPoolPath = path.join(DEFAULT_REPORTS_DIR, 'repo-pool.json')
  let batchSize = DEFAULT_BATCH_SIZE
  let keepWorktree = false
  const repos: RealWorldRepo[] = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--reports-dir') {
      const value = argv[i + 1]
      if (!value) throw new Error('--reports-dir requires a directory')
      reportsDir = value
      repoPoolPath = path.join(reportsDir, 'repo-pool.json')
      i += 1
    } else if (arg === '--repo-pool') {
      const value = argv[i + 1]
      if (!value) throw new Error('--repo-pool requires a JSON file')
      repoPoolPath = value
      i += 1
    } else if (arg === '--batch-size') {
      const value = argv[i + 1]
      if (!value) throw new Error('--batch-size requires a number')
      batchSize = parsePositiveInt(value, '--batch-size')
      i += 1
    } else if (arg === '--repo') {
      const value = argv[i + 1]
      if (!value) throw new Error('--repo requires name=url or url')
      repos.push(parseRepoArg(value))
      i += 1
    } else if (arg === '--keep-worktree') {
      keepWorktree = true
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write([
        'Usage: npm run agentready:realworld-cron -- [options]',
        '',
        'Options:',
        '  --reports-dir <dir>  Tracking directory (default: reports/agentready-realworld-cron)',
        '  --repo-pool <file>   JSON repo pool (default: <reports-dir>/repo-pool.json)',
        '  --batch-size <n>     Number of repos to scan from the rotating pool (default: 3)',
        '  --repo <name=url>    Add an explicit repo; when set, skips rotation',
        '  --keep-worktree      Keep cloned repositories under work/ for debugging',
        '',
      ].join('\n'))
      process.exit(0)
    } else {
      repos.push(parseRepoArg(arg))
    }
  }

  return { reportsDir, repoPoolPath, batchSize, repos, keepWorktree }
}

const readJsonFile = <T>(file: string, fallback: T): T => {
  if (!existsSync(file)) return fallback
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

const readRepoPool = (repoPoolPath: string): RealWorldRepo[] => {
  const repos = readJsonFile<RealWorldRepo[]>(repoPoolPath, [])
  if (repos.length === 0) {
    throw new Error(`repo pool is empty: ${repoPoolPath}`)
  }
  return repos
}

const selectBatch = (pool: RealWorldRepo[], state: RotationState, batchSize: number): RealWorldRepo[] => {
  const selected: RealWorldRepo[] = []
  const cappedSize = Math.min(batchSize, pool.length)
  for (let offset = 0; offset < cappedSize; offset += 1) {
    selected.push(pool[(state.nextIndex + offset) % pool.length])
  }
  return selected
}

const updateRotation = (reportsDir: string, previous: RotationState, poolSize: number, scanned: number, now: Date): void => {
  const next: RotationState = {
    nextIndex: poolSize === 0 ? 0 : (previous.nextIndex + scanned) % poolSize,
    lastRunAt: now.toISOString(),
  }
  writeFileSync(path.join(reportsDir, 'state.json'), `${JSON.stringify(next, null, 2)}\n`)
}

const cloneOrFetch = (repo: RealWorldRepo, cloneDir: string): void => {
  if (existsSync(cloneDir)) {
    execFileSync('git', ['-C', cloneDir, 'fetch', '--depth', '1', 'origin', 'HEAD'], { stdio: 'pipe' })
    execFileSync('git', ['-C', cloneDir, 'reset', '--hard', 'FETCH_HEAD'], { stdio: 'pipe' })
    return
  }
  execFileSync('git', ['clone', '--depth', '1', repo.url, cloneDir], { stdio: 'pipe' })
}

const gitOutput = (repoDir: string, args: string[]): string =>
  execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const independentSignalsFor = (repoDir: string): IndependentSignals => {
  const tracked = gitOutput(repoDir, ['ls-files']).split('\n').filter(Boolean)
  const manifests = tracked.filter(file =>
    /(^|\/)(package\.json|pyproject\.toml|setup\.cfg|requirements\.txt|Cargo\.toml|go\.mod|Makefile|CMakeLists\.txt|WORKSPACE|MODULE\.bazel)$/i.test(file),
  )
  const workflows = tracked.filter(file => /^\.github\/workflows\/.+\.ya?ml$/i.test(file))
  const agentInstructionFiles = tracked.filter(file =>
    /(^|\/)(AGENTS\.md|CLAUDE\.md|\.cursorrules|\.github\/copilot-instructions\.md|GEMINI\.md)$/i.test(file),
  )

  return {
    trackedFiles: tracked.length,
    manifests,
    workflows,
    agentInstructionFiles,
  }
}

const findingCounts = (report: LocalReadinessReport): Record<string, number> =>
  report.findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1
    return acc
  }, {})

const likelyFalsePositiveFindings = (report: LocalReadinessReport): string[] =>
  report.findings
    .filter(finding => {
      if (finding.severity === 'info' || !finding.path) return false
      if (finding.id.startsWith('files.large') && FALSE_POSITIVE_PATH_HINT.test(finding.path)) return true
      if (finding.id.startsWith('files.minified') && GENERATED_OR_VENDOR_HINT.test(finding.path)) return true
      return false
    })
    .map(finding => `${finding.id}${finding.path ? ` (${finding.path})` : ''}`)

const classify = (report: LocalReadinessReport, signals: IndependentSignals): { classification: Classification; notes: string[] } => {
  const notes: string[] = []
  const suspectedFalsePositives = likelyFalsePositiveFindings(report)

  if (signals.trackedFiles === 0) {
    return { classification: 'repo-selection-blocker', notes: ['git reported zero tracked files'] }
  }

  if (suspectedFalsePositives.length > 0) {
    notes.push(`possible false positives: ${suspectedFalsePositives.slice(0, 5).join('; ')}`)
    return { classification: 'suspected-agentready-false-positive', notes }
  }

  const counts = findingCounts(report)
  if ((counts.error ?? 0) > 0 || (counts.warning ?? 0) > 0 || report.summary.score < 85) {
    notes.push('scanner found actionable warnings/errors or score below 85')
    return { classification: 'product-readiness-evidence', notes }
  }

  notes.push('no material warnings/errors under current policy')
  return { classification: 'compatible-no-material-findings', notes }
}

const writeIssueCandidate = (issuesDir: string, entry: LedgerEntry): string => {
  const issuePath = path.join(issuesDir, `${entry.generatedAt.slice(0, 10)}-${sanitizeName(entry.repo.name)}.md`)
  const body = [
    `# ${entry.repo.name}: ${entry.classification}`,
    '',
    `Run: ${entry.runId}`,
    `Repo: ${entry.repo.url}`,
    `Commit: ${entry.commit}`,
    `Score: ${entry.score ?? 'n/a'}`,
    `Artifacts: ${entry.artifacts.join(', ')}`,
    '',
    '## Notes',
    '',
    ...entry.notes.map(note => `- ${note}`),
    '',
    '## Independent Signals',
    '',
    `- Tracked files: ${entry.independentSignals?.trackedFiles ?? 'n/a'}`,
    `- Manifests: ${entry.independentSignals?.manifests.join(', ') || 'none'}`,
    `- Workflows: ${entry.independentSignals?.workflows.join(', ') || 'none'}`,
    `- Agent instructions: ${entry.independentSignals?.agentInstructionFiles.join(', ') || 'none'}`,
    '',
  ]
  writeFileSync(issuePath, `${body.join('\n')}\n`)
  return issuePath
}

const appendLedger = (ledgersDir: string, entry: LedgerEntry): void => {
  const month = entry.generatedAt.slice(0, 7)
  appendFileSync(path.join(ledgersDir, `${month}.jsonl`), `${JSON.stringify(entry)}\n`)
}

const scanRepo = (repo: RealWorldRepo, args: Args, runId: string, now: Date): LedgerEntry => {
  const safeName = sanitizeName(repo.name)
  const workDir = path.join(args.reportsDir, 'work', safeName)
  const artifactDir = path.join(args.reportsDir, 'artifacts', runId, safeName)
  mkdirSync(path.dirname(workDir), { recursive: true })
  mkdirSync(artifactDir, { recursive: true })

  try {
    cloneOrFetch(repo, workDir)
    const commit = gitOutput(workDir, ['rev-parse', 'HEAD'])
    const signals = independentSignalsFor(workDir)
    const report = scanLocalReadiness(workDir)
    const jsonArtifact = path.join(artifactDir, 'agentready.json')
    const markdownArtifact = path.join(artifactDir, 'agentready.md')
    writeFileSync(jsonArtifact, `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(markdownArtifact, `${formatScanMarkdown(report)}\n`)

    const classified = classify(report, signals)
    const entry: LedgerEntry = {
      runId,
      generatedAt: now.toISOString(),
      repo,
      commit,
      classification: classified.classification,
      score: report.summary.score,
      findings: findingCounts(report),
      independentSignals: signals,
      artifacts: [path.relative(args.reportsDir, jsonArtifact), path.relative(args.reportsDir, markdownArtifact)],
      notes: classified.notes,
    }

    if (entry.classification === 'suspected-agentready-false-positive') {
      const issuePath = writeIssueCandidate(path.join(args.reportsDir, 'issues'), entry)
      entry.artifacts.push(path.relative(args.reportsDir, issuePath))
    }

    return entry
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const blockerArtifact = path.join(artifactDir, 'blocker.txt')
    writeFileSync(blockerArtifact, `${message}\n`)
    const entry: LedgerEntry = {
      runId,
      generatedAt: now.toISOString(),
      repo,
      commit: 'unknown',
      classification: 'repo-selection-blocker',
      artifacts: [path.relative(args.reportsDir, blockerArtifact)],
      notes: [message],
    }
    const issuePath = writeIssueCandidate(path.join(args.reportsDir, 'issues'), entry)
    entry.artifacts.push(path.relative(args.reportsDir, issuePath))
    return entry
  } finally {
    if (!args.keepWorktree && existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true })
    }
  }
}

const ensureTrackingDirs = (reportsDir: string): void => {
  for (const rel of ['artifacts', 'issues', 'ledgers', 'work']) {
    mkdirSync(path.join(reportsDir, rel), { recursive: true })
  }
  if (!statSync(reportsDir).isDirectory()) {
    throw new Error(`reports dir is not a directory: ${reportsDir}`)
  }
}

const run = (): void => {
  const args = parseArgs(process.argv.slice(2))
  const now = new Date()
  const runId = timestampForPath(now)
  ensureTrackingDirs(args.reportsDir)

  const statePath = path.join(args.reportsDir, 'state.json')
  const state = readJsonFile<RotationState>(statePath, { nextIndex: 0 })
  const pool = args.repos.length > 0 ? args.repos : readRepoPool(args.repoPoolPath)
  const batch = args.repos.length > 0 ? args.repos.slice(0, args.batchSize) : selectBatch(pool, state, args.batchSize)

  const entries = batch.map(repo => scanRepo(repo, args, runId, now))
  for (const entry of entries) appendLedger(path.join(args.reportsDir, 'ledgers'), entry)

  if (args.repos.length === 0) {
    updateRotation(args.reportsDir, state, pool.length, batch.length, now)
  }

  const summary = entries.reduce<Record<Classification, number>>(
    (acc, entry) => {
      acc[entry.classification] += 1
      return acc
    },
    {
      'product-readiness-evidence': 0,
      'compatible-no-material-findings': 0,
      'suspected-agentready-false-positive': 0,
      'repo-selection-blocker': 0,
    },
  )

  process.stdout.write([
    `AgentReady real-world cron run ${runId}`,
    `Reports: ${args.reportsDir}`,
    `Repos scanned: ${entries.length}`,
    `Classifications: ${JSON.stringify(summary)}`,
    '',
  ].join('\n'))
}

try {
  run()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

