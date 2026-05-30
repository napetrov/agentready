#!/usr/bin/env node
// Drives the bundled GitHub Action (action/dist/index.js) the way the Actions
// runner does — via INPUT_* env vars and the GITHUB_OUTPUT / GITHUB_STEP_SUMMARY
// file commands — and asserts the outputs, summary, SARIF artifact, and exit
// codes. This guards the action wiring and the committed bundle end-to-end.
import { spawnSync } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const repoRoot = process.cwd()
const actionEntry = path.join(repoRoot, 'action', 'dist', 'index.js')

const fail = (message: string): never => {
  throw new Error(`action smoke: ${message}`)
}

// Build the bundle so the smoke always reflects the current source.
const build = spawnSync('npm', ['run', 'build:action'], { cwd: repoRoot, encoding: 'utf8' })
if (build.status !== 0) {
  fail(`build:action failed: ${build.stderr || build.stdout}`)
}
if (!existsSync(actionEntry)) {
  fail(`bundled action not found at ${actionEntry}`)
}

interface RunResult {
  status: number
  outputs: Record<string, string>
  summary: string
}

const runAction = (inputs: Record<string, string>): RunResult => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'agentready-action-smoke-'))
  const outputFile = path.join(workDir, 'output')
  const summaryFile = path.join(workDir, 'summary.md')

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GITHUB_OUTPUT: outputFile,
    GITHUB_STEP_SUMMARY: summaryFile,
    INPUT_OUTPUT_DIR: path.join(workDir, 'reports'),
  }
  for (const [key, value] of Object.entries(inputs)) {
    env[`INPUT_${key.replace(/ /g, '_').toUpperCase()}`] = value
  }

  const result = spawnSync('node', [actionEntry], { cwd: repoRoot, encoding: 'utf8', env })

  const outputs: Record<string, string> = {}
  if (existsSync(outputFile)) {
    for (const line of readFileSync(outputFile, 'utf8').split('\n')) {
      const eq = line.indexOf('=')
      if (eq > 0) outputs[line.slice(0, eq)] = line.slice(eq + 1)
    }
  }
  const summary = existsSync(summaryFile) ? readFileSync(summaryFile, 'utf8') : ''

  rmSync(workDir, { recursive: true, force: true })
  return { status: result.status ?? 1, outputs, summary }
}

const goodFixture = path.join('fixtures', 'readiness', 'good-repo')
const badFixture = path.join('fixtures', 'readiness', 'bad-repo')

// A ready repo passes, sets outputs, writes a job summary, and emits SARIF.
const good = runAction({
  path: goodFixture,
  mode: 'scan',
  'fail-on-severity': 'error',
  'fail-on-regression': 'false',
  'job-summary': 'true',
  'upload-sarif': 'true',
})
if (good.status !== 0) {
  fail(`good fixture should pass, status=${good.status}`)
}
if (good.outputs.score !== '100' || good.outputs['findings-count'] !== '0') {
  fail(`unexpected outputs for good fixture: ${JSON.stringify(good.outputs)}`)
}
if (!good.outputs['sarif-report-path'] || !existsSync(good.outputs['sarif-report-path'])) {
  fail('expected a SARIF report path output that points to a real file')
}
if (!good.summary.includes('## AgentReady scan')) {
  fail('expected the job summary to contain the markdown scan report')
}

// A repo with error-severity findings fails the default gate but still reports.
const bad = runAction({
  path: badFixture,
  mode: 'scan',
  'fail-on-severity': 'error',
  'fail-on-regression': 'false',
  'job-summary': 'true',
  'upload-sarif': 'false',
})
if (bad.status === 0) {
  fail('bad fixture should fail the default severity gate')
}
if (!bad.outputs.score || bad.outputs['findings-count'] === '0') {
  fail(`bad fixture should still emit outputs: ${JSON.stringify(bad.outputs)}`)
}

console.log('AgentReady action smoke passed')
