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

// Linters/formatters that, when invoked anywhere in a package script body,
// expose a lint surface — even when the script is named `test` (e.g.
// `"test": "xo && ava"`) or `check:lint` rather than `lint`.
const LINT_COMMAND_PATTERNS: RegExp[] = [
  /\beslint\b/,
  /\bxo\b/,
  /\bbiome\b/,
  /\bprettier\b/,
  /\bstandard\b/,
  /\btslint\b/,
  /\boxlint\b/,
  /\brome\b/,
]

// Dedicated type-checkers invoked from a script body. A bare `tsc` is treated
// as a *build* (it emits), not a type-check surface — only `tsc --noEmit` (and
// purpose-built checkers) signal a check-only command, matching the original
// semantics where `"build": "tsc"` did not count as a type-check.
const TYPECHECK_COMMAND_PATTERNS: RegExp[] = [
  /\btsc\b[^\n]*?--noemit\b/i,
  /\btsd\b/,
  /\bvue-tsc\b/,
  /\bsvelte-check\b/,
  /\battw\b/,
]

// Script names that signal a lint/type-check surface even when the body
// delegates to a shell script we cannot inspect (e.g. `"lint": "./lint.sh"`).
const LINT_NAME_PATTERN = /(^|[:/_-])lint(s)?([:/_-]|$)/i
const TYPECHECK_NAME_PATTERN = /(^|[:/_-])(type-?check|check[:_-]?types?|typings?)([:/_-]|$)/i

const matchesAny = (text: string, patterns: RegExp[]): boolean => patterns.some(pattern => pattern.test(text))

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

  const scriptMap = packageJsonScripts(readJson(root, 'package.json'))
  const scripts = Object.keys(scriptMap).sort()
  // Script bodies are inspected (not just names) so a linter/type-checker run
  // inside an aggregate script — `"test": "xo && tsc --noEmit && ava"` — or under
  // a non-canonical name like `check:lint` is still recognized.
  const scriptBodies = Object.values(scriptMap).join('\n')

  return {
    scripts,
    signals: {
      ecosystem: 'node',
      hasBuild: hasAnyScript(scripts, ['build']),
      hasTest: hasAnyScript(scripts, ['test', 'test:unit', 'test:ci']),
      hasLint: scripts.some(name => LINT_NAME_PATTERN.test(name)) || matchesAny(scriptBodies, LINT_COMMAND_PATTERNS),
      hasTypeCheck:
        scripts.some(name => TYPECHECK_NAME_PATTERN.test(name)) || matchesAny(scriptBodies, TYPECHECK_COMMAND_PATTERNS),
    },
  }
}

// Safely extracts the `scripts` map from a parsed package.json, tolerating
// non-object/`null` values so a malformed manifest cannot crash the scan.
const packageJsonScripts = (packageJson: unknown): Record<string, string> => {
  if (typeof packageJson !== 'object' || packageJson === null) {
    return {}
  }
  const scripts = (packageJson as { scripts?: unknown }).scripts
  if (typeof scripts !== 'object' || scripts === null) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const [name, body] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof body === 'string') {
      result[name] = body
    }
  }
  return result
}

const makefileNames = ['Makefile', 'makefile', 'GNUmakefile']
const makeTargetPattern = /^([a-zA-Z0-9_.\-/]+)\s*:/gm

const hasCiScript = (filePaths: string[], names: string[]): boolean =>
  filePaths.some(filePath => names.some(name => new RegExp(`(^|/)${name}\\.(sh|bat|ps1)$`, 'i').test(filePath)))

const detectMake = (root: string, filePaths: Set<string>, allPaths: string[]): EcosystemSignals | undefined => {
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
    hasBuild: hasTarget('build', 'all', 'compile') || hasCiScript(allPaths, ['build', 'build-doc']),
    hasTest: hasTarget('test', 'tests', 'check') || hasCiScript(allPaths, ['test', 'run_test']),
    hasLint: hasTarget('lint', 'fmt', 'format'),
    hasTypeCheck: hasTarget('typecheck', 'type-check', 'types'),
  }
}

