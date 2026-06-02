import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  classifyRunCommandKinds,
  classifyUsesCommandKinds,
  detectCiWorkflows,
} from '../lib/repo-readiness/detectors/ci-workflows'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'
import type { CiCommandKind } from '../lib/repo-readiness/core/types'

const fixedNow = new Date('2026-05-30T00:00:00.000Z')

// Semantic CI parsing recognizes which verification commands CI actually runs so
// checks can flag commands that exist in the repo but never run in CI. These
// tests cover the run/uses classifiers and the YAML-parsing branches (matrix,
// multiple jobs, malformed YAML, non-workflow files, missing fields).

describe('classifyRunCommandKinds', () => {
  const cases: Array<{ run: string; expected: CiCommandKind[] }> = [
    { run: 'npm ci', expected: ['install'] },
    { run: 'pnpm install --frozen-lockfile', expected: ['install'] },
    { run: 'pip install -r requirements.txt', expected: ['install'] },
    { run: 'npm run lint', expected: ['lint'] },
    { run: 'ruff check .', expected: ['lint'] },
    { run: 'cargo clippy -- -D warnings', expected: ['lint'] },
    { run: 'golangci-lint run', expected: ['lint'] },
    { run: 'tsc --noEmit', expected: ['typecheck'] },
    { run: 'mypy src', expected: ['typecheck'] },
    { run: 'cargo check', expected: ['typecheck'] },
    { run: 'go vet ./...', expected: ['lint'] },
    { run: 'pytest -q', expected: ['test'] },
    { run: '.ci/scripts/test.sh --test-kind examples', expected: ['test'] },
    { run: '../conda-recipe/run_test.sh', expected: ['test'] },
    { run: 'call scikit-learn-intelex\\conda-recipe\\run_test.bat scikit-learn-intelex\\', expected: ['test'] },
    // The Go/Rust compiler type-checks during test and build, so those commands
    // satisfy both kinds (matching the command-surface detector).
    { run: 'go test ./...', expected: ['typecheck', 'test'] },
    { run: 'cargo test', expected: ['typecheck', 'test'] },
    { run: 'npm test', expected: ['test'] },
    { run: 'go build ./...', expected: ['typecheck', 'build'] },
    { run: '.ci/scripts/build.sh --compiler icx --target daal', expected: ['build'] },
    { run: 'npm run build', expected: ['build'] },
    { run: 'tsc -b', expected: ['build'] },
    // A single step can chain several commands.
    { run: 'npm ci && npm run lint && npm test', expected: ['install', 'lint', 'test'] },
    // Multi-line scripts are scanned as a whole.
    { run: 'set -e\nnpm run type-check\nnpm run build\n', expected: ['typecheck', 'build'] },
    // Unrelated commands classify as nothing.
    { run: 'echo "deploying"', expected: [] },
    // Install arguments must not be read as having run the tool: the package
    // name (pytest/eslint/tox) only appears because it is being installed.
    { run: 'pip install pytest', expected: ['install'] },
    { run: 'npm install -g eslint', expected: ['install'] },
    { run: 'pip install tox', expected: ['install'] },
    // But installing then running the tool in the same step counts as both.
    { run: 'npm install eslint && eslint .', expected: ['install', 'lint'] },
    { run: 'pip install pytest && pytest -q', expected: ['install', 'test'] },
    // A backslash line-continuation is one shell command; the wrapped package
    // argument must not be read as a separate test/lint invocation.
    { run: 'pip install \\\n  pytest', expected: ['install'] },
    { run: 'npm install -g \\\n  eslint', expected: ['install'] },
  ]

  it.each(cases)('classifies "$run"', ({ run, expected }) => {
    expect(classifyRunCommandKinds(run)).toEqual(expected)
  })

  it('returns kinds in canonical order regardless of command order', () => {
    expect(classifyRunCommandKinds('npm run build && npm test && npm ci')).toEqual(['install', 'test', 'build'])
  })

  it('does not classify a plain "tsc -b" build as a type-check', () => {
    expect(classifyRunCommandKinds('tsc -b')).toEqual(['build'])
  })
})

