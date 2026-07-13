import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { buildProgram } from '../bin/agentready'

// Drives the Commander program in-process (not via a subprocess) so every
// subcommand's output routing, gating, and exit codes are asserted and counted
// toward coverage. Each case builds a fresh program to avoid parsed-state leak.

const fixtureRoot = path.join(__dirname, '..', 'fixtures', 'readiness')
const goodFixture = path.join(fixtureRoot, 'good-repo')
const badFixture = path.join(fixtureRoot, 'bad-repo')

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  error?: unknown
}

/** Runs `agentready <args>` in-process, capturing output and the exit code. */
const run = async (args: string[]): Promise<RunResult> => {
  const out: string[] = []
  const err: string[] = []
  const logSpy = jest.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')))
  const errSpy = jest.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void err.push(a.join(' ')))
  // Commander writes its own usage/errors to stderr; swallow to keep logs clean.
  const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
  const previousExit = process.exitCode
  process.exitCode = 0

  let error: unknown
  let exitCode = 0
  try {
    const program = buildProgram()
    program.exitOverride()
    program.commands.forEach(command => command.exitOverride())
    try {
      await program.parseAsync(args, { from: 'user' })
    } catch (caught) {
      error = caught // Commander parse/exit errors surface here
    }
    exitCode = Number(process.exitCode ?? 0)
  } finally {
    // Always restore global state, even if buildProgram/exitOverride throws, so
    // a failure in one case cannot leak spies or an exit code into the next.
    process.exitCode = previousExit
    logSpy.mockRestore()
    errSpy.mockRestore()
    stderrSpy.mockRestore()
  }
  return { stdout: out.join('\n'), stderr: err.join('\n'), exitCode, error }
}

describe('scan command', () => {
  it('prints a human summary and passes a ready repository', async () => {
    const result = await run(['scan', goodFixture])
    expect(result.stdout).toContain('AgentReady score: 100/100')
    expect(result.exitCode).toBe(0)
  })

  it('emits compact JSON with --format json --compact', async () => {
    const result = await run(['scan', goodFixture, '--format', 'json', '--compact'])
    const report = JSON.parse(result.stdout)
    expect(report.summary.score).toBe(100)
    expect(report.files).toBeUndefined() // compact omits per-file detail
  })

  it('honors the legacy --markdown flag', async () => {
    const result = await run(['scan', goodFixture, '--markdown'])
    expect(result.stdout).toContain('## AgentReady scan')
  })

  it('writes SARIF to --output instead of stdout', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agentready-cli-'))
    try {
      const outFile = path.join(dir, 'out.sarif')
      const result = await run(['scan', goodFixture, '--format', 'sarif', '--output', outFile])
      expect(result.stdout).toBe('') // nothing written to stdout
      const sarif = JSON.parse(readFileSync(outFile, 'utf8'))
      expect(sarif.$schema).toMatch(/sarif/i)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails the gate on a repository with error-severity findings', async () => {
    const result = await run(['scan', badFixture])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/gate failed/)
  })

  it('enforces --min-score', async () => {
    const result = await run(['scan', badFixture, '--fail-on', 'off', '--min-score', '100'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/score/i)
  })
})

describe('--policy option', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-cli-policy-'))
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest', lint: 'eslint .', build: 'tsc' } }))
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      'name: CI\njobs:\n  test:\n    steps:\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build\n',
    )
    // No AGENTS.md: instructions.missing (warning by default) is the only
    // finding, so only the enterprise policy's escalation of it changes
    // gating/score — CI is present so ci.workflow.missing doesn't also fire.
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('does not affect gating or output under the default policy', async () => {
    const withoutFlag = await run(['scan', root, '--fail-on', 'error'])
    const withDefault = await run(['scan', root, '--fail-on', 'error', '--policy', 'default'])
    expect(withoutFlag.exitCode).toBe(0)
    expect(withDefault.exitCode).toBe(0)
    expect(withDefault.stdout).not.toContain('Policy:')
  })

  it('escalates instructions.missing to error under --policy enterprise and prints the adjustment', async () => {
    const result = await run(['scan', root, '--fail-on', 'error', '--policy', 'enterprise'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/gate failed/)
    expect(result.stdout).toContain('Policy: enterprise')
    expect(result.stdout).toContain('instructions.missing: warning -> error')
  })

  it('rejects an unrecognized policy name', async () => {
    const result = await run(['scan', root, '--policy', 'bogus'])
    expect(result.error).toBeDefined() // Commander rejects an out-of-choices value
  })

  it('applies to diff mode too, gating on the head report under the policy', async () => {
    const runGit = (args: string[]): void => {
      execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] })
    }
    runGit(['init', '-b', 'main'])
    runGit(['config', 'user.email', 't@e.com'])
    runGit(['config', 'user.name', 'T'])
    runGit(['add', '.'])
    runGit(['commit', '-m', 'base'])

    // base === head, so nothing is a *new* finding — this isolates the
    // min-score gate's use of the policy-adjusted head score specifically.
    // Raw score is 100 minus the instructions.missing warning penalty (93);
    // enterprise escalates that finding to error, dropping it further (82).
    const defaultResult = await run(['diff', root, '--base', 'HEAD', '--head', 'HEAD', '--fail-on', 'off', '--min-score', '90'])
    const enterpriseResult = await run([
      'diff', root, '--base', 'HEAD', '--head', 'HEAD', '--fail-on', 'off', '--min-score', '90', '--policy', 'enterprise',
    ])
    expect(defaultResult.exitCode).toBe(0)
    expect(enterpriseResult.exitCode).toBe(1)
    expect(enterpriseResult.stderr).toMatch(/score/i)
  })
})

