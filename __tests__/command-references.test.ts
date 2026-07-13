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

  // Most cases don't care about lockfile presence; the default `filePaths`
  // has none, and the package-manager-mismatch tests pass their own.
  const detect = (docPaths: string[], commands: CommandEvidence, filePaths: string[] = []) =>
    detectCommandReferences(root, docPaths, commands, filePaths)

  it('flags an npm run reference to a script that does not exist', () => {
    const doc = write('AGENTS.md', 'Run `npm run buld` before committing.')
    const evidence = detect([doc], baseCommands)
    expect(evidence).toEqual([
      { path: doc, reference: 'npm run buld', kind: 'npm-script', detail: 'No "buld" script in package.json.' },
    ])
  })

  it('does not flag an npm run reference to a script that exists', () => {
    const doc = write('AGENTS.md', 'Run `npm run build` and `npm run test` before committing.')
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it.each([
    ['--workspace', 'npm run dev --workspace packages/app'],
    ['--workspace=', 'npm run dev --workspace=packages/app'],
    ['-w', 'npm run dev -w packages/app'],
    ['--workspaces', 'npm run dev --workspaces'],
  ])('does not flag a workspace-qualified npm run reference (%s)', (_label, line) => {
    const doc = write('AGENTS.md', `Run \`${line}\` from the repo root.`)
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it('still flags an unqualified npm run reference on a different line from a workspace flag', () => {
    const doc = write('AGENTS.md', 'Run `npm run dev --workspace packages/app`.\nAlso run `npm run buld`.')
    const evidence = detect([doc], baseCommands)
    expect(evidence).toEqual([
      { path: doc, reference: 'npm run buld', kind: 'npm-script', detail: 'No "buld" script in package.json.' },
    ])
  })

  it('flags bare "npm test"/"npm start" only when the script is missing', () => {
    const doc = write('AGENTS.md', 'Run `npm test`, then `npm start`.')
    const evidence = detect([doc], baseCommands)
    expect(evidence).toEqual([
      { path: doc, reference: 'npm start', kind: 'npm-script', detail: 'No "start" script in package.json.' },
    ])
  })

  it('does not flag bare "npm start" when a root server.js provides npm\'s documented fallback', () => {
    const doc = write('AGENTS.md', 'Run `npm start` to launch the app.')
    expect(detect([doc], baseCommands, [])).toEqual([
      { path: doc, reference: 'npm start', kind: 'npm-script', detail: 'No "start" script in package.json.' },
    ])
    expect(detect([doc], baseCommands, ['server.js'])).toEqual([])
  })

  it('does not flag bare "bun test": Bun\'s test runner needs no package script', () => {
    const doc = write('AGENTS.md', 'Run `bun test` before committing.')
    const noTestScript: CommandEvidence = { ...baseCommands, scripts: ['build', 'lint'] } // no "test" script at all
    expect(detect([doc], noTestScript)).toEqual([])
  })

  it('still flags bare "bun start" when the script is missing (the exception is test-only)', () => {
    const doc = write('AGENTS.md', 'Run `bun start` to launch the app.')
    const evidence = detect([doc], baseCommands)
    expect(evidence).toEqual([
      { path: doc, reference: 'bun start', kind: 'npm-script', detail: 'No "start" script in package.json.' },
    ])
  })

  it('does not check npm/yarn/pnpm/bun references when the repo is not a Node project', () => {
    const doc = write('AGENTS.md', 'Run `npm run buld`.')
    expect(detect([doc], { ...baseCommands, ecosystems: [] })).toEqual([])
  })

  it('flags a yarn/pnpm/bun run reference the same way as npm', () => {
    const doc = write('AGENTS.md', 'Run `yarn run buld`, `pnpm run buld`, and `bun run buld`.')
    const evidence = detect([doc], baseCommands)
    expect(evidence.map(item => item.reference)).toEqual(['bun run buld', 'pnpm run buld', 'yarn run buld'])
  })

  it('flags a make target reference that does not exist, only for Make repos', () => {
    const doc = write('AGENTS.md', 'Run `make check` before committing.')
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['build', 'test'] }
    expect(detect([doc], makeCommands)).toEqual([
      { path: doc, reference: 'make check', kind: 'make-target', detail: 'No "check" target in the Makefile.' },
    ])
    expect(detect([doc], { ...baseCommands, ecosystems: [] })).toEqual([])
  })

  it('does not misread a make option as the target (make -j test, make -C subdir test)', () => {
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['build', 'test'] }
    const doc = write('AGENTS.md', 'Run `make -j test` or `make -C subdir test`.')
    // Abstains entirely rather than misreport the flag (or a flag's own
    // argument, e.g. -C's directory) as a missing target.
    expect(detect([doc], makeCommands)).toEqual([])
  })

  it('does not flag a make target reference that exists', () => {
    const doc = write('AGENTS.md', 'Run `make build` before committing.')
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['build', 'test'] }
    expect(detect([doc], makeCommands)).toEqual([])
  })

  it('flags a package-manager mismatch when an actual lockfile contradicts it', () => {
    const doc = write('AGENTS.md', 'Run `pnpm install` to set up dependencies.')
    // baseCommands.packageManager is npm; package-lock.json is a real lockfile.
    const evidence = detect([doc], baseCommands, ['package-lock.json'])
    expect(evidence).toEqual([
      {
        path: doc,
        reference: 'pnpm install',
        kind: 'package-manager-mismatch',
        detail: 'Repository lockfile indicates "npm", not "pnpm".',
      },
    ])
  })

  it('does not flag a package-manager mismatch when there is no lockfile at all', () => {
    // A bare package.json with no lockfile still makes detectCommandSurfaces
    // report packageManager: 'npm' as a default, not a real signal — nothing
    // contradicts documented pnpm/yarn instructions in an unlocked project.
    const doc = write('AGENTS.md', 'Run `pnpm install` to set up dependencies.')
    expect(detect([doc], baseCommands, [])).toEqual([])
  })

  it('does not flag an install reference that matches the detected package manager', () => {
    const doc = write('AGENTS.md', 'Run `npm install` (or `npm ci` in CI).')
    expect(detect([doc], baseCommands, ['package-lock.json'])).toEqual([])
  })

  it('does not check package-manager mentions when no package manager was detected', () => {
    const doc = write('AGENTS.md', 'Run `pnpm install`.')
    expect(detect([doc], { ...baseCommands, packageManager: undefined }, ['package-lock.json'])).toEqual([])
  })

  it('skips a doc path that does not exist without throwing', () => {
    expect(() => detect(['missing.md'], baseCommands)).not.toThrow()
    expect(detect(['missing.md'], baseCommands)).toEqual([])
  })

  it('de-duplicates repeated doc paths', () => {
    const doc = write('AGENTS.md', 'Run `npm run buld`.')
    expect(detect([doc, doc], baseCommands)).toHaveLength(1)
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

  it('checks a root-scope instruction file even when its path contains a slash', () => {
    // .claude/CLAUDE.md and .github/copilot-instructions.md are always-loaded,
    // repo-level instruction files (scope: 'root' per detectInstructionSurfaces)
    // despite living under a subdirectory — they must be checked the same as a
    // slashless root file, not skipped as if they were package-scoped.
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest' } }))
    write('.claude/CLAUDE.md', 'Run `npm run buld` before committing.')
    write('.github/copilot-instructions.md', 'Run `npm run buld` before committing.')

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    const staleReferencePaths = report.findings
      .filter(f => f.id.startsWith('commands.reference.npm-script'))
      .map(f => f.path)

    expect(staleReferencePaths).toContain('.claude/CLAUDE.md')
    expect(staleReferencePaths).toContain('.github/copilot-instructions.md')
  })

  it('checks .github/CONTRIBUTING.md as root-equivalent, but not a nested CLAUDE.md memory file', () => {
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest' } }))
    write('.github/CONTRIBUTING.md', 'Run `npm run buld` before committing.')
    // A nested CLAUDE.md (not under .claude/) is path-specific subdirectory
    // memory, not root scope — checking it against the root's scripts would
    // misattribute a package-scoped doc's own commands as stale.
    write('packages/app/CLAUDE.md', 'Run `npm run dev` to start the app.')

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    const staleReferencePaths = report.findings
      .filter(f => f.id.startsWith('commands.reference.npm-script'))
      .map(f => f.path)

    expect(staleReferencePaths).toEqual(['.github/CONTRIBUTING.md'])
  })

  it('does not emit a finding when every referenced script exists', () => {
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest' } }))
    write('AGENTS.md', 'Run `npm run build` and `npm test` before committing.')

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })

    expect(report.findings.filter(f => f.id.startsWith('commands.reference.'))).toEqual([])
  })

  it('does not check a nested/package-scoped README against the root command surface', () => {
    // Root has no "dev" script; the nested package does, and its own README
    // correctly documents it. Checking it against the root's scripts would be
    // a false positive.
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest' } }))
    write('packages/app/package.json', JSON.stringify({ name: 'app', scripts: { dev: 'vite' } }))
    write('packages/app/README.md', 'Run `npm run dev` to start the app.')

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })

    expect(report.findings.filter(f => f.id.startsWith('commands.reference.'))).toEqual([])
  })

  it('does not flag a package-manager mismatch for an unlocked package.json-only repo', () => {
    write('package.json', JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'jest' } }))
    write('AGENTS.md', 'Run `pnpm install` to set up dependencies.')

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })

    expect(report.findings.filter(f => f.id.startsWith('commands.reference.'))).toEqual([])
  })
})
