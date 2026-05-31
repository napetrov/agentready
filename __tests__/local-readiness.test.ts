import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
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

  test('honours .gitignore rules, including nested files and negations', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    // Root .gitignore: ignore a whole directory, a file, and re-include one path.
    writeRepoFile(root, '.gitignore', 'secrets.txt\nartifacts/*\n!artifacts/keep.txt\n')
    writeRepoFile(root, 'secrets.txt', 'token\n')
    writeRepoFile(root, 'artifacts/output.js', 'var a=1;\n')
    writeRepoFile(root, 'artifacts/keep.txt', 'keep me\n')
    writeRepoFile(root, 'src/app.ts', 'export const a = 1\n')
    // Nested .gitignore only affects its own subtree.
    writeRepoFile(root, 'src/.gitignore', '*.log\n')
    writeRepoFile(root, 'src/debug.log', 'noise\n')
    writeRepoFile(root, 'top.log', 'kept because the nested rule does not apply here\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const paths = report.files.map(file => file.path)

    expect(paths).not.toContain('secrets.txt')
    expect(paths).not.toContain('artifacts/output.js')
    expect(paths).not.toContain('src/debug.log')
    expect(paths).toContain('artifacts/keep.txt')
    expect(paths).toContain('src/app.ts')
    expect(paths).toContain('top.log')
  })

  test('lets a nested .gitignore negation re-include a file the root ignores', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    // Root ignores every .log; the nested file re-includes one. The src/ dir
    // itself is not excluded, so git re-includes src/debug.log (deeper rules win).
    writeRepoFile(root, '.gitignore', '*.log\n')
    writeRepoFile(root, 'src/.gitignore', '!debug.log\n')
    writeRepoFile(root, 'src/debug.log', 'kept by the nested negation\n')
    writeRepoFile(root, 'root.log', 'still ignored by the root rule\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const paths = report.files.map(file => file.path)

    expect(paths).toContain('src/debug.log')
    expect(paths).not.toContain('root.log')
  })

  test('keeps a fully-ignored directory ignored despite a nested negation', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    // Root ignores the whole tmp/ directory. Git does not descend into it, so
    // the nested negation is dead — tmp/keep.txt stays ignored (unlike tmp/*).
    writeRepoFile(root, '.gitignore', 'tmp/\n')
    writeRepoFile(root, 'tmp/.gitignore', '!keep.txt\n')
    writeRepoFile(root, 'tmp/keep.txt', 'still ignored\n')
    writeRepoFile(root, 'tmp/other.txt', 'also ignored\n')
    writeRepoFile(root, 'src/app.ts', 'export const a = 1\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const paths = report.files.map(file => file.path)

    expect(paths).not.toContain('tmp/keep.txt')
    expect(paths).not.toContain('tmp/other.txt')
    expect(paths).toContain('src/app.ts')
  })

  test('does not inventory symlinks, including those pointing outside the repo', () => {
    root = createTempRepo()
    const outside = createTempRepo()
    writeRepoFile(outside, 'secret.bin', Buffer.alloc(2_000_000, 1))
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeRepoFile(root, 'src/app.ts', 'export const a = 1\n')
    symlinkSync(path.join(outside, 'secret.bin'), path.join(root, 'external.bin'))
    symlinkSync(path.join(root, 'src'), path.join(root, 'src-link'))

    try {
      const report = scanLocalReadiness(root, { now: fixedNow })
      const paths = report.files.map(file => file.path)

      expect(paths).toContain('src/app.ts')
      expect(paths).not.toContain('external.bin')
      expect(paths.some(p => p.startsWith('src-link'))).toBe(false)
      // The external 2 MB target must not leak in as a large-file finding.
      expect(listFindingIds(report)).not.toContain('files.large:external.bin')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
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

  test('diff still flags committed files that match .gitignore', () => {
    root = createTempRepo()
    runGit(root, ['init', '--initial-branch=main'])
    runGit(root, ['config', 'user.email', 'agentready@example.com'])
    runGit(root, ['config', 'user.name', 'AgentReady Test'])
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { lint: 'eslint .', test: 'jest' } }))
    // The repo gitignores generated assets, but a large one is committed anyway.
    // Git tracks it regardless of .gitignore, so the diff must still flag it.
    writeRepoFile(root, '.gitignore', 'assets/\n')
    runGit(root, ['add', '.'])
    runGit(root, ['commit', '-m', 'base'])
    runGit(root, ['switch', '-c', 'feature'])
    writeRepoFile(root, 'assets/blob.dat', Buffer.alloc(1_200_000, 1))
    runGit(root, ['add', '--force', 'assets/blob.dat'])
    runGit(root, ['commit', '-m', 'commit a gitignored large file'])

    const report = diffLocalReadiness(root, { base: 'main', head: 'feature', now: fixedNow })

    expect(report.headReport.files.map(file => file.path)).toContain('assets/blob.dat')
    expect(report.regressions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'files.large:assets/blob.dat' }),
    ]))
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
    // Errors are rendered as `<path>: <message>`; assert each malformed field is
    // reported without coupling to the validator's exact wording.
    const errorPaths = validation.errors.map(error => error.split(':')[0])
    expect(errorPaths).toEqual(expect.arrayContaining([
      'root',
      'summary.score',
      'commands.packageManager',
      'findings[0].severity',
      'files[0]',
      'files[1].sizeBytes',
    ]))
  })
})

