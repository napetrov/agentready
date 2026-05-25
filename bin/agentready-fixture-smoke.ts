#!/usr/bin/env tsx
import { spawnSync } from 'child_process'
import path from 'path'
import {
  validateLocalReadinessReportContract,
} from '../lib/repo-readiness/local-readiness'

const repoRoot = process.cwd()

const runAgentReady = (args: string[]): { status: number; stdout: string; stderr: string } => {
  const result = spawnSync('npm', ['run', 'agentready', '--', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

const extractJson = (stdout: string): unknown => {
  const jsonStart = stdout.indexOf('{')
  if (jsonStart === -1) {
    throw new Error(`expected JSON output, got: ${stdout}`)
  }

  return JSON.parse(stdout.slice(jsonStart))
}

const assertValidScan = (label: string, stdout: string): { score: number; findings: number } => {
  const report = extractJson(stdout)
  const validation = validateLocalReadinessReportContract(report)
  if (!validation.valid) {
    throw new Error(`${label} contract failed: ${validation.errors.join('; ')}`)
  }

  const typedReport = report as { summary: { score: number }; findings: unknown[] }
  return {
    score: typedReport.summary.score,
    findings: typedReport.findings.length,
  }
}

const goodFixture = path.join('fixtures', 'readiness', 'good-repo')
const badFixture = path.join('fixtures', 'readiness', 'bad-repo')

const goodScan = runAgentReady(['scan', goodFixture, '--json'])
if (goodScan.status !== 0) {
  throw new Error(`good fixture should pass, status=${goodScan.status}, stderr=${goodScan.stderr}`)
}
const goodSummary = assertValidScan('good fixture', goodScan.stdout)
if (goodSummary.score !== 100 || goodSummary.findings !== 0) {
  throw new Error(`good fixture expected score 100 and no findings, got score=${goodSummary.score}, findings=${goodSummary.findings}`)
}

const badScan = runAgentReady(['scan', badFixture, '--json'])
if (badScan.status === 0) {
  throw new Error('bad fixture should fail because it has error-severity readiness findings')
}
const badSummary = assertValidScan('bad fixture', badScan.stdout)
if (badSummary.score >= 100 || badSummary.findings === 0) {
  throw new Error(`bad fixture expected findings and lower score, got score=${badSummary.score}, findings=${badSummary.findings}`)
}

const markdownScan = runAgentReady(['scan', badFixture, '--markdown'])
if (markdownScan.status === 0) {
  throw new Error('markdown scan for bad fixture should fail because it has error-severity readiness findings')
}
if (!markdownScan.stdout.includes('## AgentReady scan') || !markdownScan.stdout.includes('### Findings')) {
  throw new Error('markdown scan output is missing expected sections')
}

console.log('AgentReady fixture smoke passed')
