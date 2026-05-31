import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import {
  compactDiffReport,
  compactReport,
  diffLocalReadiness,
  formatDiffMarkdown,
  formatDiffSummary,
  formatScanMarkdown,
  formatScanSarif,
  formatScanSummary,
  scanLocalReadiness,
} from '../lib/repo-readiness/local-readiness'
import { analyzeReport, type LlmProvider } from '../lib/analyze'

// Snapshot the JSON / Markdown / SARIF / console renderings of the canonical
// fixtures so output-shape regressions surface as an intentional snapshot
// update. Non-deterministic fields (absolute root path, timestamps) are
// normalized so the snapshots are stable across machines and runs.

const fixedNow = new Date('2026-05-30T00:00:00.000Z')
const fixtureRoot = path.join(__dirname, '..', 'fixtures', 'readiness')

/** Replaces machine- or run-specific substrings so snapshots stay stable. */
const normalize = (text: string, root: string): string =>
  text
    .split(JSON.stringify(root).slice(1, -1)).join('<ROOT>') // JSON-escaped form
    .split(root).join('<ROOT>')
    // `diff` scans each ref in a throwaway git worktree, so the base/head report
    // roots are random temp paths; collapse them to a stable placeholder.
    .replace(/[^"\s]*agentready-worktree-[A-Za-z0-9]+[/\\]tree/g, '<WORKTREE>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<TIME>')

const snapshotJson = (value: unknown, root: string): string => normalize(JSON.stringify(value, null, 2), root)

describe('scan output snapshots', () => {
  for (const repo of ['good-repo', 'bad-repo']) {
    describe(repo, () => {
      const root = path.join(fixtureRoot, repo)
      const report = scanLocalReadiness(root, { now: fixedNow })

      it('console summary', () => {
        expect(normalize(formatScanSummary(report), root)).toMatchSnapshot()
      })
      it('markdown', () => {
        expect(normalize(formatScanMarkdown(report), root)).toMatchSnapshot()
      })
      it('sarif', () => {
        expect(snapshotJson(formatScanSarif(report), root)).toMatchSnapshot()
      })
      it('compact json', () => {
        expect(snapshotJson(compactReport(report), root)).toMatchSnapshot()
      })
    })
  }
})

describe('diff output snapshots', () => {
  let root: string
  const runGit = (args: string[]): void => {
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] })
  }

  afterEach(() => root && rmSync(root, { recursive: true, force: true }))

  it('summary and markdown for a regression between two refs', () => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-snap-diff-'))
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm test.\n')
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest', lint: 'eslint .' } }))
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\n')
    runGit(['init', '-b', 'main'])
    runGit(['config', 'user.email', 'test@example.com'])
    runGit(['config', 'user.name', 'Test'])
    runGit(['add', '.'])
    runGit(['commit', '-m', 'base'])
    // Head drops the README, introducing a regression.
    rmSync(path.join(root, 'README.md'))
    runGit(['add', '.'])
    runGit(['commit', '-m', 'head'])

    const report = diffLocalReadiness(root, { base: 'HEAD~1', head: 'HEAD', now: fixedNow })

    expect(normalize(formatDiffSummary(report), root)).toMatchSnapshot('diff summary')
    expect(normalize(formatDiffMarkdown(report), root)).toMatchSnapshot('diff markdown')
    expect(snapshotJson(compactDiffReport(report), root)).toMatchSnapshot('diff compact json')
  })
})

describe('augmented report snapshots', () => {
  const root = path.join(fixtureRoot, 'good-repo')

  it('deterministic-only summary and markdown (no provider)', async () => {
    const report = scanLocalReadiness(root, { now: fixedNow })
    const augmented = await analyzeReport(root, report, { now: fixedNow })
    const { formatAugmentedSummary, formatAugmentedMarkdown } = await import('../lib/analyze')
    expect(normalize(formatAugmentedSummary(augmented), root)).toMatchSnapshot('summary')
    expect(normalize(formatAugmentedMarkdown(augmented), root)).toMatchSnapshot('markdown')
  })

  it('summary and markdown with a folded insight', async () => {
    const report = scanLocalReadiness(root, { now: fixedNow })
    const provider: LlmProvider = {
      id: 'snap',
      model: 'snap@1',
      async complete(request) {
        if (request.system.includes('actionable')) {
          return { output: { assessments: [{ path: 'AGENTS.md', actionable: false, confidence: 0.8, rationale: 'too terse', missing: ['where code lives'] }] }, model: 'snap@1' }
        }
        return { output: {}, model: 'snap@1' }
      },
    }
    const { formatAugmentedSummary, formatAugmentedMarkdown } = await import('../lib/analyze')
    const augmented = await analyzeReport(root, report, { provider, now: fixedNow })
    expect(normalize(formatAugmentedSummary(augmented), root)).toMatchSnapshot('summary')
    expect(normalize(formatAugmentedMarkdown(augmented), root)).toMatchSnapshot('markdown')
  })
})
