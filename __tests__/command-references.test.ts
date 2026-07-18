import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
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

  it('recognizes a path-like make target (docs/html) instead of truncating it at the slash', () => {
    const doc = write('AGENTS.md', 'Run `make docs/html` to build the docs.')
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['docs/html', 'test'] }
    expect(detect([doc], makeCommands)).toEqual([])

    const missingTargetCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['test'] }
    expect(detect([doc], missingTargetCommands)).toEqual([
      { path: doc, reference: 'make docs/html', kind: 'make-target', detail: 'No "docs/html" target in the Makefile.' },
    ])
  })

  it('does not misread a make option as the target (make -j test, make -C subdir test)', () => {
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['build', 'test'] }
    const doc = write('AGENTS.md', 'Run `make -j test` or `make -C subdir test`.')
    // Abstains entirely rather than misreport the flag (or a flag's own
    // argument, e.g. -C's directory) as a missing target.
    expect(detect([doc], makeCommands)).toEqual([])
  })

  it('does not misread a make variable override as the target (make PREFIX=/usr/local install, make CFLAGS=-O2 test)', () => {
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['build', 'test'] }
    const doc = write('AGENTS.md', 'Run `make PREFIX=/usr/local install` or `make CFLAGS=-O2 test`.')
    // Abstains entirely rather than misreport the variable name (truncated at
    // "=", which the target character class excludes) as a missing target.
    expect(detect([doc], makeCommands)).toEqual([])
  })

  it('does not flag a make target reference that exists', () => {
    const doc = write('AGENTS.md', 'Run `make build` before committing.')
    const makeCommands: CommandEvidence = { ...baseCommands, ecosystems: ['make'], makeTargets: ['build', 'test'] }
    expect(detect([doc], makeCommands)).toEqual([])
  })

  it('flags a code-formatted bare shortcut with no matching script and no matching built-in verb', () => {
    const doc = write('README.md', 'Quick start: run `pnpm dev` to start the app.')
    const evidence = detect([doc], baseCommands)
    expect(evidence).toEqual([
      {
        path: doc,
        reference: 'pnpm dev',
        kind: 'shortcut-script',
        detail: '"pnpm dev" is not a "pnpm" built-in command and no "dev" script exists in package.json.',
      },
    ])
  })

  it('does not flag a yarn/pnpm/bun shortcut when the script actually exists (they fall back to running it)', () => {
    const doc = write('README.md', 'Quick start: run `pnpm dev` to start the app.')
    const withDevScript: CommandEvidence = { ...baseCommands, scripts: [...baseCommands.scripts, 'dev'] }
    expect(detect([doc], withDevScript)).toEqual([])
  })

  it('flags an npm bare shortcut even when the script exists: npm has no bare-script fallback', () => {
    const doc = write('README.md', 'Quick start: run `npm dev` to start the app.')
    const withDevScript: CommandEvidence = { ...baseCommands, scripts: [...baseCommands.scripts, 'dev'] }
    expect(detect([doc], withDevScript)).toEqual([
      {
        path: doc,
        reference: 'npm dev',
        kind: 'shortcut-script',
        detail: 'npm has no bare-script shortcut for "dev" (only test/start/stop/restart/t/tst run this way) -- use "npm run dev" instead.',
      },
    ])
  })

  it('does not flag npm\'s own stop/restart bare commands', () => {
    const doc = write('README.md', 'Run `npm stop` or `npm restart` as needed.')
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it('does not flag npm\'s "t"/"tst" test aliases', () => {
    const doc = write('README.md', 'Run `npm t` or `npm tst` to run tests.')
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it.each([
    ['npm', 'audit'],
    ['npm', 'ci'],
    ['yarn', 'why'],
    ['pnpm', 'add'],
    ['bun', 'upgrade'],
  ])('does not flag a real %s built-in verb (%s)', (manager, verb) => {
    const doc = write('README.md', `Run \`${manager} ${verb}\` first.`)
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it.each(['npm', 'pnpm', 'bun'])('does not flag %s\'s "i" install alias', manager => {
    const doc = write('README.md', `Quick start: \`${manager} i\` to install dependencies.`)
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it('does not flag npm\'s "create" scaffold command (e.g. `npm create vite@latest`)', () => {
    const doc = write('README.md', 'Scaffold with `npm create vite@latest`.')
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it('does not flag Yarn Berry\'s "npm" command group (e.g. `yarn npm audit`, `yarn npm publish`)', () => {
    const doc = write('README.md', 'Run `yarn npm audit` before publishing with `yarn npm publish`.')
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it('flags yarn "i" as a shortcut: yarn has no "i" install alias', () => {
    const doc = write('README.md', 'Quick start: `yarn i` to install dependencies.')
    const evidence = detect([doc], baseCommands)
    expect(evidence).toEqual([
      { path: doc, reference: 'yarn i', kind: 'shortcut-script', detail: '"yarn i" is not a "yarn" built-in command and no "i" script exists in package.json.' },
    ])
  })

  it('does not flag a shortcut mentioned only in prose, outside a code span', () => {
    const doc = write('README.md', 'This project is managed with pnpm dev-dependencies in mind.')
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it('does not double-report a "<pm> run <script>" reference under the shortcut-script kind', () => {
    const doc = write('README.md', 'Run `npm run buld` before committing.')
    const evidence = detect([doc], baseCommands)
    expect(evidence).toEqual([
      { path: doc, reference: 'npm run buld', kind: 'npm-script', detail: 'No "buld" script in package.json.' },
    ])
  })

  it('does not flag a workspace-qualified shortcut', () => {
    const doc = write('README.md', 'Run `pnpm dev --workspace packages/app` from the repo root.')
    expect(detect([doc], baseCommands)).toEqual([])
  })

  it('flags a shortcut inside a fenced code block', () => {
    const doc = write('README.md', ['Quick start:', '', '```bash', 'pnpm install', 'pnpm dev', '```'].join('\n'))
    const evidence = detect([doc], baseCommands)
    expect(evidence.map(item => item.reference)).toEqual(['pnpm dev'])
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

  it('never scans past the 200KB document cap, enforced at the read layer', () => {
    // A reference placed after the cap is truncated away entirely and never
    // flagged; one placed before it is still found. Proves the cap applies to
    // the actual bytes read, not just a post-decode string slice.
    const padding = 'x'.repeat(200_000)
    const doc = write('AGENTS.md', `Run \`npm run buld\`.\n${padding}\nRun \`npm run alsobuld\`.`)
    const evidence = detect([doc], baseCommands)
    expect(evidence.map(item => item.reference)).toEqual(['npm run buld'])
  })

  it('never reads through a symlinked doc (its content may belong to a different, package-scoped location)', () => {
    // A root-scope symlink (e.g. README.md -> packages/app/README.md) is kept
    // visible by path in the file inventory but never dereferenced there;
    // detectCommandReferences must apply the same rule, since the symlink's
    // *content* can document a nested package's own scripts that don't exist
    // at the root, and Node's default open() would otherwise follow it.
    mkdirSync(path.join(root, 'packages', 'app'), { recursive: true })
    writeFileSync(path.join(root, 'packages', 'app', 'README.md'), 'Run `npm run dev` to start the app.')
    symlinkSync(path.join('packages', 'app', 'README.md'), path.join(root, 'README.md'))

    expect(detect(['README.md'], baseCommands)).toEqual([])
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

  it('does not check a nested component README under .github/ (e.g. a local composite action) against the root command surface', () => {
    // .github/ can contain genuinely nested components — a local composite
    // action with its own package.json/scripts — not just root-equivalent
    // docs directly under it. Its own README correctly documents its own
    // "build" script; checking it against the root's (which lacks "build")
    // would be a false positive.
    write('package.json', JSON.stringify({ name: 'demo', scripts: { test: 'jest' } }))
    write('.github/actions/foo/package.json', JSON.stringify({ name: 'foo-action', scripts: { build: 'tsc' } }))
    write('.github/actions/foo/README.md', 'Run `npm run build` to compile this action.')

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    expect(report.findings.filter(f => f.id.startsWith('commands.reference.'))).toEqual([])
  })

  it('does not check a root README that is a symlink to a package-scoped README', () => {
    // The file inventory keeps a root README symlink visible by path (never
    // dereferencing it there), so detectDocs/isRootScopedDocPath still see a
    // slashless "README.md". Its actual content belongs to packages/app,
    // which documents a "dev" script the root package.json lacks — checking
    // it against the root would be a false positive.
    write('package.json', JSON.stringify({ name: 'demo', scripts: { test: 'jest' } }))
    write('packages/app/package.json', JSON.stringify({ name: 'app', scripts: { dev: 'vite' } }))
    write('packages/app/README.md', 'Run `npm run dev` to start the app.')
    symlinkSync(path.join('packages', 'app', 'README.md'), path.join(root, 'README.md'))

    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    expect(report.findings.filter(f => f.id.startsWith('commands.reference.'))).toEqual([])
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