describe('classifyUsesCommandKinds', () => {
  it('recognizes known verification actions', () => {
    expect(classifyUsesCommandKinds('golangci/golangci-lint-action@v6')).toEqual(['lint'])
    expect(classifyUsesCommandKinds('pre-commit/action@v3.0.1')).toEqual(['lint'])
  })

  it('ignores setup/checkout actions', () => {
    expect(classifyUsesCommandKinds('actions/checkout@v4')).toEqual([])
    expect(classifyUsesCommandKinds('actions/setup-node@v4')).toEqual([])
  })
})

describe('detectCiWorkflows', () => {
  let root: string

  const writeWorkflow = (name: string, content: string): void => {
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(path.join(root, '.github', 'workflows', name), content)
  }

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-ci-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const pathsUnder = (): string[] => ['.github/workflows']

  it('parses run steps across multiple jobs and aggregates command kinds', () => {
    writeWorkflow(
      'ci.yml',
      [
        'name: CI',
        'on: [push]',
        'jobs:',
        '  test:',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - run: npm ci',
        '      - run: npm test',
        '  lint:',
        '    steps:',
        '      - run: npm run lint',
        '',
      ].join('\n'),
    )

    const ci = detectCiWorkflows(root, ['.github/workflows/ci.yml', ...pathsUnder()])

    expect(ci.workflowFiles).toEqual(['.github/workflows/ci.yml'])
    expect(ci.workflows).toHaveLength(1)
    expect(ci.workflows[0].name).toBe('CI')
    // Jobs are sorted by id for stable output.
    expect(ci.workflows[0].jobs.map(job => job.id)).toEqual(['lint', 'test'])
    expect(ci.workflows[0].jobs.find(job => job.id === 'test')?.commandKinds).toEqual(['install', 'test'])
    expect(ci.hasInstall).toBe(true)
    expect(ci.hasTest).toBe(true)
    expect(ci.hasLint).toBe(true)
    expect(ci.hasBuild).toBe(false)
    expect(ci.hasTypeCheck).toBe(false)
  })

  it('classifies a known marketplace action via uses', () => {
    writeWorkflow(
      'lint.yaml',
      ['jobs:', '  lint:', '    steps:', '      - uses: golangci/golangci-lint-action@v6', ''].join('\n'),
    )

    const ci = detectCiWorkflows(root, ['.github/workflows/lint.yaml'])
    expect(ci.hasLint).toBe(true)
    expect(ci.workflows[0].name).toBeUndefined()
  })

  it('degrades a malformed workflow to a parsed-but-empty entry without throwing', () => {
    writeWorkflow('broken.yml', 'jobs: [this is : not valid yaml ::')

    const ci = detectCiWorkflows(root, ['.github/workflows/broken.yml'])
    expect(ci.workflows).toEqual([{ file: '.github/workflows/broken.yml', jobs: [] }])
    expect(ci.hasTest).toBe(false)
  })

  it('handles a workflow whose jobs is not a map', () => {
    writeWorkflow('weird.yml', 'name: Weird\njobs: not-a-map\n')

    const ci = detectCiWorkflows(root, ['.github/workflows/weird.yml'])
    expect(ci.workflows).toEqual([{ file: '.github/workflows/weird.yml', name: 'Weird', jobs: [] }])
  })

  it('only treats .yml/.yaml files under .github/workflows as workflows', () => {
    writeWorkflow('README.md', 'not a workflow')
    writeWorkflow('ci.yml', 'jobs:\n  t:\n    steps:\n      - run: npm test\n')

    const ci = detectCiWorkflows(root, ['.github/workflows/README.md', '.github/workflows/ci.yml'])
    expect(ci.workflowFiles).toEqual(['.github/workflows/ci.yml'])
  })

  it('returns an empty evidence shape when there are no workflows', () => {
    const ci = detectCiWorkflows(root, ['README.md', 'src/index.ts'])
    expect(ci).toEqual({
      workflowFiles: [],
      workflows: [],
      hasInstall: false,
      hasLint: false,
      hasTypeCheck: false,
      hasTest: false,
      hasBuild: false,
      orchestratorKinds: [],
    })
  })
})