describe('diff command', () => {
  let root: string
  const runGit = (args: string[]): void => {
    execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] })
  }
  afterEach(() => root && rmSync(root, { recursive: true, force: true }))

  it('requires --base and --head', async () => {
    const result = await run(['diff', goodFixture])
    expect(result.error).toBeDefined() // Commander rejects the missing required option
  })

  it('diffs two refs and gates on regressions', async () => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-cli-diff-'))
    writeFileSync(path.join(root, 'README.md'), '# Demo\n')
    writeFileSync(path.join(root, 'AGENTS.md'), 'Run npm test.\n')
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'jest', lint: 'eslint .' } }))
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\n')
    runGit(['init', '-b', 'main'])
    runGit(['config', 'user.email', 't@e.com'])
    runGit(['config', 'user.name', 'T'])
    runGit(['add', '.'])
    runGit(['commit', '-m', 'base'])
    rmSync(path.join(root, 'README.md')) // regression: drop the README
    runGit(['add', '.'])
    runGit(['commit', '-m', 'head'])

    const result = await run(['diff', root, '--base', 'HEAD~1', '--head', 'HEAD', '--fail-on-regression'])
    expect(result.stdout).toContain('AgentReady diff:')
    expect(result.exitCode).toBe(1)
  })
})

describe('validate-config command', () => {
  it('prints the effective configuration', async () => {
    const result = await run(['validate-config', goodFixture])
    expect(result.stdout).toContain('AgentReady config is valid')
    expect(result.stdout).toContain('largeFileWarningBytes')
  })

  it('prints only JSON with --json', async () => {
    const result = await run(['validate-config', goodFixture, '--json'])
    const config = JSON.parse(result.stdout)
    expect(config).toHaveProperty('ignorePaths')
  })
})

describe('analyze command', () => {
  // Force deterministic-only behavior regardless of ambient credentials so the
  // command never attempts a real model call in CI.
  const PROVIDER_ENV = ['AGENTREADY_LLM_BASE_URL', 'OLLAMA_HOST', 'OPENAI_API_KEY', 'AGENTREADY_USE_GITHUB_MODELS']
  let savedEnv: Record<string, string | undefined>
  beforeEach(() => {
    savedEnv = Object.fromEntries(PROVIDER_ENV.map(key => [key, process.env[key]]))
    for (const key of PROVIDER_ENV) delete process.env[key]
  })
  afterEach(() => {
    for (const key of PROVIDER_ENV) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
  })

  it('runs deterministic-only without a provider and reports it', async () => {
    const result = await run(['analyze', goodFixture, '--no-cache'])
    expect(result.stderr).toMatch(/no LLM provider configured/)
    expect(result.stdout).toContain('AgentReady augmented analysis')
    expect(result.exitCode).toBe(0)
  })

  it('emits JSON with --format json', async () => {
    const result = await run(['analyze', goodFixture, '--no-cache', '--format', 'json'])
    const report = JSON.parse(result.stdout)
    expect(report.analysis.enabled).toBe(false)
    expect(report.augmentedScore.augmented).toBe(report.augmentedScore.deterministic)
  })

  it('gates on --min-score against the augmented score', async () => {
    const result = await run(['analyze', badFixture, '--no-cache', '--min-score', '100'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/below the minimum/)
  })
})

describe('init command', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'agentready-cli-init-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('scaffolds a config and, with --agents, an AGENTS.md; then skips on rerun', async () => {
    const first = await run(['init', dir, '--agents'])
    expect(first.stdout).toMatch(/created .*\.agentready\.json/)
    expect(existsSync(path.join(dir, '.agentready.json'))).toBe(true)
    expect(existsSync(path.join(dir, 'AGENTS.md'))).toBe(true)

    const second = await run(['init', dir, '--agents'])
    expect(second.stdout).toMatch(/skipped/)

    const forced = await run(['init', dir, '--force'])
    expect(forced.stdout).toMatch(/created .*\.agentready\.json/)
  })
})

describe('explain command', () => {
  it('lists documented rule ids with --list', async () => {
    const result = await run(['explain', '--list'])
    expect(result.stdout).toContain('Documented readiness rules:')
    expect(result.stdout).toContain('instructions.missing')
  })

  it('explains a known rule', async () => {
    const result = await run(['explain', 'instructions.missing'])
    expect(result.stdout.length).toBeGreaterThan(0)
    expect(result.exitCode).toBe(0)
  })

  it('emits JSON for a known rule with --json', async () => {
    const result = await run(['explain', 'instructions.missing', '--json'])
    expect(() => JSON.parse(result.stdout)).not.toThrow()
  })

  it('fails on an unknown rule id', async () => {
    const result = await run(['explain', 'no.such.rule'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/Unknown rule or finding id/)
  })
})
