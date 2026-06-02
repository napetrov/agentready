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

  it('detects a linter invoked inside an aggregate test script', () => {
    // got-style: the lint and type-check run inside `test`, not as `lint`/
    // `type-check` scripts. Name-only detection misses them.
    write('package.json', JSON.stringify({ scripts: { test: "xo && tsc --noEmit && ava", build: 'tsc' } }))
    const evidence = detectCommandSurfaces(root, ['package.json'])
    expect(evidence.hasLint).toBe(true)
    expect(evidence.hasTypeCheck).toBe(true)
  })

  it('detects lint/type-check under non-canonical script names', () => {
    // commander-style: `check:lint`/`check:type` rather than `lint`/`type-check`.
    write('package.json', JSON.stringify({
      scripts: { 'check:lint': 'eslint .', 'check:type': 'tsc -p tsconfig.json' },
    }))
    const evidence = detectCommandSurfaces(root, ['package.json'])
    expect(evidence.hasLint).toBe(true)
    expect(evidence.hasTypeCheck).toBe(true)
  })

  it('treats a bare `tsc` build as a build, not a dedicated type-check surface', () => {
    // A bare `tsc` emits (a build); only `tsc --noEmit` / dedicated checkers are
    // a check-only surface. This preserves the `ci.typecheck.not-run` semantics.
    write('package.json', JSON.stringify({ scripts: { build: 'tsc', test: 'jest' } }))
    const evidence = detectCommandSurfaces(root, ['package.json'])
    expect(evidence.hasBuild).toBe(true)
    expect(evidence.hasTypeCheck).toBe(false)
  })

  it('does not count a linter/type-checker named only as an install argument', () => {
    // `npm install eslint` / `pnpm add -D tsd` install tooling; they do not run
    // it, so the package names must not be read as verification surfaces.
    write('package.json', JSON.stringify({
      scripts: { setup: 'npm install eslint', tools: 'pnpm add -D tsd', test: 'jest' },
    }))
    const evidence = detectCommandSurfaces(root, ['package.json'])
    expect(evidence.hasLint).toBe(false)
    expect(evidence.hasTypeCheck).toBe(false)
  })

  it('still detects a linter that runs after an install in the same script', () => {
    write('package.json', JSON.stringify({ scripts: { ci: 'npm install eslint && eslint .' } }))
    const evidence = detectCommandSurfaces(root, ['package.json'])
    expect(evidence.hasLint).toBe(true)
  })

  it('does not treat a hyphenated release tool (standard-version) as the StandardJS linter', () => {
    write('package.json', JSON.stringify({ scripts: { release: 'standard-version', test: 'jest' } }))
    expect(detectCommandSurfaces(root, ['package.json']).hasLint).toBe(false)
  })

  it('still recognizes the bare StandardJS linter', () => {
    write('package.json', JSON.stringify({ scripts: { verify: 'standard', test: 'jest' } }))
    expect(detectCommandSurfaces(root, ['package.json']).hasLint).toBe(true)
  })

  it('does not invent lint/type-check surfaces for a plain test-only package', () => {
    write('package.json', JSON.stringify({ scripts: { test: 'jest' } }))
    const evidence = detectCommandSurfaces(root, ['package.json'])
    expect(evidence.hasLint).toBe(false)
    expect(evidence.hasTypeCheck).toBe(false)
  })

  it('parses Makefile target aliases (all/compile, check, fmt/format, types)', () => {
    write('Makefile', ['all:\n\tcc -o app main.c', 'check:\n\t./t.sh', 'fmt:\n\tclang-format', 'types:\n\tcc -fsyntax-only'].join('\n'))
    const evidence = detectCommandSurfaces(root, ['Makefile'])
    expect(evidence.ecosystems).toEqual(['make'])
    expect(evidence).toMatchObject({ hasBuild: true, hasTest: true, hasLint: true, hasTypeCheck: true })
  })

  it('recognizes CI script conventions beside a Makefile', () => {
    write('makefile', 'help:\n\t@echo help\n')
    write('.ci/scripts/build.sh', '#!/usr/bin/env bash\n')
    write('.ci/scripts/test.sh', '#!/usr/bin/env bash\n')
    const evidence = detectCommandSurfaces(root, ['makefile', '.ci/scripts/build.sh', '.ci/scripts/test.sh'])
    expect(evidence.ecosystems).toEqual(['make'])
    expect(evidence.hasBuild).toBe(true)
    expect(evidence.hasTest).toBe(true)
  })

  it('recognizes CMake and Bazel as first-class build ecosystems', () => {
    write('src/CMakeLists.txt', 'add_library(x x.cpp)\n')
    write('MODULE.bazel', 'module(name = "x")\n')
    write('lib/BUILD.bazel', 'cc_library(name = "x")\n')
    const evidence = detectCommandSurfaces(root, ['src/CMakeLists.txt', 'MODULE.bazel', 'lib/BUILD.bazel'])
    expect(evidence.ecosystems).toEqual(['cmake', 'bazel'])
    expect(evidence.hasBuild).toBe(true)
    expect(evidence.hasTest).toBe(true)
  })

  it('recognizes Python via setup.py with tox/flake8/mypy config (no pyproject)', () => {
    write('setup.py', 'from setuptools import setup\nsetup()\n')
    const evidence = detectCommandSurfaces(root, ['setup.py', 'tox.ini', '.flake8', 'mypy.ini'])
    expect(evidence.ecosystems).toEqual(['python'])
    expect(evidence).toMatchObject({ hasBuild: true, hasTest: true, hasLint: true, hasTypeCheck: true })
  })

  it('recognizes Python lint config without treating Copyright as pyright', () => {
    write('pyproject.toml', '# Copyright contributors\n[tool.black]\nline-length = 100\n')
    write('setup.cfg', '[flake8]\nmax-line-length = 100\n')
    const evidence = detectCommandSurfaces(root, ['pyproject.toml', 'setup.cfg'])
    expect(evidence.ecosystems).toEqual(['python'])
    expect(evidence.hasLint).toBe(true)
    expect(evidence.hasTypeCheck).toBe(false)
  })

  it('does not infer Python tools from comments or prose', () => {
    write('pyproject.toml', '# pytest, ruff, mypy, pyright are mentioned in a comment only\n[project]\nname = "x"\n')
    write('setup.cfg', '# [flake8] in a comment only\n')
    const evidence = detectCommandSurfaces(root, ['pyproject.toml', 'setup.cfg'])
    expect(evidence.ecosystems).toEqual(['python'])
    expect(evidence).toMatchObject({ hasTest: false, hasLint: false, hasTypeCheck: false })
  })

  it('does not treat setup.cfg pytest config as lint coverage', () => {
    write('pyproject.toml', '[project]\nname = "x"\n')
    write('setup.cfg', '[tool:pytest]\naddopts = -ra\n')
    const evidence = detectCommandSurfaces(root, ['pyproject.toml', 'setup.cfg'])
    expect(evidence.ecosystems).toEqual(['python'])
    expect(evidence).toMatchObject({ hasTest: true, hasLint: false })
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
    write('CMakePresets.json', '{}\n')
    write('go.mod', 'module x\n')
    const evidence = detectCommandSurfaces(root, ['package.json', 'Makefile', 'CMakePresets.json', 'go.mod'])
    // ecosystemOrder is node, make, cmake, bazel, go, rust, python.
    expect(evidence.ecosystems).toEqual(['node', 'make', 'cmake', 'go'])
  })
})