describe('CI orchestrator and architecture-doc recognition', () => {
  let root: string

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('suppresses ci.*.not-run when CI dispatches through an orchestrator', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run make test.\n')
    writeRepoFile(root, 'Makefile', 'test:\n\tpytest\nlint:\n\truff check .\n')
    writeRepoFile(root, 'pyproject.toml', '[project]\nname = "demo"\n')
    writeRepoFile(root, 'src/app.py', 'x = 1\n')
    // CI runs everything behind custom make targets we cannot decompose.
    writeRepoFile(root, '.github/workflows/ci.yml', [
      'name: CI',
      'jobs:',
      '  check:',
      '    steps:',
      '      - run: make ci',
    ].join('\n') + '\n')

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.ci.orchestratorKinds).toEqual(['lint', 'typecheck', 'test', 'build'])
    expect(listFindingIds(report)).not.toEqual(
      expect.arrayContaining(['ci.test.not-run', 'ci.lint.not-run', 'ci.build.not-run', 'ci.typecheck.not-run']),
    )
  })

  test('pre-commit only suppresses lint/type-check not-run, not test/build', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: { test: 'jest', lint: 'eslint .', build: 'tsc' },
    }))
    writeRepoFile(root, 'src/app.ts', 'export const a = 1\n')
    // CI installs deps and runs pre-commit (lint-style), but never the test
    // suite or build. pre-commit covers lint/type-check only.
    writeRepoFile(root, '.github/workflows/ci.yml', [
      'name: CI',
      'jobs:',
      '  check:',
      '    steps:',
      '      - run: npm ci',
      '      - run: pre-commit run --all-files',
    ].join('\n') + '\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const ids = listFindingIds(report)

    expect(report.ci.orchestratorKinds).toEqual(['lint', 'typecheck'])
    expect(ids).not.toContain('ci.lint.not-run')
    expect(ids).toContain('ci.test.not-run')
    expect(ids).toContain('ci.build.not-run')
  })

  test('reports test/build not-run when pre-commit is the only recognized CI step', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: { test: 'jest', lint: 'eslint .', build: 'tsc' },
    }))
    writeRepoFile(root, 'src/app.ts', 'export const a = 1\n')
    // The ONLY verification step is pre-commit — no install/test/etc is parsed,
    // so the gate must rely on orchestrator recognition rather than a has* flag.
    writeRepoFile(root, '.github/workflows/ci.yml', [
      'name: CI',
      'jobs:',
      '  check:',
      '    steps:',
      '      - run: pre-commit run --all-files',
    ].join('\n') + '\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const ids = listFindingIds(report)

    expect(report.ci.orchestratorKinds).toEqual(['lint', 'typecheck'])
    // pre-commit covers lint/type-check; test and build are still uncovered.
    expect(ids).not.toContain('ci.lint.not-run')
    expect(ids).toContain('ci.test.not-run')
    expect(ids).toContain('ci.build.not-run')
  })

  test('recognizes design/architecture docs under docs/ so the finding does not fire', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    // 21 source files makes the repo "non-trivial" (>20) so the check is active.
    for (let i = 0; i < 21; i += 1) {
      writeRepoFile(root, `src/mod${i}.ts`, `export const v${i} = ${i}\n`)
    }
    writeRepoFile(root, 'docs/design.md', '# Design\n\nModule boundaries and data flow.\n')

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.docs.architecture).toContain('docs/design.md')
    expect(listFindingIds(report)).not.toContain('docs.architecture.missing')
  })

  test('emits docs.architecture.missing only as info for a non-trivial repo lacking it', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    for (let i = 0; i < 21; i += 1) {
      writeRepoFile(root, `src/mod${i}.ts`, `export const v${i} = ${i}\n`)
    }

    const report = scanLocalReadiness(root, { now: fixedNow })
    const finding = report.findings.find(f => f.id === 'docs.architecture.missing')

    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('info')
  })
})
