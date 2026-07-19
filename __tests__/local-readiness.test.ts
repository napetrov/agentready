import { chmodSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
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
    writeRepoFile(root, 'README.md', '# Demo\n\n## Setup\n\nRun tests:\n\n```sh\nnpm test\n```\n')
    writeRepoFile(root, 'AGENTS.md', 'Use npm test before committing.\n')
    writeRepoFile(root, 'docs/ARCHITECTURE.md', '# Architecture\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, '.github/pull_request_template.md', '## What changed\n')
    writeRepoFile(root, 'CODEOWNERS', '* @napetrov/maintainers\n')
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
    expect(report.reportContract).toEqual({
      schemaVersion: 'local-readiness/v2',
      experimentalFields: [
        'repositoryEvidence',
        'designState',
        'dimensions',
        'instructionContradictions',
        'hookExecutionRisks',
        'autonomyEnvelope',
        'readinessProfile',
      ],
    })
    expect(report.repositoryEvidence?.documentSurfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'document-surface:README.md',
        roleClaims: expect.arrayContaining([
          expect.objectContaining({ value: 'entrypoint', confidence: 'high' }),
          expect.objectContaining({ value: 'development' }),
        ]),
      }),
      expect.objectContaining({
        id: 'document-surface:AGENTS.md',
        roleClaims: expect.arrayContaining([
          expect.objectContaining({ value: 'agent-instruction', confidence: 'high' }),
        ]),
      }),
      expect.objectContaining({
        id: 'document-surface:docs/ARCHITECTURE.md',
        roleClaims: expect.arrayContaining([
          expect.objectContaining({ value: 'architecture', confidence: 'high' }),
        ]),
      }),
    ]))
    expect(report.repositoryEvidence?.topology.metrics).toMatchObject({
      rootCount: expect.any(Number),
      languageCount: expect.any(Number),
      rootsWithoutLocalTests: expect.any(Number),
      rootsWithoutLocalDocs: expect.any(Number),
    })
    expect(report.designState?.strengths.map(insight => insight.id)).toContain('design-state:documentation-evidence')
    expect(report.findings).toEqual([])
    expect(validateLocalReadinessReportContract(report)).toEqual({ valid: true, errors: [] })
  })

  test('emits deterministic repository evidence and design-state markdown sections', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n\nSee [design](docs/design.md).\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test before committing.\n')
    writeRepoFile(root, 'docs/design.md', '# Architecture\n\n## Modules\n')
    writeRepoFile(root, 'package.json', JSON.stringify({
      scripts: {
        test: 'npm --prefix packages/cli test',
      },
    }))
    writeRepoFile(root, 'packages/cli/package.json', JSON.stringify({
      scripts: {
        test: 'jest',
      },
    }))
    writeRepoFile(root, 'packages/cli/src/index.ts', 'export const cli = true\n')
    writeRepoFile(root, 'packages/cli/__tests__/index.test.ts', 'test("cli", () => expect(true).toBe(true))\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const reportAgain = scanLocalReadiness(root, { now: fixedNow })

    expect(report.repositoryEvidence).toEqual(reportAgain.repositoryEvidence)
    expect(report.designState).toEqual(reportAgain.designState)
    expect(report.repositoryEvidence?.roots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'root:packages/cli',
        rootKind: 'package',
        packageManager: 'npm',
        manifests: ['packages/cli/package.json'],
        sourceFiles: 1,
        testFiles: 1,
      }),
    ]))
    expect(report.repositoryEvidence?.verificationSurfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'verification-surface:commands:test',
        commandKind: 'test',
        paths: ['package.json'],
        rootIds: [],
      }),
    ]))
    const markdown = formatScanMarkdown(report)
    expect(markdown).toContain('### Repository topology')
    expect(markdown).toContain('### Documentation roles')
    expect(markdown).toContain('### Design-state strengths')
    expect(validateLocalReadinessReportContract(report)).toEqual({ valid: true, errors: [] })
  })

  test('classifies test files across ecosystems by naming convention', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    // Test files that live outside a tests/ directory and must be recognized by
    // their language-specific naming convention, not miscounted as source.
    writeRepoFile(root, 'command.go', 'package cmd\n')
    writeRepoFile(root, 'command_test.go', 'package cmd\n')
    writeRepoFile(root, 'app.py', 'x = 1\n')
    writeRepoFile(root, 'test_app.py', 'def test_x():\n    assert True\n')
    writeRepoFile(root, 'service_test.py', 'def test_y():\n    assert True\n')
    writeRepoFile(root, 'Widget.java', 'class Widget {}\n')
    writeRepoFile(root, 'WidgetTest.java', 'class WidgetTest {}\n')
    writeRepoFile(root, 'parser_spec.rb', "describe 'parser'\n")
    writeRepoFile(root, 'AppTests.swift', 'import XCTest\n')

    const report = scanLocalReadiness(root, { now: fixedNow })

    const byPath = new Map(report.files.map(file => [file.path, file]))
    for (const testPath of [
      'command_test.go',
      'test_app.py',
      'service_test.py',
      'WidgetTest.java',
      'parser_spec.rb',
      'AppTests.swift',
    ]) {
      expect(byPath.get(testPath)?.test).toBe(true)
      expect(byPath.get(testPath)?.source).toBe(false)
    }
    // Production files alongside the tests stay classified as source.
    expect(byPath.get('command.go')?.source).toBe(true)
    expect(byPath.get('app.py')?.source).toBe(true)
    expect(byPath.get('Widget.java')?.source).toBe(true)
    expect(report.summary.testFiles).toBe(6)
  })

  test('flags a missing root README even when a nested README exists', () => {
    root = createTempRepo()
    writeRepoFile(root, 'docs/README.md', '# Subpackage docs\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.findings.map(finding => finding.id)).toContain('docs.readme.missing')
    // The nested README is still inventoried for reporters.
    expect(report.docs.readme).toContain('docs/README.md')
  })

  test('accepts a root README and does not flag it as missing', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Root\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.findings.map(finding => finding.id)).not.toContain('docs.readme.missing')
  })

  test('accepts a root README symlink without following its target', () => {
    root = createTempRepo()
    writeRepoFile(root, 'packages/app/README.md', '# App\n')
    symlinkSync('packages/app/README.md', path.join(root, 'readme.md'))
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.docs.readme).toContain('readme.md')
    expect(report.findings.map(finding => finding.id)).not.toContain('docs.readme.missing')
  })

  test('does not give root README credit to external documentation symlinks', () => {
    root = createTempRepo()
    const outside = createTempRepo()
    writeRepoFile(outside, 'README.md', '# Outside\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    symlinkSync(path.join(outside, 'README.md'), path.join(root, 'README.md'))

    try {
      const report = scanLocalReadiness(root, { now: fixedNow })

      expect(report.docs.readme).not.toContain('README.md')
      expect(report.findings.map(finding => finding.id)).toContain('docs.readme.missing')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('rejects a scan target that does not exist', () => {
    expect(() => scanLocalReadiness(path.join(tmpdir(), 'agentready-missing-xyz-404'))).toThrow(/does not exist/)
  })

  test('rejects a scan target that is a file rather than a directory', () => {
    root = createTempRepo()
    const filePath = path.join(root, 'README.md')
    writeFileSync(filePath, '# Demo\n')
    expect(() => scanLocalReadiness(filePath)).toThrow(/not a directory/)
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
      'docs.pull-request-template.missing',
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
    writeRepoFile(root, 'public/vendor/jquery/jquery.min.js', 'var jquery=true;')
    // A large binary asset: not loaded into an agent's text context, so it is
    // surfaced at info rather than dragging the score like a large text file.
    writeRepoFile(root, 'data/model.bin', Buffer.alloc(1_100_000, 1))

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.summary.largeFiles).toBe(1)
    expect(report.summary.minifiedFiles).toBe(2)
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'files.large:data/model.bin',
        severity: 'info',
        title: 'Large binary asset is checked into the repository',
      }),
      expect.objectContaining({
        id: 'files.minified:public/app.min.js',
        severity: 'warning',
      }),
      expect.objectContaining({
        id: 'files.minified:public/vendor/jquery/jquery.min.js',
        severity: 'info',
      }),
    ]))
  })

  test('does not score-gate generated or vendored minified assets', () => {
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
    writeRepoFile(root, 'django/contrib/admin/static/admin/css/vendor/select2/select2.min.css', '.select2{display:block}')
    writeRepoFile(root, 'django/contrib/admin/static/admin/js/vendor/jquery/jquery.min.js', 'window.jQuery={};')

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'files.minified:django/contrib/admin/static/admin/css/vendor/select2/select2.min.css',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.minified:django/contrib/admin/static/admin/js/vendor/jquery/jquery.min.js',
        severity: 'info',
      }),
    ]))
  })

  test('treats thirdparty trees as vendored generated paths', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run cargo test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'Cargo.toml', '[package]\nname = "demo"\nversion = "0.1.0"\n')
    writeRepoFile(root, 'src/main.rs', 'fn main() {}\n')
    writeRepoFile(
      root,
      'internal/core/thirdparty/tantivy/tantivy-binding/src/analyzer/data/jieba/dict.txt.big',
      'word\n'.repeat(260_000),
    )

    const report = scanLocalReadiness(root, { now: fixedNow })
    const byId = new Map(report.findings.map(finding => [finding.id, finding]))

    expect(report.files.find(file => file.path.includes('/thirdparty/'))).toMatchObject({
      generated: true,
      source: false,
    })
    expect(byId.has('files.large:internal/core/thirdparty/tantivy/tantivy-binding/src/analyzer/data/jieba/dict.txt.big')).toBe(false)
  })

  test('downgrades obvious scientific example data to informational context friction', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run tests before committing.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'pyproject.toml', '[project]\nname = "demo"\n')
    writeRepoFile(root, 'tests/test_demo.py', 'def test_demo():\n    assert True\n')
    writeRepoFile(root, 'examples/daal4py/data/batch/svd.csv', Buffer.alloc(1_100_000, 1))
    writeRepoFile(root, 'examples/cpu/inference/python/models/bert_large/inference/cpu/configure.json', '{"nodes":[' + '"x",'.repeat(260_000) + '"y"]}')
    writeRepoFile(root, 'examples/cpu/usecase/report.html', '<html>' + 'x'.repeat(1_100_000) + '</html>')
    writeRepoFile(root, 'notebooks/demo.ipynb', '{"cells":[' + '{} ,'.repeat(280_000) + '{}]}')
    writeRepoFile(root, 'data/qr.csv', Buffer.alloc(1_100_000, 1))
    writeRepoFile(root, 'cmd/promtool/testdata/rules_large.yml', 'groups:\n' + '  - name: example\n    rules:\n      - record: job:http_inprogress_requests:sum\n        expr: vector(1)\n'.repeat(10_000))
    writeRepoFile(root, 'src/tests/functional/plugin/shared/src/single_op/paged_attention_token_type_test_data.cpp', 'int data[] = {' + '1,'.repeat(600_000) + '};')
    writeRepoFile(root, 'src/unit_tests/generated_fixture_test_data.cpp', 'int data[] = {' + '2,'.repeat(600_000) + '};')
    writeRepoFile(root, 'src/tests/test_utils/functional_test_utils/layer_tests_summary/github/cache/CPU/test_cache_OP.lst', 'op\n'.repeat(400_000))
    // A generic large *text* file outside any data-fixture path stays a warning.
    writeRepoFile(root, 'assets/blob.csv', `${'1,2,3,4,5\n'.repeat(110_000)}`)

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'files.large:examples/daal4py/data/batch/svd.csv',
        severity: 'info',
        title: 'Large checked-in example or fixture data can create agent context friction',
      }),
      expect.objectContaining({
        id: 'files.large:examples/cpu/inference/python/models/bert_large/inference/cpu/configure.json',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.large:examples/cpu/usecase/report.html',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.large:notebooks/demo.ipynb',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.large:data/qr.csv',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.large:cmd/promtool/testdata/rules_large.yml',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.large:src/tests/functional/plugin/shared/src/single_op/paged_attention_token_type_test_data.cpp',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.large:src/unit_tests/generated_fixture_test_data.cpp',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.large:src/tests/test_utils/functional_test_utils/layer_tests_summary/github/cache/CPU/test_cache_OP.lst',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.large:assets/blob.csv',
        severity: 'warning',
        title: 'Large checked-in file can create agent context friction',
      }),
    ]))
  })

  test('downgrades large checked-in example and test data artifacts to info', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run tests before committing.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'pyproject.toml', '[project]\nname = "demo"\n')
    writeRepoFile(root, 'tests/test_demo.py', 'def test_demo():\n    assert True\n')
    writeRepoFile(root, 'examples/cpu/inference/configure.json', '[]'.repeat(600_000))
    writeRepoFile(root, 'examples/cpu/report.html', '<div>result</div>'.repeat(80_000))
    writeRepoFile(root, 'examples/cpu/notebook.ipynb', JSON.stringify({ cells: ['x'.repeat(1_100_000)] }))
    writeRepoFile(root, 'scripts/ty_benchmark/snapshots/homeassistant_Pyright.txt', 'error\n'.repeat(300_000))
    writeRepoFile(root, 'cmd/promtool/testdata/rules_large.yml', `groups:\n${'- name: fixture\n  rules: []\n'.repeat(50_000)}`)
    writeRepoFile(root, 'test/extensions/compression/gzip/compressor_corpus/clusterfuzz-testcase-minimized-compressor_fuzz_test-5407695477932032', 'payload\n'.repeat(180_000))
    writeRepoFile(root, 'tests/cache/CPU/test_cache_OP.lst', 'op\n'.repeat(400_000))
    writeRepoFile(root, 'tests/single_op/paged_attention_token_type_test_data.cpp', `int data[] = {${'1,'.repeat(600_000)}};`)
    writeRepoFile(root, 'scripts/ty_benchmark/snapshots/django_Mypy.txt', 'diagnostic\n'.repeat(130_000))
    writeRepoFile(root, 'test/extensions/compression/gzip/compressor_corpus/testcase-6170333611884544', 'x'.repeat(1_100_000))
    writeRepoFile(root, 'tests/__snapshots__/component.snap', 'snapshot\n'.repeat(140_000))
    writeRepoFile(root, 'tests/analyzer/graph/react-dom-production/resolved-effects.snapshot', 'snapshot\n'.repeat(140_000))
    writeRepoFile(root, 'tests/benches/app-page-turbo.runtime.prod.js', 'export const bench = 1;\n'.repeat(80_000))
    writeRepoFile(root, 'tests/benches/suite.ts', 'export const handWrittenBenchmark = true;\n'.repeat(80_000))
    writeRepoFile(root, 'tests/sqllogic/known_failures.txt', 'query intentionally fails\n'.repeat(80_000))
    writeRepoFile(root, 'assets/component.snap', 'snapshot\n'.repeat(140_000))
    writeRepoFile(root, 'src/generated-data.cpp', `int data[] = {${'1,'.repeat(600_000)}};`)

    const report = scanLocalReadiness(root, { now: fixedNow })
    const byId = new Map(report.findings.map(finding => [finding.id, finding]))

    for (const fixturePath of [
      'examples/cpu/inference/configure.json',
      'examples/cpu/report.html',
      'examples/cpu/notebook.ipynb',
      'scripts/ty_benchmark/snapshots/django_Mypy.txt',
      'cmd/promtool/testdata/rules_large.yml',
      'test/extensions/compression/gzip/compressor_corpus/clusterfuzz-testcase-minimized-compressor_fuzz_test-5407695477932032',
      'tests/cache/CPU/test_cache_OP.lst',
      'tests/single_op/paged_attention_token_type_test_data.cpp',
      'scripts/ty_benchmark/snapshots/homeassistant_Pyright.txt',
      'test/extensions/compression/gzip/compressor_corpus/testcase-6170333611884544',
      'tests/__snapshots__/component.snap',
      'tests/analyzer/graph/react-dom-production/resolved-effects.snapshot',
      'tests/benches/app-page-turbo.runtime.prod.js',
      'tests/sqllogic/known_failures.txt',
    ]) {
      expect(byId.get(`files.large:${fixturePath}`)).toMatchObject({
        severity: 'info',
        title: 'Large checked-in example or fixture data can create agent context friction',
      })
    }
    expect(byId.get('files.large:src/generated-data.cpp')).toMatchObject({
      severity: 'warning',
      title: 'Large checked-in file can create agent context friction',
    })
    expect(byId.get('files.large:assets/component.snap')).toMatchObject({
      severity: 'warning',
      title: 'Large checked-in file can create agent context friction',
    })
    expect(byId.get('files.large:tests/benches/suite.ts')).toMatchObject({
      severity: 'warning',
      title: 'Large checked-in file can create agent context friction',
    })
  })

  test('downgrades large text benchmark snapshots to info', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run tests before committing.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'pyproject.toml', '[project]\nname = "demo"\n')
    writeRepoFile(root, 'tests/test_demo.py', 'def test_demo():\n    assert True\n')
    writeRepoFile(root, 'scripts/ty_benchmark/snapshots/homeassistant_Pyright.txt', 'diagnostic\n'.repeat(130_000))
    writeRepoFile(root, 'src/notes.txt', 'note\n'.repeat(260_000))

    const report = scanLocalReadiness(root, { now: fixedNow })
    const byId = new Map(report.findings.map(finding => [finding.id, finding]))

    expect(byId.get('files.large:scripts/ty_benchmark/snapshots/homeassistant_Pyright.txt')).toMatchObject({
      severity: 'info',
      title: 'Large checked-in example or fixture data can create agent context friction',
    })
    expect(byId.get('files.large:src/notes.txt')).toMatchObject({
      severity: 'warning',
      title: 'Large checked-in file can create agent context friction',
    })
  })

  test('surfaces a large binary asset at info but a large text file at warning', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    // A binary asset (e.g. a checked-in PDF/model) — never read into an agent's
    // text context, so informational rather than score-dragging.
    writeRepoFile(root, 'docs/slides.pdf', Buffer.alloc(1_200_000, 1))
    // A large *text* file is genuine context friction and stays a warning.
    writeRepoFile(root, 'src/generated-data.sql', `${'select 1;\n'.repeat(130_000)}`)

    const report = scanLocalReadiness(root, { now: fixedNow })
    const byId = new Map(report.findings.map(finding => [finding.id, finding]))
    expect(byId.get('files.large:docs/slides.pdf')).toMatchObject({
      severity: 'info',
      title: 'Large binary asset is checked into the repository',
    })
    expect(byId.get('files.large:src/generated-data.sql')).toMatchObject({
      severity: 'warning',
      title: 'Large checked-in file can create agent context friction',
    })
  })

  test('falls back cleanly when binary sampling rejects valid UTF-8 box-drawing text', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    const clickHouseReferencePrefix = Buffer.from([
      32, 32, 32, 226, 148, 140, 226, 148, 128, 226, 148, 128, 226, 148, 128, 226, 148, 128, 226, 148,
      128, 226, 148, 128, 226, 148, 128, 226, 148, 128, 226, 148, 128, 120, 226, 148, 128, 226, 148,
      144, 10, 49, 46, 32, 226, 148, 130, 32, 49, 50, 51, 52, 53, 54, 55, 56, 57, 32, 226, 148,
      130, 32, 45, 45, 32, 49, 50, 51, 46, 52, 54, 32, 109, 105, 108, 108, 105, 111, 110, 10, 32,
      32, 32, 226, 148, 148, 226, 148, 128, 226, 148, 128, 226, 148, 128, 226, 148, 128, 226, 148,
      128, 226, 148, 128, 226, 148, 128, 226, 148, 128, 226, 148, 128, 226, 148, 128, 226, 148, 128,
      226, 148, 152, 10,
    ])
    writeRepoFile(root, 'tests/queries/0_stateless/03156_nullable_number_tips.reference', Buffer.concat(Array(12).fill(clickHouseReferencePrefix)))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const report = scanLocalReadiness(root, {
        now: fixedNow,
        config: {
          largeFileWarningBytes: 1_000,
          largeFileErrorBytes: 100_000,
        },
      })

      expect(warn).not.toHaveBeenCalled()
      expect(report.files.find(file => file.path.endsWith('03156_nullable_number_tips.reference'))).toMatchObject({
        binary: false,
        test: true,
      })
      expect(listFindingIds(report)).toContain('files.large:tests/queries/0_stateless/03156_nullable_number_tips.reference')
    } finally {
      warn.mockRestore()
    }
  })

  test('does not flag large lockfiles across ecosystems as large files', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    // Lockfiles are machine-generated and expected to be committed even when
    // large; none of these should produce a files.large finding.
    const lockfiles = ['uv.lock', 'poetry.lock', 'Cargo.lock', 'go.sum', 'Gemfile.lock', 'composer.lock']
    for (const lock of lockfiles) {
      writeRepoFile(root, lock, 'x'.repeat(1_200_000))
    }
    // A genuinely large non-lock asset still trips, proving the threshold is active.
    writeRepoFile(root, 'assets/blob.bin', Buffer.alloc(1_200_000, 1))

    const report = scanLocalReadiness(root, { now: fixedNow })
    const largeIds = listFindingIds(report).filter(id => id.startsWith('files.large'))

    expect(largeIds).toEqual(['files.large:assets/blob.bin'])
  })

  test('does not flag generated baselines or vendored dependency trees as large files', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeRepoFile(root, 'tests/baselines/reference/hugeDeclarationOutputGetsTruncatedWithError.types', 'type X = string;\n'.repeat(90_000))
    writeRepoFile(root, 'tests/baselines/reference/completionsCommentsClassMembers.baseline', 'baseline\n'.repeat(150_000))
    writeRepoFile(root, 'tests/cases/fourslash/reallyLargeFile.ts', 'verify.completions();\n'.repeat(90_000))
    writeRepoFile(root, 'test/fixtures/snapshot/typescript.js', 'var ts = {};\n'.repeat(100_000))
    writeRepoFile(root, 'deps/v8/test/cctest/test-api.cc', 'int value = 1;\n'.repeat(90_000))
    writeRepoFile(root, 'third_party/abseil-cpp/symbols_x64_dbg.def', 'symbol\n'.repeat(180_000))
    writeRepoFile(root, 'src/lib/dom.generated.d.ts', 'interface Document {}\n'.repeat(80_000))
    writeRepoFile(root, 'src/loc/lcl/fra/diagnosticMessages.generated.json.lcl', '{"message":"x"}\n'.repeat(90_000))
    writeRepoFile(root, 'src/large-first-party.ts', 'export const value = 1;\n'.repeat(70_000))
    writeRepoFile(root, 'src/generated-data.cpp', `int data[] = {${'1,'.repeat(600_000)}};`)

    const report = scanLocalReadiness(root, { now: fixedNow })
    const largeIds = listFindingIds(report).filter(id => id.startsWith('files.large'))

    expect(largeIds).toEqual([
      'files.large:src/generated-data.cpp',
      'files.large:src/large-first-party.ts',
    ])
  })

  test('downgrades minified files in generated fixture trees', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeRepoFile(root, 'test/fixtures/source-map/throw-class-method.min.js', 'var a=1;')
    writeRepoFile(root, 'tests/fixtures/wpt/compression/third_party/pako/pako_inflate.min.js', 'var b=1;')
    writeRepoFile(root, 'public/app.min.js', 'var c=1;')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const minifiedFindings = report.findings.filter(finding => finding.id.startsWith('files.minified'))

    expect(minifiedFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'files.minified:public/app.min.js',
        severity: 'warning',
      }),
      expect.objectContaining({
        id: 'files.minified:test/fixtures/source-map/throw-class-method.min.js',
        severity: 'info',
      }),
      expect.objectContaining({
        id: 'files.minified:tests/fixtures/wpt/compression/third_party/pako/pako_inflate.min.js',
        severity: 'info',
      }),
    ]))
    expect(minifiedFindings).toHaveLength(3)
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

  test('keeps readiness metadata visible when broad dotfile ignores exist', () => {
    root = createTempRepo()
    runGit(root, ['init', '--initial-branch=main'])
    runGit(root, ['config', 'user.email', 'agentready@example.com'])
    runGit(root, ['config', 'user.name', 'AgentReady Test'])
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.gitignore', '.*\n')
    writeRepoFile(root, '.github/workflows/4.x.yml', [
      'name: 4.x',
      'on: [push]',
      'jobs:',
      '  test:',
      '    steps:',
      '      - run: make test',
      '',
    ].join('\n'))
    writeRepoFile(root, '.github/instructions/react.instructions.md', 'Use npm test for React changes.\n')
    writeRepoFile(root, '.cursor/rules/frontend.mdc', 'Run frontend checks.\n')
    writeRepoFile(root, '.claude/skills/review/SKILL.md', 'Review changed tests.\n')
    writeRepoFile(root, 'Makefile', 'test:\n\ttrue\n')
    writeRepoFile(root, 'src/app.c', 'int main(void) { return 0; }\n')
    runGit(root, ['add', '.'])
    runGit(root, [
      'add',
      '--force',
      '.github/workflows/4.x.yml',
      '.github/instructions/react.instructions.md',
      '.cursor/rules/frontend.mdc',
      '.claude/skills/review/SKILL.md',
    ])
    runGit(root, ['commit', '-m', 'base'])

    const report = scanLocalReadiness(root, { now: fixedNow })
    const paths = report.files.map(file => file.path)
    const instructions = report.instructions.map(surface => surface.path)

    expect(paths).toContain('.github/workflows/4.x.yml')
    expect(instructions).toEqual(expect.arrayContaining([
      'AGENTS.md',
      '.github/instructions/react.instructions.md',
      '.cursor/rules/frontend.mdc',
      '.claude/skills/review/SKILL.md',
    ]))
    expect(report.ci.workflowFiles).toEqual(['.github/workflows/4.x.yml'])
    expect(report.ci.hasTest).toBe(true)
    expect(listFindingIds(report)).not.toContain('ci.workflow.missing')
  })

  test('does not invoke fsmonitor hooks while listing tracked readiness metadata', () => {
    root = createTempRepo()
    runGit(root, ['init', '--initial-branch=main'])
    runGit(root, ['config', 'user.email', 'agentready@example.com'])
    runGit(root, ['config', 'user.name', 'AgentReady Test'])
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.gitignore', '.*\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\non: [push]\njobs:\n  test:\n    steps:\n      - run: npm test\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeRepoFile(root, 'src/app.ts', 'export const value = 1\n')
    runGit(root, ['add', '.'])
    runGit(root, ['add', '--force', '.github/workflows/ci.yml'])
    runGit(root, ['commit', '-m', 'base'])

    const markerPath = path.join(root, 'fsmonitor-ran')
    const hookPath = path.join(root, 'fsmonitor-hook.sh')
    writeFileSync(hookPath, `#!/bin/sh\ntouch "${markerPath}"\nexit 0\n`)
    chmodSync(hookPath, 0o755)
    runGit(root, ['config', 'core.fsmonitor', hookPath])

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.ci.workflowFiles).toEqual(['.github/workflows/ci.yml'])
    expect(report.files.map(file => file.path)).not.toContain('fsmonitor-ran')
  })

  test('keeps ignored untracked readiness metadata hidden', () => {
    root = createTempRepo()
    runGit(root, ['init', '--initial-branch=main'])
    runGit(root, ['config', 'user.email', 'agentready@example.com'])
    runGit(root, ['config', 'user.name', 'AgentReady Test'])
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, '.gitignore', '.github/\ntmp/\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeRepoFile(root, 'src/app.ts', 'export const value = 1\n')
    runGit(root, ['add', '.'])
    runGit(root, ['commit', '-m', 'base'])
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'tmp/AGENTS.md', 'Scratch instructions.\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const paths = report.files.map(file => file.path)

    expect(paths).not.toContain('.github/workflows/ci.yml')
    expect(paths).not.toContain('tmp/AGENTS.md')
    expect(report.ci.workflowFiles).toEqual([])
    expect(report.instructions.map(surface => surface.path)).toEqual([])
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

  test('does not follow symlinked gitignore files outside the repo', () => {
    root = createTempRepo()
    const outside = createTempRepo()
    writeRepoFile(outside, '.gitignore', 'src/\n')
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeRepoFile(root, 'src/app.ts', 'export const a = 1\n')
    symlinkSync(path.join(outside, '.gitignore'), path.join(root, '.gitignore'))

    try {
      const report = scanLocalReadiness(root, { now: fixedNow })
      const paths = report.files.map(file => file.path)

      expect(paths).toContain('src/app.ts')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('inventories documentation symlinks without exposing other symlink targets', () => {
    root = createTempRepo()
    const outside = createTempRepo()
    writeRepoFile(outside, 'secret.bin', Buffer.alloc(2_000_000, 1))
    writeRepoFile(outside, 'package.json', JSON.stringify({ scripts: { test: 'outside-test' } }))
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'src/app.ts', 'export const a = 1\n')
    symlinkSync('README.md', path.join(root, 'linked-readme.md'))
    symlinkSync(path.join(outside, 'secret.bin'), path.join(root, 'external.bin'))
    symlinkSync(path.join(outside, 'package.json'), path.join(root, 'package.json'))
    symlinkSync(path.join(root, 'src'), path.join(root, 'src-link'))

    try {
      const report = scanLocalReadiness(root, { now: fixedNow })
      const paths = report.files.map(file => file.path)

      expect(paths).toContain('src/app.ts')
      expect(paths).toContain('linked-readme.md')
      expect(paths).not.toContain('package.json')
      expect(paths).not.toContain('external.bin')
      expect(paths).not.toContain('src-link')
      expect(paths).not.toContain('src-link/app.ts')
      // The external targets must not be followed, sampled, or exposed to
      // downstream manifest readers.
      expect(listFindingIds(report)).not.toContain('files.large:external.bin')
      expect(report.commands.ecosystems).not.toContain('node')
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
    writeRepoFile(root, 'blob.dat', 'A'.repeat(1_200_000))
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

    // ADR 0005: newFindings/regressions come from headReport.findings and
    // resolvedFindings from baseReport.findings, so each embedded report's own
    // `reportContract.experimentalFindingFields` is the advertise-or-strip
    // marker for confidence/scope on these arrays — no built-in rule sets a
    // non-default value yet, so both stay omitted.
    expect(report.headReport.reportContract.experimentalFindingFields).toBeUndefined()
    expect(report.baseReport.reportContract.experimentalFindingFields).toBeUndefined()
    expect(report.regressions.every(finding => finding.confidence === undefined && finding.scope === undefined)).toBe(true)
  })

  test('diff treats a same-path severity escalation (binary→text large file) as a regression', () => {
    root = createTempRepo()
    runGit(root, ['init', '--initial-branch=main'])
    runGit(root, ['config', 'user.email', 'agentready@example.com'])
    runGit(root, ['config', 'user.name', 'AgentReady Test'])
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { lint: 'eslint .', test: 'jest' } }))
    // Base: a large binary asset → info (not a gate-failing finding).
    writeRepoFile(root, 'assets/blob.dat', Buffer.alloc(1_200_000, 1))
    runGit(root, ['add', '.'])
    runGit(root, ['commit', '-m', 'base'])
    runGit(root, ['switch', '-c', 'feature'])
    // Head: the same path is now a large *text* file → warning. The finding id is
    // unchanged (`files.large:assets/blob.dat`), so only a severity-aware diff
    // catches the escalation.
    writeRepoFile(root, 'assets/blob.dat', 'A'.repeat(1_200_000))
    runGit(root, ['commit', '-am', 'replace binary blob with a large text dump'])

    const report = diffLocalReadiness(root, { base: 'main', head: 'feature', now: fixedNow })

    expect(report.regressions.map(finding => finding.id)).toContain('files.large:assets/blob.dat')
    const regression = report.regressions.find(finding => finding.id === 'files.large:assets/blob.dat')
    expect(regression?.severity).toBe('warning')
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
    writeRepoFile(root, 'assets/blob.dat', 'A'.repeat(1_200_000))
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
    writeRepoFile(root, 'root-blob.dat', 'A'.repeat(1_200_000))
    // A large file inside the scoped subdirectory must count as a regression.
    writeRepoFile(root, 'packages/foo/foo-blob.dat', 'A'.repeat(1_200_000))
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

  const writeNonTrivialSource = (repoRoot: string): void => {
    // 21 source files makes the repo "non-trivial" (>20) so the check is active.
    for (let i = 0; i < 21; i += 1) {
      writeRepoFile(repoRoot, `src/mod${i}.ts`, `export const v${i} = ${i}\n`)
    }
  }

  test('recognizes design/architecture docs under docs/ so the finding does not fire', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeNonTrivialSource(root)
    writeRepoFile(root, 'docs/design.md', '# Design\n\nModule boundaries and data flow.\n')

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.docs.architecture).toContain('docs/design.md')
    expect(listFindingIds(report)).not.toContain('docs.developer.thin')
  })

  test('stays silent when a CONTRIBUTING guide documents the project', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'CONTRIBUTING.md', '# Contributing\n\nHow to set up and submit changes.\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeNonTrivialSource(root)

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(listFindingIds(report)).not.toContain('docs.developer.thin')
  })

  test('stays silent when a populated docs/ tree exists even without an architecture doc', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeNonTrivialSource(root)
    // A docs/ tree whose files do not match the architecture/design keywords.
    writeRepoFile(root, 'docs/usage.md', '# Usage\n\nHow to use the tool.\n')

    const report = scanLocalReadiness(root, { now: fixedNow })

    expect(report.docs.architecture).toHaveLength(0)
    expect(listFindingIds(report)).not.toContain('docs.developer.thin')
  })

  test('emits docs.developer.thin only as info for a non-trivial repo with only a README', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
    writeRepoFile(root, 'package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    writeNonTrivialSource(root)

    const report = scanLocalReadiness(root, { now: fixedNow })
    const finding = report.findings.find(f => f.id === 'docs.developer.thin')

    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('info')
  })
})

describe('instructions.portable-entrypoint.missing', () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  test('does not fire when AGENTS.md is present', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
    const report = scanLocalReadiness(root, { now: fixedNow })
    expect(listFindingIds(report)).not.toContain('instructions.portable-entrypoint.missing')
  })

  test('fires at info when only a vendor-specific instruction surface exists', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    writeRepoFile(root, 'CLAUDE.md', 'Run npm test.\n')
    const report = scanLocalReadiness(root, { now: fixedNow })
    const finding = report.findings.find(f => f.id === 'instructions.portable-entrypoint.missing')
    expect(finding).toMatchObject({ severity: 'info' })
    expect(finding?.recommendation).toContain('AGENTS.md')
  })

  test('does not fire when no instruction surface exists at all (instructions.missing covers that case)', () => {
    root = createTempRepo()
    writeRepoFile(root, 'README.md', '# Demo\n')
    const report = scanLocalReadiness(root, { now: fixedNow })
    const ids = listFindingIds(report)
    expect(ids).toContain('instructions.missing')
    expect(ids).not.toContain('instructions.portable-entrypoint.missing')
  })
})
