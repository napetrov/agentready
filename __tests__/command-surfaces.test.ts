import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { detectCommandSurfaces } from '../lib/repo-readiness/detectors/command-surfaces'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'
import type { CommandEcosystem } from '../lib/repo-readiness/core/types'

const fixedNow = new Date('2026-05-30T00:00:00.000Z')
const fixtureRoot = path.join(__dirname, '..', 'fixtures', 'readiness')

// The deterministic command-surface detector underpins the multi-ecosystem
// claim. The fixture matrix scans a real repo per ecosystem end-to-end; the unit
// tests cover the parser branches (Makefile target aliases, package-manager
// lockfiles, Python config variants, and the file-read/JSON-parse error paths).

describe('command-surface fixture matrix', () => {
  const cases: Array<{ repo: string; ecosystem: CommandEcosystem }> = [
    { repo: 'go-repo', ecosystem: 'go' },
    { repo: 'rust-repo', ecosystem: 'rust' },
    { repo: 'python-repo', ecosystem: 'python' },
    { repo: 'make-repo', ecosystem: 'make' },
    { repo: 'good-repo', ecosystem: 'node' },
  ]

  it.each(cases)('detects the $ecosystem ecosystem with full verification capabilities ($repo)', ({ repo, ecosystem }) => {
    const report = scanLocalReadiness(path.join(fixtureRoot, repo), { now: fixedNow })

    expect(report.commands.ecosystems).toContain(ecosystem)
    expect(report.commands.hasBuild).toBe(true)
    expect(report.commands.hasTest).toBe(true)
    expect(report.commands.hasLint).toBe(true)
    expect(report.commands.hasTypeCheck).toBe(true)
    // A recognized ecosystem with full capabilities must not raise any
    // commands.*.missing finding.
    expect(report.findings.filter(f => f.id.startsWith('commands.'))).toEqual([])
  })
})

describe('detectCommandSurfaces (units)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-cmd-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): string => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
    return rel
  }

  it('reports no ecosystem for a repo with no recognized manifest', () => {
    const evidence = detectCommandSurfaces(root, ['README.md', 'notes.txt'])
    expect(evidence.ecosystems).toEqual([])
    expect(evidence.packageManager).toBeUndefined()
    expect(evidence).toMatchObject({ hasBuild: false, hasTest: false, hasLint: false, hasTypeCheck: false })
  })

  it('survives a malformed package.json (JSON parse error path)', () => {
    write('package.json', '{ this is not json')
    const evidence = detectCommandSurfaces(root, ['package.json'])
    // The ecosystem is still Node (package.json exists) but no scripts parse out.
    expect(evidence.ecosystems).toEqual(['node'])
    expect(evidence.scripts).toEqual([])
    expect(evidence.packageManager).toBe('npm')
  })

  it.each([
    { lockfile: 'pnpm-lock.yaml', manager: 'pnpm' },
    { lockfile: 'yarn.lock', manager: 'yarn' },
    { lockfile: 'bun.lockb', manager: 'bun' },
    { lockfile: 'package-lock.json', manager: 'npm' },
  ])('maps $lockfile to the $manager package manager', ({ lockfile, manager }) => {
    write('package.json', JSON.stringify({ scripts: { build: 'x' } }))
    const evidence = detectCommandSurfaces(root, ['package.json', lockfile])
    expect(evidence.packageManager).toBe(manager)
  })

  it('parses Makefile target aliases (all/compile, check, fmt/format, types)', () => {
    write('Makefile', ['all:\n\tcc -o app main.c', 'check:\n\t./t.sh', 'fmt:\n\tclang-format', 'types:\n\tcc -fsyntax-only'].join('\n'))
    const evidence = detectCommandSurfaces(root, ['Makefile'])
    expect(evidence.ecosystems).toEqual(['make'])
    expect(evidence).toMatchObject({ hasBuild: true, hasTest: true, hasLint: true, hasTypeCheck: true })
  })

  it('recognizes Python via setup.py with tox/flake8/mypy config (no pyproject)', () => {
    write('setup.py', 'from setuptools import setup\nsetup()\n')
    const evidence = detectCommandSurfaces(root, ['setup.py', 'tox.ini', '.flake8', 'mypy.ini'])
    expect(evidence.ecosystems).toEqual(['python'])
    expect(evidence).toMatchObject({ hasTest: true, hasLint: true, hasTypeCheck: true })
    // No [build-system] in a (absent) pyproject, so build stays false.
    expect(evidence.hasBuild).toBe(false)
  })

  it('detects a Python tests/ directory as test capability', () => {
    write('pyproject.toml', '[project]\nname = "x"\n')
    const evidence = detectCommandSurfaces(root, ['pyproject.toml', 'tests/test_x.py'])
    expect(evidence.ecosystems).toEqual(['python'])
    expect(evidence.hasTest).toBe(true)
  })

  it('aggregates multiple ecosystems in a stable order', () => {
    write('package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    write('Makefile', 'build:\n\tgo build\n')
    write('go.mod', 'module x\n')
    const evidence = detectCommandSurfaces(root, ['package.json', 'Makefile', 'go.mod'])
    // ecosystemOrder is node, make, go, rust, python.
    expect(evidence.ecosystems).toEqual(['node', 'make', 'go'])
  })
})