const detectCmake = (filePaths: Set<string>, allPaths: string[]): EcosystemSignals | undefined => {
  const hasCmake =
    has(filePaths, 'CMakeLists.txt')
    || has(filePaths, 'CMakePresets.json')
    || allPaths.some(filePath => /(^|\/)CMakeLists\.txt$/i.test(filePath))
  if (!hasCmake) {
    return undefined
  }

  return {
    ecosystem: 'cmake',
    hasBuild: true,
    hasTest:
      hasCiScript(allPaths, ['test', 'run_test'])
      || allPaths.some(filePath => /(^|\/)(CTestTestfile\.cmake|tests?|test)\//i.test(filePath)),
    hasLint: false,
    hasTypeCheck: false,
  }
}

const detectBazel = (filePaths: Set<string>, allPaths: string[]): EcosystemSignals | undefined => {
  const hasBazel =
    has(filePaths, 'WORKSPACE')
    || has(filePaths, 'WORKSPACE.bazel')
    || has(filePaths, 'MODULE.bazel')
    || allPaths.some(filePath => /(^|\/)BUILD(\.bazel)?$/i.test(filePath))
  if (!hasBazel) {
    return undefined
  }

  return {
    ecosystem: 'bazel',
    hasBuild: true,
    hasTest: true,
    hasLint: false,
    hasTypeCheck: false,
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

const parseConfigSections = (content: string): Set<string> => {
  const sections = new Set<string>()
  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^\[+([^\]#;]+)\]+/)
    if (match) {
      sections.add(match[1].trim().toLowerCase())
    }
  }
  return sections
}

const hasSection = (sections: Set<string>, ...names: string[]): boolean =>
  names.some(name => sections.has(name.toLowerCase()))

const hasSectionPrefix = (sections: Set<string>, ...prefixes: string[]): boolean =>
  [...sections].some(section => prefixes.some(prefix => section.startsWith(prefix.toLowerCase())))

const detectPython = (root: string, filePaths: Set<string>, allPaths: string[]): EcosystemSignals | undefined => {
  const manifest = pythonManifests.find(name => has(filePaths, name))
  if (!manifest) {
    return undefined
  }

  const pyproject = readText(root, 'pyproject.toml') ?? ''
  const setupCfg = readText(root, 'setup.cfg') ?? ''
  const pyprojectSections = parseConfigSections(pyproject)
  const setupCfgSections = parseConfigSections(setupCfg)
  const hasTestsDir = allPaths.some(filePath => /(^|\/)tests?\//i.test(filePath))

  return {
    ecosystem: 'python',
    hasBuild: hasSection(pyprojectSections, 'build-system') || has(filePaths, 'setup.py'),
    hasTest:
      has(filePaths, 'tox.ini')
      || hasSection(pyprojectSections, 'tool.pytest.ini_options')
      || hasSection(setupCfgSections, 'tool:pytest')
      || hasTestsDir
      || hasCiScript(allPaths, ['run_test']),
    hasLint:
      has(filePaths, '.flake8')
      || has(filePaths, 'ruff.toml')
      || has(filePaths, '.ruff.toml')
      || hasSection(pyprojectSections, 'tool.black', 'tool.isort', 'tool.ruff', 'tool.pylint', 'tool.numpydoc_validation')
      || hasSection(setupCfgSections, 'flake8', 'isort', 'tool:isort'),
    hasTypeCheck:
      has(filePaths, 'mypy.ini')
      || has(filePaths, 'pyrightconfig.json')
      || hasSection(pyprojectSections, 'tool.mypy', 'tool.pyright')
      || hasSectionPrefix(setupCfgSections, 'mypy'),
  }
}

/**
 * Detects verification command surfaces across every recognized ecosystem
 * (Node, Make, CMake, Bazel, Go, Rust, Python) and aggregates their capabilities so the
 * checks layer is no longer Node-only.
 */
export const detectCommandSurfaces = (root: string, filePaths: string[]): CommandEvidence => {
  const filePathSet = new Set(filePaths)

  const node = detectNode(root, filePathSet)
  const signals: EcosystemSignals[] = [
    node?.signals,
    detectMake(root, filePathSet, filePaths),
    detectCmake(filePathSet, filePaths),
    detectBazel(filePathSet, filePaths),
    detectGo(filePathSet),
    detectRust(filePathSet),
    detectPython(root, filePathSet, filePaths),
  ].filter((signal): signal is EcosystemSignals => signal !== undefined)

  const ecosystemOrder: CommandEcosystem[] = ['node', 'make', 'cmake', 'bazel', 'go', 'rust', 'python']
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
