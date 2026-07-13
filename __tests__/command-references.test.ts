import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { detectCommandReferences } from '../lib/repo-readiness/detectors/command-references'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'
import type { CommandEvidence } from '../lib/repo-readiness/core/types'

const baseCommands: CommandEvidence = {
  packageManager: 'npm',
  ecosystems: ['node'],
  scripts: ['build', 'test', 'lint'],
  makeTargets: [],
  hasBuild: true,
  hasTest: true,
  hasLint: true,
  hasTypeCheck: false,
}

describe('detectCommandReferences (units)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-cmdref-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): string => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
    return rel
  }

  it('flags an npm run reference to a script that does not exist', () => {
    const doc = write('AGENTS.md', 'Run `npm run buld` before committing.')
    const evidence = detectCommandReferences(root, [doc], baseCommands)
    expect(evidence).toEqual([
      { path: doc, reference: 'npm run buld', kind: 'npm-script', detail: 'No "buld" script in package.json.' },
    ])
  })

  it('does not flag an npm run reference to a script that exists', () => {
    const doc = write('AGENTS.md', 'Run `npm run build` and `npm run test` before committing.')
    expect(detectCommandReferences(root, [doc], baseCommands)).toEqual([])
  })

  it('flags bare "npm test"/"npm start" only when the script is missing', () => {
    const doc = write('AGENTS.md', 'Run `npm test`, then `npm start`.')
    const evidence = detectCommandReferences(root, [doc], baseCommands)
    expect(evidence).toEqual([
      { path: doc, reference: 'npm start', kind: 'npm-script', detail: 'No "start" script in package.json.' },
    ])
  })

  it('does not check npm/yarn/pnpm/bun references when the repo is not a Node project', () => {
    const doc = write('AGENTS.md', 'Run `npm run buld`.')
    const evidence = detectCommandReferences(root, [doc], { ...baseCommands, ecosystems: [] })
    expect(evidence).toEqual([])
  })

  it('flags a yarn/pnpm/bun run reference the same way as npm', () => {
    const doc = write('AGENTS.md', 'Run `yarn run buld`, `pnpm run buld`, and `bun run buld`.')
    const evidence = detectCommandReferences(root, [doc], baseCommands)
    expect(evidence.map(item => item.reference)).toEqual(['bun run buld', 'pnpm run buld', 'yarn run buld'])
  })

  it('flags a make target reference that does not exist, only for Make repos', () => {
    const doc = write('AGENTS.md', 'Run `make check` before committing.')
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['build', 'test'] }
    expect(detectCommandReferences(root, [doc], makeCommands)).toEqual([
      { path: doc, reference: 'make check', kind: 'make-target', detail: 'No "check" target in the Makefile.' },
    ])
    expect(detectCommandReferences(root, [doc], { ...baseCommands, ecosystems: [] })).toEqual([])
  })

  it('does not flag a make target reference that exists', () => {
    const doc = write('AGENTS.md', 'Run `make build` before committing.')
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['build', 'test'] }
    expect(detectCommandReferences(root, [doc], makeCommands)).toEqual([])
  })

  it('flags a package-manager mismatch against the detected lockfile', () => {
    const doc = write('AGENTS.md', 'Run `pnpm install` to set up dependencies.')
    const evidence = detectCommandReferences(root, [doc], baseCommands) // baseCommands.packageManager is npm
    expect(evidence).toEqual([
      {
        path: doc,
        reference: 'pnpm install',
        kind: 'package-manager-mismatch',
        detail: 'Repository lockfile indicates "npm", not "pnpm".',
      },
    ])
  })

  it('does not flag an install reference that matches the detected package manager', () => {
    const doc = write('AGENTS.md', 'Run `npm install` (or `npm ci` in CI).')
    expect(detectCommandReferences(root, [doc], baseCommands)).toEqual([])
  })

  it('does not check package-manager mentions when no package manager was detected', () => {
    const doc = write('AGENTS.md', 'Run `pnpm install`.')
    expect(detectCommandReferences(root, [doc], { ...baseCommands, packageManager: undefined })).toEqual([])
  })

  it('skips a doc path that does not exist without throwing', () => {
    expect(() => detectCommandReferences(root, ['missing.md'], baseCommands)).not.toThrow()
    expect(detectCommandReferences(root, ['missing.md'], baseCommands)).toEqual([])
  })

  it('de-duplicates repeated doc paths', () => {
    const doc = write('AGENTS.md', 'Run `npm run buld`.')
    expect(detectCommandReferences(root, [doc, doc], baseCommands)).toHaveLength(1)
  })
})

describe('command reference findings (integration)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-cmdref-scan-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): void => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  it('surfaces a stale script reference as a warning finding scoped to the commands dimension', () => {
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest' } }))
    write('AGENTS.md', 'Run `npm run buld` and `npm test` before committing.')

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })

    const finding = report.findings.find(f => f.id.startsWith('commands.reference.npm-script'))
    expect(finding).toMatchObject({ severity: 'warning', path: 'AGENTS.md' })
    expect(finding?.recommendation).toContain('npm run buld')

    const commandsDimension = report.dimensions.find(d => d.category === 'commands')
    expect(commandsDimension?.bySeverity.warning).toBeGreaterThanOrEqual(1)
  })

  it('does not emit a finding when every referenced script exists', () => {
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest' } }))
    write('AGENTS.md', 'Run `npm run build` and `npm test` before committing.')

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })

    expect(report.findings.filter(f => f.id.startsWith('commands.reference.'))).toEqual([])
  })
})
