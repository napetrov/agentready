import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { CommandEcosystem, CommandEvidence, PackageManager } from '../core/types'

const readText = (root: string, repoPath: string): string | undefined => {
  const absolutePath = path.join(root, repoPath)
  if (!existsSync(absolutePath)) {
    return undefined
  }
  try {
    return readFileSync(absolutePath, 'utf8')
  } catch {
    return undefined
  }
}

const readJson = (root: string, repoPath: string): unknown | undefined => {
  const text = readText(root, repoPath)
  if (text === undefined) {
    return undefined
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    console.error(`AgentReady: could not parse ${repoPath}: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

const hasAnyScript = (scripts: string[], names: string[]): boolean => names.some(name => scripts.includes(name))

const has = (filePaths: Set<string>, candidate: string): boolean => filePaths.has(candidate)

interface EcosystemSignals {
  ecosystem: CommandEcosystem
  hasBuild: boolean
  hasTest: boolean
  hasLint: boolean
  hasTypeCheck: boolean
}

const detectPackageManager = (filePaths: Set<string>): PackageManager | undefined => {
  if (has(filePaths, 'pnpm-lock.yaml')) return 'pnpm'
  if (has(filePaths, 'yarn.lock')) return 'yarn'
  if (has(filePaths, 'bun.lockb')) return 'bun'
  if (has(filePaths, 'package-lock.json') || has(filePaths, 'package.json')) return 'npm'
  return undefined
}

const detectNode = (root: string, filePaths: Set<string>): { signals: EcosystemSignals; scripts: string[] } | undefined => {
  if (!has(filePaths, 'package.json')) {
    return undefined
  }

  const packageJson = readJson(root, 'package.json') as { scripts?: Record<string, string> } | undefined
  const scripts = Object.keys(packageJson?.scripts ?? {}).sort()

  return {
    scripts,
    signals: {
      ecosystem: 'node',
      hasBuild: hasAnyScript(scripts, ['build']),
      hasTest: hasAnyScript(scripts, ['test', 'test:unit', 'test:ci']),
      hasLint: hasAnyScript(scripts, ['lint']),
      hasTypeCheck: hasAnyScript(scripts, ['type-check', 'typecheck', 'check:types']),
    },
  }
}

const makefileNames = ['Makefile', 'makefile', 'GNUmakefile']
const makeTargetPattern = /^([a-zA-Z0-9_.\-/]+)\s*:/gm

const detectMake = (root: string, filePaths: Set<string>): EcosystemSignals | undefined => {
  const makefile = makefileNames.find(name => has(filePaths, name))
  if (!makefile) {
    return undefined
  }

  const content = readText(root, makefile) ?? ''
  const targets = new Set<string>()
  for (const match of content.matchAll(makeTargetPattern)) {
    targets.add(match[1].toLowerCase())
  }

  const hasTarget = (...names: string[]): boolean => names.some(name => targets.has(name))

  return {
    ecosystem: 'make',
    hasBuild: hasTarget('build', 'all', 'compile'),
    hasTest: hasTarget('test', 'tests', 'check'),
    hasLint: hasTarget('lint', 'fmt', 'format'),
    hasTypeCheck: hasTarget('typecheck', 'type-check', 'types'),
  }
}

// The Go toolchain ships `go build`, `go test`, and `go vet`, and the compiler
// type-checks, so a module manifest implies these verification commands exist.
const detectGo = (filePaths: Set<string>): EcosystemSignals | undefined => {
  if (!has(filePaths, 'go.mod')) {
    return undefined
  }

  return {
    ecosystem: 'go',
    hasBuild: true,
    hasTest: true,
    hasLint: true,
    hasTypeCheck: true,
  }
}

// Cargo ships `cargo build`, `cargo test`, and `cargo check`; clippy ships with
// the standard rustup toolchain.
const detectRust = (filePaths: Set<string>): EcosystemSignals | undefined => {
  if (!has(filePaths, 'Cargo.toml')) {
    return undefined
  }

  return {
    ecosystem: 'rust',
    hasBuild: true,
    hasTest: true,
    hasLint: true,
    hasTypeCheck: true,
  }
}

const pythonManifests = ['pyproject.toml', 'setup.py', 'setup.cfg']

const detectPython = (root: string, filePaths: Set<string>, allPaths: string[]): EcosystemSignals | undefined => {
  const manifest = pythonManifests.find(name => has(filePaths, name))
  if (!manifest) {
    return undefined
  }

  const pyproject = readText(root, 'pyproject.toml') ?? ''
  const hasTestsDir = allPaths.some(filePath => /(^|\/)tests?\//i.test(filePath))
  const mentions = (...needles: string[]): boolean => needles.some(needle => pyproject.includes(needle))

  return {
    ecosystem: 'python',
    hasBuild: pyproject.includes('[build-system]'),
    hasTest: has(filePaths, 'tox.ini') || mentions('pytest') || hasTestsDir,
    hasLint:
      has(filePaths, '.flake8')
      || has(filePaths, 'ruff.toml')
      || has(filePaths, '.ruff.toml')
      || mentions('ruff', 'flake8', 'pylint'),
    hasTypeCheck:
      has(filePaths, 'mypy.ini')
      || mentions('mypy', 'pyright'),
  }
}

/**
 * Detects verification command surfaces across every recognized ecosystem
 * (Node, Make, Go, Rust, Python) and aggregates their capabilities so the
 * checks layer is no longer Node-only.
 */
export const detectCommandSurfaces = (root: string, filePaths: string[]): CommandEvidence => {
  const filePathSet = new Set(filePaths)

  const node = detectNode(root, filePathSet)
  const signals: EcosystemSignals[] = [
    node?.signals,
    detectMake(root, filePathSet),
    detectGo(filePathSet),
    detectRust(filePathSet),
    detectPython(root, filePathSet, filePaths),
  ].filter((signal): signal is EcosystemSignals => signal !== undefined)

  const ecosystemOrder: CommandEcosystem[] = ['node', 'make', 'go', 'rust', 'python']
  const ecosystems = ecosystemOrder.filter(name => signals.some(signal => signal.ecosystem === name))

  return {
    packageManager: detectPackageManager(filePathSet),
    ecosystems,
    scripts: node?.scripts ?? [],
    hasBuild: signals.some(signal => signal.hasBuild),
    hasTest: signals.some(signal => signal.hasTest),
    hasLint: signals.some(signal => signal.hasLint),
    hasTypeCheck: signals.some(signal => signal.hasTypeCheck),
  }
}