describe('CI command-coverage checks', () => {
  let root: string

  const writeRepo = (workflow: string): void => {
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm test.\n')
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ scripts: { test: 'jest', lint: 'eslint .', build: 'tsc' } }),
    )
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), workflow)
  }

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-ci-checks-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('flags commands that exist but are not run in CI', () => {
    // CI installs and tests, but never lints or builds the available commands.
    writeRepo('jobs:\n  test:\n    steps:\n      - run: npm ci\n      - run: npm test\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    const ids = report.findings.map(finding => finding.id)
    expect(ids).toContain('ci.lint.not-run')
    expect(ids).toContain('ci.build.not-run')
    expect(ids).not.toContain('ci.test.not-run')
  })

  it('stays silent when CI runs every available command', () => {
    writeRepo(
      'jobs:\n  verify:\n    steps:\n      - run: npm ci\n      - run: npm test\n      - run: npm run lint\n      - run: npm run build\n',
    )

    const report = scanLocalReadiness(root, { now: fixedNow })
    expect(report.findings.filter(finding => finding.id.startsWith('ci.') && finding.id.endsWith('.not-run'))).toEqual([])
  })

  it('resolves an `npm test` alias to the lint/type-check it runs', () => {
    // The test script bundles lint + type-check + test (got-style). A CI step of
    // `npm test` therefore covers all three, so no ci.*.not-run should fire even
    // though the workflow never names lint/type-check/test directly.
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm test.\n')
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ scripts: { test: 'xo && tsc --noEmit && ava' } }),
    )
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  verify:\n    steps:\n      - run: npm install\n      - run: npm test\n',
    )

    const report = scanLocalReadiness(root, { now: fixedNow })
    const ids = report.findings.map(finding => finding.id)
    expect(report.ci.hasLint).toBe(true)
    expect(report.ci.hasTypeCheck).toBe(true)
    expect(report.ci.hasTest).toBe(true)
    expect(ids).not.toContain('ci.lint.not-run')
    expect(ids).not.toContain('ci.typecheck.not-run')
  })

  it('still flags ci.typecheck.not-run when CI only builds (bare tsc) but a dedicated type-check exists', () => {
    // Regression: alias expansion must not let a build script's bare `tsc`
    // (which emits, i.e. builds) be read as CI type-check coverage and suppress
    // ci.typecheck.not-run when the dedicated `tsc --noEmit` command never runs.
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm test.\n')
    writeFileSync(path.join(root, 'index.ts'), 'export const x: number = 1\n')
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ scripts: { build: 'tsc', 'type-check': 'tsc --noEmit', test: 'jest', lint: 'eslint .' } }),
    )
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  build:\n    steps:\n      - run: npm ci\n      - run: npm run build\n      - run: npm test\n      - run: npm run lint\n',
    )

    const report = scanLocalReadiness(root, { now: fixedNow })
    expect(report.commands.hasTypeCheck).toBe(true)
    expect(report.ci.hasTypeCheck).toBe(false)
    // The bare `tsc` build is still recognized as build coverage.
    expect(report.ci.hasBuild).toBe(true)
    expect(report.findings.map(finding => finding.id)).toContain('ci.typecheck.not-run')
  })

  it('does not expand root scripts for a step that runs in a subdirectory', () => {
    // Monorepo: the root `test` bundles lint+type-check+test, but a job runs
    // `npm test` in packages/api (resolving to that package's script, which we
    // do not read). The root script body must not be attributed to that step, so
    // ci.lint.not-run / ci.typecheck.not-run still fire.
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm test.\n')
    writeFileSync(path.join(root, 'index.ts'), 'export const x: number = 1\n')
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ scripts: { test: 'eslint . && tsc --noEmit && jest', lint: 'eslint .', 'type-check': 'tsc --noEmit' } }),
    )
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  api:\n    defaults:\n      run:\n        working-directory: packages/api\n    steps:\n      - run: npm ci\n      - run: npm test\n',
    )

    const report = scanLocalReadiness(root, { now: fixedNow })
    // The step still counts as test coverage by name, but not lint/type-check.
    expect(report.ci.hasTest).toBe(true)
    expect(report.ci.hasLint).toBe(false)
    expect(report.ci.hasTypeCheck).toBe(false)
    const ids = report.findings.map(finding => finding.id)
    expect(ids).toContain('ci.lint.not-run')
    expect(ids).toContain('ci.typecheck.not-run')
  })

  it('still expands aliases for a step-level working-directory of "."', () => {
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm test.\n')
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ scripts: { test: 'xo && ava' } }),
    )
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  verify:\n    steps:\n      - run: npm ci\n      - run: npm test\n        working-directory: .\n',
    )

    const report = scanLocalReadiness(root, { now: fixedNow })
    expect(report.ci.hasLint).toBe(true)
  })

  it('resolves nested `npm run <script>` aliases without looping on cycles', () => {
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm run ci.\n')
    writeFileSync(
      path.join(root, 'package.json'),
      // `ci` → `verify` → `lint`; `verify` also references itself to exercise the
      // cycle guard.
      JSON.stringify({
        scripts: {
          lint: 'eslint .',
          test: 'jest',
          verify: 'npm run lint && npm run verify',
          ci: 'npm run verify && npm test',
        },
      }),
    )
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  verify:\n    steps:\n      - run: npm ci\n      - run: npm run ci\n',
    )

    const report = scanLocalReadiness(root, { now: fixedNow })
    expect(report.ci.hasLint).toBe(true)
    expect(report.ci.hasTest).toBe(true)
    expect(report.findings.map(finding => finding.id)).not.toContain('ci.lint.not-run')
  })

  it('does not falsely flag a Go repo whose CI runs the toolchain commands', () => {
    // detectGo marks lint (go vet) and type-check (compiler) as available; a
    // standard Go CI of `go test && go vet` must satisfy both rather than emit
    // ci.lint.not-run / ci.typecheck.not-run.
    writeFileSync(path.join(root, 'README.md'), '# Go demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run go test.\n')
    writeFileSync(path.join(root, 'go.mod'), 'module example.com/demo\n\ngo 1.22\n')
    writeFileSync(path.join(root, 'main.go'), 'package main\n\nfunc main() {}\n')
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  verify:\n    steps:\n      - run: go build ./...\n      - run: go test ./...\n      - run: go vet ./...\n',
    )

    const report = scanLocalReadiness(root, { now: fixedNow })
    expect(report.findings.filter(finding => finding.id.endsWith('.not-run'))).toEqual([])
  })

  it('does not flag not-run when the workflow could not be parsed (low confidence)', () => {
    // A workflow with no recognizable commands yields no not-run findings rather
    // than falsely claiming tests/lint/build are missing.
    writeRepo('name: CI\non: [push]\n')

    const report = scanLocalReadiness(root, { now: fixedNow })
    expect(report.findings.filter(finding => finding.id.endsWith('.not-run'))).toEqual([])
    // The workflow file still exists, so the "no workflow" finding must not fire.
    expect(report.findings.map(finding => finding.id)).not.toContain('ci.workflow.missing')
  })
})

