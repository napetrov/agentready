import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import {
  diffLocalReadiness,
  formatDiffMarkdown,
  formatScanMarkdown,
  listFindingIds,
  scanLocalReadiness,
  validateLocalReadinessReportContract,
  validateReadinessDiffReportContract,
} from '../lib/repo-readiness/local-readiness'

const fixedNow = new Date('2026-05-23T00:00:00.000Z')

const createTempRepo = (): string => mkdtempSync(path.join(tmpdir(), 'agentready-'))

const writeRepoFile = (root: string, repoPath: string, content: string | Buffer): void => {
  const absolutePath = path.join(root, repoPath)
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

const runGit = (root: string, args: string[]): void => {
  // Disable commit signing so isolated fixture repositories can commit without
  // the host's global signing configuration.
  execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
}

describe('local readiness', () => {
  let root: string

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('scans local repository readiness without GitHub input', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n\nRun tests with npm test.\n')
    writeRepoFile(root, 'AGENTS.md', 'Use npm test before committing.\n')
    writeRepoFile(root, 'docs/ARCHITECTURE.md', '# Architecture\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'src/index.ts', 'export const value = 1\n')
    writeRepoFile(root, '__tests__/index.test.ts', 'test("value", () => expect(1).toBe(1))\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        build: 'next build',
        lint: 'next lint',
        test: 'jest',
        'type-check': 'tsc --noEmit',
      },
    }))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.root).toBe(root)
    expect(report.summary.score).toBe(100)
    expect(report.summary.sourceFiles).toBe(1)
    expect(report.summary.testFiles).toBe(1)
    expect(report.commands).toMatchObject({
      packageManager: 'npm',
      hasBuild: true,
      hasTest: true,
      hasLint: true,
      hasTypeCheck: true,
    })
    expect(report.instructions.map(surface => surface.path)).toContain('AGENTS.md')
    expect(report.findings).toEqual([])
    expect(validateLocalReadinessReportContract(report)).toEqual({ valid: true, errors: [] })
  })

  test('reports missing validation, docs, and instruction surfaces', () => {
    root = createTempRepo()
    writeRepoFile(root, 'src/index.ts', 'export const value = 1\n')
    writeRepoFile(root, 'src/extra.ts', 'export const extra = 2\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        build: 'next build',
      },
    }))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(listFindingIds(report)).toEqual([
      'ci.workflow.missing',
      'commands.lint.missing',
      'commands.test.missing',
      'commands.typecheck.missing',
      'docs.readme.missing',
      'instructions.missing',
    ])
    expect(report.summary.score).toBeLessThan(100)
    expect(formatScanMarkdown(report)).toContain('## AgentReady scan')
    expect(formatScanMarkdown(report)).toContain('Repository has no README')
  })

  test('does not require package scripts for non-Node repositories', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run go test ./... before committing.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'main.go', 'package main\n')

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.commands.packageManager).toBeUndefined()
    expect(report.commands.scripts).toEqual([])
    expect(listFindingIds(report)).not.toEqual(expect.arrayContaining([
      'commands.test.missing',
      'commands.lint.missing',
      'commands.typecheck.missing',
    ]))
  })

  test('continues scanning when package.json is malformed', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run tests before committing.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', '{')

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.commands.packageManager).toBe('npm')
    expect(report.commands.scripts).toEqual([])
    expect(listFindingIds(report)).toEqual(expect.arrayContaining([
      'commands.test.missing',
      'commands.lint.missing',
    ]))
  })

  test('flags large checked-in files and minified assets as PR risk', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        lint: 'eslint .',
        test: 'jest',
      },
    }))
    writeRepoFile(root, 'public/app.min.js', 'var a=1;')
    writeRepoFile(root, 'data/model.bin', Buffer.alloc(1_100_000, 1))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.summary.largeFiles).toBe(1)
    expect(report.summary.minifiedFiles).toBe(1)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'files.large:data/model.bin',
        severity: 'warning',
      }),
      expect.objectContaining({
        id: 'files.minified:public/app.min.js',
        severity: 'warning',
      }),
    ]))
  })

  test('loads config to ignore intentional paths and allow minified assets', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        lint: 'eslint .',
        test: 'jest',
      },
    }))
    writeRepoFile(root, '.agentready.json', JSON.stringify({
      ignorePaths: ['data/**'],
      allowMinifiedFiles: true,
    }))
    writeRepoFile(root, 'public/app.min.js', 'var a=1;')
    writeRepoFile(root, 'data/model.bin', Buffer.alloc(1_100_000, 1))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.files.map(file => file.path)).not.toContain('data/model.bin')
    expect(report.summary.largeFiles).toBe(0)
    expect(report.summary.minifiedFiles).toBe(1)
    expect(listFindingIds(report)).not.toEqual(expect.arrayContaining([
      'files.large:data/model.bin',
      'files.minified:public/app.min.js',
    ]))
  })

  test('applies configured large-file thresholds and warning policy', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        lint: 'eslint .',
        test: 'jest',
      },
    }))
    writeRepoFile(root, 'agentready.config.json', JSON.stringify({
      largeFileWarningBytes: 100,
      largeFileErrorBytes: 200,
      errorOnWarnings: true,
    }))
    writeRepoFile(root, 'data/sample.txt', 'x'.repeat(150))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.summary.largeFiles).toBe(1)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'files.large:data/sample.txt',
        severity: 'error',
      }),
    ]))
  })

  test('supports explicit config paths', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        lint: 'eslint .',
        test: 'jest',
      },
    }))
    writeRepoFile(root, 'config/agentready.json', JSON.stringify({
      ignorePaths: ['public/app.min.js'],
    }))
    writeRepoFile(root, 'public/app.min.js', 'var a=1;')

    const report = scanLocalReadiness(root, {
      now: fixedNow,
      configPath: 'config/agentready.json',
    })

    expect(report.files.map(file => file.path)).not.toContain('public/app.min.js')
    expect(listFindingIds(report)).not.toContain('files.minified:public/app.min.js')
  })

  test('rejects invalid config values', () => {
    root = createTempRepo()
    writeRepoFile(root, '.agentready.json', JSON.stringify({
      ignorePaths: 'data/**',
    }))

    expect(() => scanLocalReadiness(root, { now: fixedNow })).toThrow('.ignorePaths must be an array of strings')
  })

  test('rejects missing explicit config paths', () => {
    root = createTempRepo()

    expect(() => scanLocalReadiness(root, {
      now: fixedNow,
      configPath: 'missing.json',
    })).toThrow('AgentReady config file not found')
  })

  test('diff reports new readiness regressions between refs', () => {
    root = createTempRepo()
    runGit(root, ['init', '--initial-branch=main'])
    runGit(root, ['config', 'user.email', 'agentready@example.com'])
    runGit(root, ['config', 'user.name', 'AgentReady Test'])
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        lint: 'eslint .',
        test: 'jest',
      },
    }))
    runGit(root, ['add', '.'])
    runGit(root, ['commit', '-m', 'base'])
    runGit(root, ['switch', '-c', 'feature'])
    writeRepoFile(root, 'assets/generated.min.js', 'var generated=true;')
    writeRepoFile(root, 'blob.dat', Buffer.alloc(1_200_000, 1))
    runGit(root, ['add', '.'])
    runGit(root, ['commit', '-m', 'add risky files'])

    const report = diffLocalReadiness(root, {
      base: 'main',
      head: 'feature',
      now: fixedNow,
    })

    expect(report.summary.scoreDelta).toBeLessThan(0)
    expect(report.regressions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'files.large:blob.dat' }),
      expect.objectContaining({ id: 'files.minified:assets/generated.min.js' }),
    ]))
    expect(validateReadinessDiffReportContract(report)).toEqual({ valid: true, errors: [] })
    expect(formatDiffMarkdown(report)).toContain('## AgentReady PR readiness')
    expect(formatDiffMarkdown(report)).toContain('New regressions')
  })

  test('diff scans refs via worktrees without touching a dirty working tree', () => {
    root = createTempRepo()
    runGit(root, ['init', '--initial-branch=main'])
    runGit(root, ['config', 'user.email', 'agentready@example.com'])
    runGit(root, ['config', 'user.name', 'AgentReady Test'])
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        lint: 'eslint .',
        test: 'jest',
      },
    }))
    runGit(root, ['add', '.'])
    runGit(root, ['commit', '-m', 'base'])
    runGit(root, ['switch', '-c', 'feature'])
    // Leave an uncommitted change in the working tree; the diff must still run.
    writeRepoFile(root, 'dirty.txt', 'uncommitted\n')

    const report = diffLocalReadiness(root, {
      base: 'main',
      head: 'feature',
      now: fixedNow,
    })

    expect(validateReadinessDiffReportContract(report)).toEqual({ valid: true, errors: [] })
    // The dirty file is never committed, so it does not appear in either scan.
    expect(report.headReport.files.map(file => file.path)).not.toContain('dirty.txt')
    // The working tree is left intact after scanning.
    expect(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })).toContain('dirty.txt')
  })

  test('diff scopes findings to the requested subdirectory', () => {
    root = createTempRepo()
    runGit(root, ['init', '--initial-branch=main'])
    runGit(root, ['config', 'user.email', 'agentready@example.com'])
    runGit(root, ['config', 'user.name', 'AgentReady Test'])
    writeRepoFile(root, 'packages/foo/README.md', '# Foo\n')
    writeRepoFile(root, 'packages/foo/AGENTS.md', 'Run npm test.\n')
    runGit(root, ['add', '.'])
    runGit(root, ['commit', '-m', 'base'])
    runGit(root, ['switch', '-c', 'feature'])
    // A large file outside the scoped subdirectory must not count as a regression.
    writeRepoFile(root, 'root-blob.dat', Buffer.alloc(1_200_000, 1))
    // A large file inside the scoped subdirectory must count as a regression.
    writeRepoFile(root, 'packages/foo/foo-blob.dat', Buffer.alloc(1_200_000, 1))
    runGit(root, ['add', '.'])
    runGit(root, ['commit', '-m', 'add risky files'])

    const report = diffLocalReadiness(path.join(root, 'packages', 'foo'), {
      base: 'main',
      head: 'feature',
      now: fixedNow,
    })

    const regressionIds = report.regressions.map(finding => finding.id)
    expect(regressionIds).toContain('files.large:foo-blob.dat')
    expect(regressionIds).not.toContain('files.large:root-blob.dat')
    expect(report.headReport.files.map(file => file.path)).not.toContain('root-blob.dat')
  })

  test('contract validation catches malformed scan reports', () => {
    const validation = validateLocalReadinessReportContract({
      root: 123,
      summary: {
        score: 'bad',
      },
      findings: [
        {
          id: '',
          title: '',
          severity: 'critical',
          recommendation: '',
        },
      ],
      files: [
        123,
        {
          path: 'src/index.ts',
          sizeBytes: 'bad',
          extension: '.ts',
          binary: false,
          generated: false,
          minified: false,
          documentation: false,
          test: false,
          source: true,
        },
      ],
      commands: {
        packageManager: 'pip',
        scripts: ['test'],
        hasBuild: false,
        hasTest: true,
        hasLint: false,
        hasTypeCheck: false,
      },
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors).toEqual(expect.arrayContaining([
      'root must be a string',
      'summary.score must be a number',
      'commands.packageManager must be npm, pnpm, yarn, or bun when present',
      'findings[0].severity must be info, warning, or error',
      'files[0] must be an object',
      'files[1].sizeBytes must be a number',
    ]))
  })
})
