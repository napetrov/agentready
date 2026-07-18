import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  evaluatePortfolioGate,
  formatPortfolioMarkdown,
  formatPortfolioSummary,
  resolvePortfolioTargets,
  scanPortfolio,
  validatePortfolioReportContract,
} from '../lib/repo-readiness/local-readiness'

const fixedNow = new Date('2026-06-01T00:00:00.000Z')

const createTempRepo = (name: string): string => mkdtempSync(path.join(tmpdir(), `agentready-portfolio-${name}-`))

const writeRepoFile = (root: string, repoPath: string, content: string): void => {
  const absolutePath = path.join(root, repoPath)
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

const writeReadyRepo = (root: string): void => {
  writeRepoFile(root, 'README.md', '# Demo\n')
  writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
  writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
  writeRepoFile(root, '.github/pull_request_template.md', '## What changed\n')
  writeRepoFile(root, 'CODEOWNERS', '* @napetrov/maintainers\n')
  writeRepoFile(
    root,
    'package.json',
    JSON.stringify({ scripts: { build: 'tsc', test: 'jest', lint: 'eslint .' } }),
  )
}

describe('resolvePortfolioTargets', () => {
  it('returns explicit paths unchanged when no root is given', () => {
    expect(resolvePortfolioTargets(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('adds every immediate non-hidden subdirectory of root', () => {
    const root = createTempRepo('resolve')
    try {
      mkdirSync(path.join(root, 'repo-a'))
      mkdirSync(path.join(root, 'repo-b'))
      mkdirSync(path.join(root, '.hidden'))
      writeFileSync(path.join(root, 'not-a-dir.txt'), 'x')

      const targets = resolvePortfolioTargets([], root)
      expect(targets.sort()).toEqual([path.join(root, 'repo-a'), path.join(root, 'repo-b')].sort())
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('deduplicates an explicit path that also matches a --root subdirectory', () => {
    const root = createTempRepo('dedup')
    try {
      mkdirSync(path.join(root, 'repo-a'))
      const explicit = path.join(root, 'repo-a')
      const targets = resolvePortfolioTargets([explicit], root)
      expect(targets).toEqual([explicit])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('scanPortfolio', () => {
  it('scans every target and never lets one failure abort the batch', () => {
    const goodRoot = createTempRepo('good')
    try {
      writeReadyRepo(goodRoot)
      const missingRoot = path.join(goodRoot, 'does-not-exist')

      const report = scanPortfolio([goodRoot, missingRoot], { now: fixedNow })

      expect(report.generatedAt).toBe(fixedNow.toISOString())
      expect(report.summary.repoCount).toBe(2)
      expect(report.summary.scannedCount).toBe(1)
      expect(report.summary.scanErrorCount).toBe(1)

      const scanned = report.repos.find(repo => repo.path === goodRoot)
      expect(scanned?.ok).toBe(true)
      if (scanned?.ok) {
        expect(scanned.score).toBe(100)
        expect(scanned.findingCount).toBe(0)
      }

      const failed = report.repos.find(repo => repo.path === missingRoot)
      expect(failed?.ok).toBe(false)
      if (failed && !failed.ok) {
        expect(failed.error.length).toBeGreaterThan(0)
      }

      expect(validatePortfolioReportContract(report)).toEqual({ valid: true, errors: [] })
    } finally {
      rmSync(goodRoot, { recursive: true, force: true })
    }
  })

  it('sorts scan failures first, then scanned repos ascending by score', () => {
    const highRoot = createTempRepo('high')
    const lowRoot = createTempRepo('low')
    try {
      writeReadyRepo(highRoot)
      writeRepoFile(lowRoot, 'placeholder.txt', 'nothing readiness-relevant here\n')
      const missingRoot = path.join(highRoot, 'nope')

      const report = scanPortfolio([highRoot, lowRoot, missingRoot], { now: fixedNow })
      expect(report.repos.map(repo => repo.path)).toEqual([missingRoot, lowRoot, highRoot])
    } finally {
      rmSync(highRoot, { recursive: true, force: true })
      rmSync(lowRoot, { recursive: true, force: true })
    }
  })

  it('aggregates severity counts and score stats across scanned repos only', () => {
    const root = createTempRepo('agg')
    try {
      writeReadyRepo(root)
      const missing = path.join(root, 'missing')
      const report = scanPortfolio([root, missing], { now: fixedNow })

      expect(report.summary.averageScore).toBe(100)
      expect(report.summary.minScore).toBe(100)
      expect(report.summary.maxScore).toBe(100)
      expect(report.summary.totalFindings).toBe(0)
      expect(report.summary.bySeverity).toEqual({ info: 0, warning: 0, error: 0 })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports null score stats when nothing scanned successfully', () => {
    const report = scanPortfolio(['/definitely/not/a/repo'], { now: fixedNow })
    expect(report.summary.averageScore).toBeNull()
    expect(report.summary.minScore).toBeNull()
    expect(report.summary.maxScore).toBeNull()
  })

  it('caps topFindings per repo and excludes info-severity findings', () => {
    const root = createTempRepo('top')
    try {
      // No README/AGENTS.md/CI/tests: several warning/error findings fire.
      writeRepoFile(root, 'package.json', JSON.stringify({ scripts: {} }))
      const report = scanPortfolio([root], { now: fixedNow, topFindingsPerRepo: 2 })
      const repo = report.repos[0]
      expect(repo.ok).toBe(true)
      if (repo.ok) {
        expect(repo.topFindings.length).toBeLessThanOrEqual(2)
        expect(repo.topFindings.every(finding => finding.severity !== 'info')).toBe(true)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('evaluatePortfolioGate', () => {
  it('passes a portfolio with no scan errors and no min-score violations', () => {
    const root = createTempRepo('gate-pass')
    try {
      writeReadyRepo(root)
      const report = scanPortfolio([root], { now: fixedNow })
      expect(evaluatePortfolioGate(report).failed).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails by default when a repo could not be scanned', () => {
    const report = scanPortfolio(['/definitely/not/a/repo'], { now: fixedNow })
    const gate = evaluatePortfolioGate(report)
    expect(gate.failed).toBe(true)
    expect(gate.failureReasons.join(' ')).toContain('could not be scanned')
  })

  it('does not fail on scan errors when failOnScanError is false', () => {
    const report = scanPortfolio(['/definitely/not/a/repo'], { now: fixedNow })
    expect(evaluatePortfolioGate(report, { failOnScanError: false }).failed).toBe(false)
  })

  it('fails when a scanned repo drops below minScore', () => {
    const root = createTempRepo('gate-min')
    try {
      writeRepoFile(root, 'placeholder.txt', 'nothing readiness-relevant here\n')
      const report = scanPortfolio([root], { now: fixedNow })
      const gate = evaluatePortfolioGate(report, { minScore: report.summary.maxScore! + 1 })
      expect(gate.failed).toBe(true)
      expect(gate.failureReasons.join(' ')).toContain('below the minimum')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('portfolioReportSchema (via validatePortfolioReportContract)', () => {
  it('rejects unknown top-level keys', () => {
    const report = scanPortfolio([], { now: fixedNow })
    expect(validatePortfolioReportContract({ ...report, surprise: true }).valid).toBe(false)
  })

  it('rejects a repos entry that mixes ok:true and ok:false shapes', () => {
    const report = scanPortfolio([], { now: fixedNow })
    const malformed = { ...report, repos: [{ path: 'x', ok: true, error: 'not allowed alongside ok:true' }] }
    expect(validatePortfolioReportContract(malformed).valid).toBe(false)
  })
})

describe('portfolio reporters', () => {
  it('formatPortfolioSummary lists failed repos and scored repos with their worst findings', () => {
    const root = createTempRepo('reporter-console')
    try {
      writeReadyRepo(root)
      const missing = path.join(root, 'missing')
      const report = scanPortfolio([root, missing], { now: fixedNow })
      const text = formatPortfolioSummary(report)
      expect(text).toContain('AgentReady portfolio: 2 repo(s) (1 scanned, 1 failed)')
      expect(text).toContain(`[FAILED] ${missing}`)
      expect(text).toContain(`100 ${root}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('formatPortfolioMarkdown renders a repo table and a worst-findings section', () => {
    const root = createTempRepo('reporter-markdown')
    try {
      writeRepoFile(root, 'placeholder.txt', 'nothing readiness-relevant here\n')
      const report = scanPortfolio([root], { now: fixedNow })
      const text = formatPortfolioMarkdown(report)
      expect(text).toContain('## AgentReady portfolio scan')
      expect(text).toContain('| Repo | Score | Error | Warning | Info | Notes |')
      expect(text).toContain('### Worst findings by repo')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