describe('CI orchestrator coverage', () => {
  let root: string

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  const writeWorkflow = (yaml: string): void => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-ci-orch-'))
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), yaml)
  }

  it('treats general task runners (tox/uv run) as covering every kind', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  test:', '    steps:', '      - run: uv run --group dev tox run', ''].join('\n'),
    )

    const evidence = detectCiWorkflows(root, ['.github/workflows/ci.yml'])
    expect(evidence.orchestratorKinds).toEqual(['lint', 'typecheck', 'test', 'build'])
    // tox is still recognized as a test surface; orchestrator coverage is additive.
    expect(evidence.hasTest).toBe(true)
  })

  it('treats make targets as covering every kind', () => {
    writeWorkflow(['name: CI', 'jobs:', '  build:', '    steps:', '      - run: make richtest', ''].join('\n'))

    expect(detectCiWorkflows(root, ['.github/workflows/ci.yml']).orchestratorKinds).toEqual([
      'lint',
      'typecheck',
      'test',
      'build',
    ])
  })

  it('scopes pre-commit coverage to lint and type-check only', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  check:', '    steps:', '      - run: pre-commit run --all-files', ''].join('\n'),
    )

    expect(detectCiWorkflows(root, ['.github/workflows/ci.yml']).orchestratorKinds).toEqual(['lint', 'typecheck'])
  })

  it('does not treat non-hook pre-commit subcommands as coverage', () => {
    // `pre-commit install` / `autoupdate` do not run hooks, so they grant no
    // lint/type-check coverage — only `pre-commit run` does.
    for (const cmd of ['pre-commit install', 'pre-commit autoupdate']) {
      writeWorkflow(
        ['name: CI', 'jobs:', '  check:', '    steps:', `      - run: ${cmd}`, ''].join('\n'),
      )
      expect(detectCiWorkflows(root, ['.github/workflows/ci.yml']).orchestratorKinds).toEqual([])
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('treats the pre-commit Action (uses:) as lint/type-check coverage too', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  check:', '    steps:', '      - uses: pre-commit/action@v3.0.1', ''].join('\n'),
    )

    const evidence = detectCiWorkflows(root, ['.github/workflows/ci.yml'])
    // Consistent with `run: pre-commit run` — covers lint/type-check, not test/build.
    expect(evidence.orchestratorKinds).toEqual(['lint', 'typecheck'])
    expect(evidence.hasLint).toBe(true)
  })

  it('records no orchestrator coverage for plain commands', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  test:', '    steps:', '      - run: npm ci', '      - run: npm test', ''].join('\n'),
    )

    expect(detectCiWorkflows(root, ['.github/workflows/ci.yml']).orchestratorKinds).toEqual([])
  })

  it('does not treat a recognized make target (make lint) as opaque', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  lint:', '    steps:', '      - run: make lint', ''].join('\n'),
    )

    const evidence = detectCiWorkflows(root, ['.github/workflows/ci.yml'])
    // `make lint` is decomposed to lint, so it contributes no opaque coverage —
    // unrelated test/build not-run findings must still be able to fire.
    expect(evidence.hasLint).toBe(true)
    expect(evidence.orchestratorKinds).toEqual([])
  })

  it('judges each invocation in a compound step independently', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  ci:', '    steps:', '      - run: make lint && make richtest', ''].join('\n'),
    )

    // `make lint` is recognized (not opaque); `make richtest` is an unknown
    // target, so only the opaque invocation contributes every-kind coverage.
    const evidence = detectCiWorkflows(root, ['.github/workflows/ci.yml'])
    expect(evidence.hasLint).toBe(true)
    expect(evidence.orchestratorKinds).toEqual(['lint', 'typecheck', 'test', 'build'])
  })

  it('does not treat a recognized wrapped command (uv run pytest) as opaque', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  test:', '    steps:', '      - run: uv run pytest', ''].join('\n'),
    )

    const evidence = detectCiWorkflows(root, ['.github/workflows/ci.yml'])
    expect(evidence.hasTest).toBe(true)
    expect(evidence.orchestratorKinds).toEqual([])
  })

  it('does not treat installing a runner (pip install tox) as executing it', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  t:', '    steps:', '      - run: pip install tox', '      - run: npm test', ''].join('\n'),
    )

    // Installing tox does not run it, so no opaque coverage is contributed; the
    // missing lint/build/type-check coverage must still be reportable.
    expect(detectCiWorkflows(root, ['.github/workflows/ci.yml']).orchestratorKinds).toEqual([])
  })

  it('does not treat a global runner install (npm install -g nx) as executing it', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  t:', '    steps:', '      - run: npm install -g nx', '      - run: npm test', ''].join('\n'),
    )

    expect(detectCiWorkflows(root, ['.github/workflows/ci.yml']).orchestratorKinds).toEqual([])
  })

  it('still treats an installed-then-executed runner as opaque', () => {
    writeWorkflow(
      ['name: CI', 'jobs:', '  t:', '    steps:', '      - run: pip install tox && tox run', ''].join('\n'),
    )

    expect(detectCiWorkflows(root, ['.github/workflows/ci.yml']).orchestratorKinds).toEqual([
      'lint',
      'typecheck',
      'test',
      'build',
    ])
  })
})
