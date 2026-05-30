#!/usr/bin/env node
// Packs the published tarball, installs it into a throwaway project, and
// verifies both consumption surfaces work against the real package metadata:
//   1. the library import (`require('agentready')`) exposes the public API
//   2. the `agentready` bin runs and emits a valid scan report
//
// This guards the `main`/`types`/`exports` and `bin` entry points so the
// README's "command-line tool and library" claim stays true after packaging.
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const repoRoot = process.cwd()

const run = (
  command: string,
  args: string[],
  cwd: string,
): { status: number; stdout: string; stderr: string } => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

const fail = (message: string): never => {
  throw new Error(`pack smoke: ${message}`)
}

// A real published consumer installs `dist/`, so build before packing.
const build = run('npm', ['run', 'build'], repoRoot)
if (build.status !== 0) {
  fail(`build failed: ${build.stderr || build.stdout}`)
}

const pack = run('npm', ['pack', '--silent'], repoRoot)
if (pack.status !== 0) {
  fail(`npm pack failed: ${pack.stderr || pack.stdout}`)
}
const tarballName = pack.stdout.trim().split('\n').pop()?.trim()
if (!tarballName) {
  fail('npm pack did not report a tarball name')
}
const tarballPath = path.join(repoRoot, tarballName as string)

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentready-pack-'))

try {
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    `${JSON.stringify({ name: 'agentready-pack-consumer', version: '0.0.0', private: true }, null, 2)}\n`,
  )

  const install = run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--no-save', tarballPath],
    tempDir,
  )
  if (install.status !== 0) {
    fail(`installing the tarball failed: ${install.stderr || install.stdout}`)
  }

  // 1. Library surface: the public API must be reachable via the package name.
  const requireCheck = run(
    'node',
    [
      '-e',
      [
        "const api = require('agentready');",
        "const expected = ['scanLocalReadiness','diffLocalReadiness','listFindingIds','validateLocalReadinessReportContract','formatScanMarkdown'];",
        'const missing = expected.filter(name => typeof api[name] !== "function");',
        'if (missing.length) { throw new Error("missing exports: " + missing.join(", ")); }',
        'process.stdout.write("library-ok");',
      ].join(' '),
    ],
    tempDir,
  )
  if (requireCheck.status !== 0 || !requireCheck.stdout.includes('library-ok')) {
    fail(`library import check failed: ${requireCheck.stderr || requireCheck.stdout}`)
  }

  // 2. CLI surface: the installed bin must run and emit a valid scan report.
  const sampleRepo = path.join(tempDir, 'sample')
  fs.mkdirSync(sampleRepo)
  fs.writeFileSync(path.join(sampleRepo, 'README.md'), '# Sample\n')

  const binPath = path.join(
    tempDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'agentready.cmd' : 'agentready',
  )
  const cli = run(binPath, ['scan', sampleRepo, '--json'], tempDir)
  // A scan may exit non-zero when it finds error-severity issues; that is a
  // valid run. We only require that it produced a parseable report.
  const jsonStart = cli.stdout.indexOf('{')
  if (jsonStart === -1) {
    fail(`CLI did not emit JSON: status=${cli.status}, stderr=${cli.stderr}`)
  }
  const report = JSON.parse(cli.stdout.slice(jsonStart)) as { summary?: { score?: unknown } }
  if (typeof report.summary?.score !== 'number') {
    fail('CLI scan report is missing a numeric summary.score')
  }

  console.log('AgentReady pack smoke passed')
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
  fs.rmSync(tarballPath, { force: true })
}
