import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { parse as parseYaml } from 'yaml'
import type { CiCommandKind, CiEvidence, CiWorkflow, CiWorkflowJob } from '../core/types'

const COMMAND_KIND_ORDER: CiCommandKind[] = ['install', 'lint', 'typecheck', 'test', 'build']

/**
 * Heuristics that map a shell `run:` step to the verification command kinds it
 * exercises. The goal is to recognize the commands an agent would use to
 * validate its work; correctness of the workflow itself is intentionally left
 * to dedicated tools (actionlint, ShellCheck).
 */
const RUN_PATTERNS: Record<CiCommandKind, RegExp[]> = {
  install: [
    /\bnpm (ci|install|i)\b/,
    /\byarn install\b/,
    /\bpnpm (install|i)\b/,
    /\bbun install\b/,
    /\bpip install\b/,
    /\b(poetry|pipenv) install\b/,
    /\bgo mod download\b/,
    /\bcargo fetch\b/,
    /\bbundle install\b/,
    /\bdotnet restore\b/,
  ],
  lint: [
    /\beslint\b/,
    /\b(prettier|biome)\b/,
    // JS linters/style tools whose package-script surface the command detector
    // also recognizes, so CI running them satisfies lint coverage. The trailing
    // `(?!-)` excludes hyphenated false-friends such as `standard-version`.
    /\b(xo|standard|tslint|oxlint|rome)\b(?!-)/,
    /\bruff\b/,
    /\bflake8\b/,
    /\bpylint\b/,
    /\bblack\b/,
    /\bclippy\b/,
    /\bgolangci-lint\b/,
    /\bgofmt\b/,
    // `go vet` is the toolchain's built-in static analyzer; the command-surface
    // detector counts it as the lint surface for Go modules, so CI running it
    // must satisfy lint coverage.
    /\bgo vet\b/,
    /\b(npm|pnpm|yarn) run lint\b/,
    /\bmake (lint|fmt|format)\b/,
    // JVM static-analysis tasks (Gradle/Maven plugins). Only an *explicit* lint
    // task counts: a bare `gradle build`/`check` is NOT credited as lint, because
    // whether the lifecycle runs a static-analysis task depends on plugin config
    // the context-free classifier can't see — and in a mixed repo (e.g. a Node
    // `lint` script alongside a plugin-less Gradle build) crediting it would
    // wrongly suppress an unrelated `ci.lint.not-run`.
    /\bgradlew?\b.*\b(spotlesscheck|ktlintcheck|detekt|checkstyle\w*|pmd\w*|spotbugs\w*)\b/,
    /\bmvnw?\b.*\b(checkstyle|spotless|pmd|spotbugs)\b/,
    // Roslyn analyzers run on every .NET build; `dotnet format` is the formatter.
    // Anchor the subcommand on whitespace/end so `dotnet build-server shutdown`
    // (a cleanup command, not a compile) does not match `build`.
    /\bdotnet format(\s|$)/,
    /\bdotnet (build|test|publish)(\s|$)/,
  ],
  typecheck: [
    // Only a check-only `tsc --noEmit` (or a purpose-built checker) counts as a
    // type-check surface; a bare/emitting `tsc` is a build (see the build
    // patterns). This mirrors the command-surface detector exactly, so resolving
    // a `npm run build` alias whose body is `tsc` can no longer suppress
    // `ci.typecheck.not-run` when CI never runs the dedicated type-check command.
    /\btsc\b[^\n]*--noemit\b/,
    /\b(tsd|vue-tsc|svelte-check|attw)\b/,
    /\bmypy\b/,
    /\bpyright\b/,
    // The Go and Rust compilers type-check as part of build/test (and `cargo
    // check`), which is why the command-surface detector treats those toolchains
    // as exposing a type-check surface. Recognize the same commands here so a
    // normal `go test`/`cargo test` CI step is not falsely flagged as missing
    // type-check coverage.
    /\bcargo (check|build|test)\b/,
    /\bgo (build|test)\b/,
    // The C#/F# compiler type-checks during a .NET build/test, and the
    // command-surface detector exposes a type-check surface for .NET, so these
    // satisfy type-check coverage (a `--no-build` invocation is excluded below).
    /\bdotnet (build|test|publish)(\s|$)/,
    /\b(npm|pnpm|yarn) run (type-check|typecheck|check:types)\b/,
    /\bmake (type-check|typecheck|types)\b/,
  ],
  test: [
    /\bpytest\b/,
    /\bjest\b/,
    /\bvitest\b/,
    /\bmocha\b/,
    /\btox\b/,
    /(^|\s|[./\\])(test|run_test|run_sklearn_tests)\.(sh|bat|ps1)\b/,
    /\bgo test\b/,
    /\bcargo test\b/,
    /\b(npm|pnpm|yarn) (run )?test\b/,
    /\bmake test\b/,
    // Gradle `build`/`check` and Maven `package`/`install`/`verify` run the test
    // task as part of the default lifecycle, so they satisfy test coverage too.
    // The Gradle task must be a real task token, not a substring inside a CLI
    // option — `(?<![-\w])` rejects `--build-cache`/`--no-build-cache assemble`.
    /\bgradlew?\b[^\n]*(?<![-\w])(test|check|build)\b/,
    // The Maven phase must be a whole phase token: `(?![-\w])` rejects pre-test
    // phases such as `test-compile` (which only compiles tests, not runs them).
    /\bmvnw?\b.*\b(test|verify|package|install)(?![-\w])/,
    /\bdotnet test(\s|$)/,
  ],
  build: [
    /\bgo build\b/,
    /\bcargo build\b/,
    /\bdocker build\b/,
    /(^|\s|[./\\])(build|build-doc)\.(sh|bat|ps1)\b/,
    // A bare/emitting `tsc` (including `tsc -b`/`--build`) is a build; only
    // `tsc --noEmit` is a dedicated type-check (handled above).
    /\btsc\b(?![^\n]*--noemit)/,
    /\b(npm|pnpm|yarn) run build\b/,
    /\bmake build\b/,
    /\bgradlew?\b[^\n]*(?<![-\w])(assemble|build)\b/,
    /\bmvnw?\b.*\b(package|install|compile|verify)\b/,
    // `dotnet test` compiles the solution before running tests (unless
    // `--no-build` is passed, handled below), so it is build coverage too.
    // Whitespace/end-anchored so `dotnet build-server` is not read as `build`.
    /\bdotnet (build|publish|test)(\s|$)/,
  ],
}

/**
 * Well-known marketplace actions that run a verification command, so a workflow
 * that uses them counts even without an explicit `run:` step.
 */
const USES_KINDS: Array<{ pattern: RegExp; kind: CiCommandKind }> = [
  { pattern: /^golangci\/golangci-lint-action/, kind: 'lint' },
  { pattern: /^pre-commit\/action/, kind: 'lint' },
]

// The command kinds whose CI coverage a general task runner can plausibly
// satisfy (install has no not-run check, so it is omitted).
const ALL_COVERABLE_KINDS: CiCommandKind[] = ['lint', 'typecheck', 'test', 'build']

// Splits a shell `run:` block into individual command invocations so each is
// judged on its own (e.g. `make lint && make richtest` → two invocations: one
// recognized, one opaque).
const COMMAND_SEPARATORS = /&&|\|\||[;\n]/

// A trailing backslash continues a shell command onto the next line, so it is a
// single invocation (`pip install \⏎  pytest`), not two. Collapse such
// continuations before splitting so a wrapped install argument is not parsed as
// its own command.
const splitCommands = (run: string): string[] => run.replace(/\\\r?\n/g, ' ').split(COMMAND_SEPARATORS)

// File/inspection utilities that manipulate or read a file without executing it.
// A verification script's *path* often appears as their argument (e.g.
// `chmod +x test.sh`, `cat build.sh`, `cp test.sh dist/`), which would otherwise
// match the script-path patterns and create false test/build coverage. Such a
// segment is skipped entirely — these leaders never run a verification command,
// so the actual execution (`./test.sh`, `bash run_test.sh`) is what counts. The
// match is anchored to the leading token and `call` (which *does* execute, used
// on Windows: `call run_test.bat`) is deliberately excluded.
const NON_EXECUTING_LEADERS =
  /^(chmod|chown|cat|rm|rmdir|cp|mv|ln|ls|echo|printf|touch|mkdir|head|tail|less|more|file|stat|wc|pwd|cd)\b/

// Flags that disable test execution for a JVM lifecycle command. Gradle excludes
// the `test`/`check` task with `-x`/`--exclude-task`; Maven skips tests with
// `-DskipTests` or `-Dmaven.test.skip`. Matched against already-lowercased text.
const GRADLE_TEST_SKIP = /(^|\s)(-x|--exclude-task)[=\s]+\S*\b(test|check)\b/
// Maven test-skip is active only as a bare flag (`-DskipTests`) or a truthy
// value (`-DskipTests=true`); an explicit `=false` re-enables tests, so it must
// not be treated as skipping.
const MAVEN_TEST_SKIP = /(^|\s)-d(skiptests|maven\.test\.skip)(=true|(?=\s|$))/
const skipsTests = (text: string): boolean => GRADLE_TEST_SKIP.test(text) || MAVEN_TEST_SKIP.test(text)

// Always-opaque runners: they execute a configured matrix or several scripts we
// cannot enumerate (tox/nox run whatever envs are configured; npm-run-all/turbo/
// nx fan out to multiple targets), so any of lint/type-check/test/build may run.
const ALWAYS_OPAQUE_PATTERNS: RegExp[] = [
  /\btox\b/,
  /\bnox\b/,
  /\b(npm-run-all|run-s|run-p)\b/,
  /\bturbo\s+run\b/,
  /\bnx\b/,
]

// Recipe runners (`make`/`just`/…) and command wrappers (`uv run`/`poetry run`/
// …) dispatch a single target/command. They only make coverage uncertain when
// we could NOT already decompose that command: `make lint` and `uv run pytest`
// are recognized by RUN_PATTERNS and must not suppress unrelated kinds, while
// `make richtest` or `just ci` are opaque.
const RECIPE_OR_WRAPPER_PATTERNS: RegExp[] = [
  /\bmake\b/,
  /\b(just|task|mage|rake|invoke|mise)\b/,
  /\b(uv|poetry|pipenv|pdm|hatch|rye) run\b/,
]

// `pre-commit run` executes the hooks declared in `.pre-commit-config.yaml`,
// which are conventionally linters, formatters, and sometimes type-checkers —
// but not the test suite or a build. So a hook-running invocation only makes
// lint/type-check coverage uncertain; it must NOT suppress test/build not-run
// findings. Only `pre-commit run` runs hooks — `pre-commit install` /
// `autoupdate` / `clean` do not — so the match is scoped to `run`.
const PRECOMMIT_PATTERN = /\bpre-commit\s+run\b/
const PRECOMMIT_KINDS: CiCommandKind[] = ['lint', 'typecheck']

/**
 * Orchestrator coverage contributed by a `uses:` step, mirroring the `run:`
 * path. A `pre-commit/action` step runs the repo's pre-commit hooks just like
 * `run: pre-commit run`, so it makes lint/type-check coverage uncertain too —
 * without this, a workflow using the Action form would wrongly emit
 * `ci.typecheck.not-run` where the `run:` form would not.
 */
const usesOrchestratorCoverageFor = (uses: string): CiCommandKind[] => {
  const normalized = uses.trim().toLowerCase()
  return /^pre-commit\/action/.test(normalized) ? PRECOMMIT_KINDS : []
}

/**
 * The command kinds whose not-run check a `run:` step's orchestrator (if any)
 * makes uncertain, so the caller can scope suppression to exactly those kinds
 * rather than silencing every check. Each command invocation in the step is
 * judged independently: a runner only contributes uncertainty for the kinds it
 * could be hiding, never for a command we already recognized.
 */
const orchestratorCoverageFor = (run: string): CiCommandKind[] => {
  const coverage = new Set<CiCommandKind>()

  for (const segment of splitCommands(run)) {
    const text = segment.toLowerCase().trim()
    if (text.length === 0) {
      continue
    }

    // An install command merely installs tooling (e.g. `pip install tox`,
    // `npm install -g nx`); it does not execute the runner, so it must not be
    // treated as opaque orchestration that could be running other commands.
    if (RUN_PATTERNS.install.some(pattern => pattern.test(text))) {
      continue
    }

    if (PRECOMMIT_PATTERN.test(text)) {
      for (const kind of PRECOMMIT_KINDS) {
        coverage.add(kind)
      }
      continue
    }

    if (ALWAYS_OPAQUE_PATTERNS.some(pattern => pattern.test(text))) {
      for (const kind of ALL_COVERABLE_KINDS) {
        coverage.add(kind)
      }
      continue
    }

    // A recipe runner or command wrapper is only opaque when its wrapped command
    // was not already classified into a specific kind (e.g. `make lint` /
    // `uv run pytest` are decomposed and excluded; `make ci` is opaque).
    if (
      RECIPE_OR_WRAPPER_PATTERNS.some(pattern => pattern.test(text))
      && classifyRunCommandKinds(text).length === 0
    ) {
      for (const kind of ALL_COVERABLE_KINDS) {
        coverage.add(kind)
      }
    }
  }

  return sortKinds(coverage)
}

/**
 * The verification commands CI runs, as human-readable labels in canonical
 * order. Shared by the console and markdown reporters so the "CI coverage"
 * summary stays consistent.
 */
export const ciRunLabels = (ci: CiEvidence): string[] => {
  const labels: Array<[boolean, string]> = [
    [ci.hasInstall, 'install'],
    [ci.hasLint, 'lint'],
    [ci.hasTypeCheck, 'type-check'],
    [ci.hasTest, 'test'],
    [ci.hasBuild, 'build'],
  ]
  return labels.filter(([present]) => present).map(([, label]) => label)
}

/**
 * Classifies the command kinds exercised by a shell `run:` step. Each command
 * invocation in the step is judged independently so a tool name that only
 * appears as an *install argument* (e.g. `pip install pytest`,
 * `npm install -g eslint`) is recorded as `install`, not as having run the tool
 * — otherwise CI would falsely look like it runs tests/lint and suppress the
 * corresponding `ci.*.not-run` findings.
 */
export const classifyRunCommandKinds = (run: string): CiCommandKind[] => {
  const kinds = new Set<CiCommandKind>()

  for (const segment of splitCommands(run)) {
    const text = segment.toLowerCase().trim()
    if (text.length === 0) {
      continue
    }

    // A file utility that only reads/manipulates a script (e.g. `chmod +x
    // test.sh`) never runs it, so its script-path argument must not be counted.
    if (NON_EXECUTING_LEADERS.test(text)) {
      continue
    }

    // An install invocation only installs tooling; its package-name arguments
    // must not be read as having run lint/type-check/test/build.
    if (RUN_PATTERNS.install.some(pattern => pattern.test(text))) {
      kinds.add('install')
      continue
    }

    const segmentKinds = new Set<CiCommandKind>()
    for (const kind of COMMAND_KIND_ORDER) {
      if (RUN_PATTERNS[kind].some(pattern => pattern.test(text))) {
        segmentKinds.add(kind)
      }
    }

    // A JVM lifecycle command that explicitly skips tests (Gradle
    // `-x test`/`--exclude-task test`, Maven `-DskipTests`/`-Dmaven.test.skip`)
    // does not exercise the test suite, even though `gradle build`/`mvn package`
    // would normally run it. Drop the (lifecycle-derived) test coverage for that
    // invocation so a deliberately test-skipping build still allows
    // `ci.test.not-run` to surface.
    if (segmentKinds.has('test') && skipsTests(text)) {
      segmentKinds.delete('test')
    }

    // A .NET `--no-build` invocation (e.g. `dotnet test --no-build`, run after a
    // separate build step) skips compilation, so neither the build, the
    // build-time type-check, nor the build-time Roslyn analyzers (our lint
    // inference for dotnet build/test/publish) run. An explicit `dotnet format`
    // still lints. The `(?![-\w])` keeps this from matching Gradle's unrelated
    // `--no-build-cache` option.
    if (/--no-build(?![-\w])/.test(text)) {
      segmentKinds.delete('build')
      segmentKinds.delete('typecheck')
      if (!/\bdotnet format\b/.test(text)) {
        segmentKinds.delete('lint')
      }
    }

    for (const kind of segmentKinds) {
      kinds.add(kind)
    }
  }

  return sortKinds(kinds)
}

/** Classifies a `uses:` step against the known-action map. */
export const classifyUsesCommandKinds = (uses: string): CiCommandKind[] => {
  const normalized = uses.trim().toLowerCase()
  const kinds = new Set<CiCommandKind>()
  for (const { pattern, kind } of USES_KINDS) {
    if (pattern.test(normalized)) {
      kinds.add(kind)
    }
  }
  return sortKinds(kinds)
}

const sortKinds = (kinds: Iterable<CiCommandKind>): CiCommandKind[] => {
  const present = new Set(kinds)
  return COMMAND_KIND_ORDER.filter(kind => present.has(kind))
}

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

/**
 * Reads the `scripts` map from the repository's root `package.json`, tolerating a
 * missing or malformed manifest. CI steps frequently invoke verification work
 * indirectly (`npm test` → `xo && tsc --noEmit && ava`), so resolving these
 * aliases is what lets CI coverage detection see the underlying commands.
 */
const readPackageScripts = (root: string): Record<string, string> => {
  const text = readText(root, 'package.json')
  if (text === undefined) {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return {}
  }
  const scripts = (parsed as { scripts?: unknown }).scripts
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

// Captures the script a package-manager step invokes: `npm run <name>` (and the
// `pnpm`/`yarn`/`bun` equivalents) plus the `test`/`start` lifecycle shorthands.
// `npm install`/`npm ci` are intentionally not matched — they are not scripts.
const SCRIPT_RUN_REF = /\b(?:npm|pnpm|yarn|bun)\s+run\s+(?:-s\s+|--silent\s+)?([a-zA-Z0-9:._-]+)/g
const SCRIPT_LIFECYCLE_REF = /\b(?:npm|pnpm|yarn|bun)\s+(test|start)\b/g

/**
 * Appends the bodies of any package scripts a `run:` step invokes, recursively,
 * so the classifier sees the real commands behind `npm run <script>`/`npm test`.
 * A `seen` set bounds the recursion against cyclic or self-referential scripts.
 * Bodies are appended (not substituted) because the classifier splits on command
 * separators and unions the recognized kinds — it only needs the commands to be
 * present somewhere in the text.
 */
const expandScriptAliases = (run: string, scripts: Record<string, string>, seen: Set<string> = new Set()): string => {
  if (Object.keys(scripts).length === 0) {
    return run
  }

  const refs = new Set<string>()
  for (const match of run.matchAll(SCRIPT_RUN_REF)) {
    refs.add(match[1])
  }
  for (const match of run.matchAll(SCRIPT_LIFECYCLE_REF)) {
    refs.add(match[1])
  }

  let expanded = run
  for (const ref of refs) {
    if (seen.has(ref)) {
      continue
    }
    const body = scripts[ref]
    if (body === undefined) {
      continue
    }
    seen.add(ref)
    expanded += `\n${expandScriptAliases(body, scripts, seen)}`
  }
  return expanded
}

interface RawStep {
  name?: unknown
  uses?: unknown
  run?: unknown
  'working-directory'?: unknown
}

interface RawJob {
  steps?: unknown
  defaults?: unknown
}

interface RawWorkflow {
  name?: unknown
  jobs?: unknown
  defaults?: unknown
}

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

// Reads `defaults.run.working-directory` from a job or workflow node, tolerating
// any shape (only a string value is used).
const readDefaultWorkingDir = (node: { defaults?: unknown }): string | undefined => {
  const defaults = node.defaults
  if (typeof defaults !== 'object' || defaults === null) {
    return undefined
  }
  const run = (defaults as { run?: unknown }).run
  if (typeof run !== 'object' || run === null) {
    return undefined
  }
  return asString((run as Record<string, unknown>)['working-directory'])
}

// A step runs at the repository root only when no working directory is set (or it
// is `.`/`./`). `npm test`/`npm run <script>` aliases are resolved against the
// root `package.json`, so they may only be expanded for root-level steps —
// expanding root scripts for a step that runs in `packages/api` would attribute
// the wrong commands (and could wrongly suppress `ci.*.not-run`).
const isRootWorkingDir = (workingDir: string | undefined): boolean => {
  if (workingDir === undefined) {
    return true
  }
  const trimmed = workingDir.trim()
  return trimmed === '' || trimmed === '.' || trimmed === './'
}

const parseJob = (
  id: string,
  rawJob: unknown,
  scripts: Record<string, string>,
  workflowDefaultWorkingDir: string | undefined,
): { job: CiWorkflowJob; orchestratorKinds: Set<CiCommandKind> } => {
  const job = (rawJob ?? {}) as RawJob
  const steps = Array.isArray(job.steps) ? (job.steps as RawStep[]) : []
  const jobDefaultWorkingDir = readDefaultWorkingDir(job) ?? workflowDefaultWorkingDir
  const kinds = new Set<CiCommandKind>()
  const orchestratorKinds = new Set<CiCommandKind>()

  for (const step of steps) {
    const rawRun = asString(step?.run)
    if (rawRun) {
      // Resolve `npm run <script>` / `npm test` aliases to their bodies so the
      // verification commands they wrap are visible to the classifier — but only
      // for steps that run at the repository root, since the aliases are read
      // from the root `package.json`. Name-based classification still applies to
      // a step that runs elsewhere; only the root-script body expansion is gated.
      const workingDir = asString(step?.['working-directory']) ?? jobDefaultWorkingDir
      const run = isRootWorkingDir(workingDir) ? expandScriptAliases(rawRun, scripts) : rawRun
      for (const kind of classifyRunCommandKinds(run)) {
        kinds.add(kind)
      }
      for (const kind of orchestratorCoverageFor(run)) {
        orchestratorKinds.add(kind)
      }
    }
    const uses = asString(step?.uses)
    if (uses) {
      for (const kind of classifyUsesCommandKinds(uses)) {
        kinds.add(kind)
      }
      for (const kind of usesOrchestratorCoverageFor(uses)) {
        orchestratorKinds.add(kind)
      }
    }
  }

  return {
    job: { id, commandKinds: sortKinds(kinds), orchestratorKinds: sortKinds(orchestratorKinds) },
    orchestratorKinds,
  }
}

const parseWorkflow = (
  root: string,
  file: string,
  scripts: Record<string, string>,
): { workflow: CiWorkflow; orchestratorKinds: Set<CiCommandKind> } | undefined => {
  const text = readText(root, file)
  if (text === undefined) {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = parseYaml(text)
  } catch {
    // A malformed workflow degrades to "file present, no parsed jobs" rather
    // than crashing the scan; correctness is actionlint's job, not ours.
    return { workflow: { file, jobs: [] }, orchestratorKinds: new Set() }
  }

  const workflow = (parsed ?? {}) as RawWorkflow
  const workflowDefaultWorkingDir = readDefaultWorkingDir(workflow)
  const rawJobs = workflow.jobs
  const parsedJobs =
    rawJobs && typeof rawJobs === 'object' && !Array.isArray(rawJobs)
      ? Object.entries(rawJobs as Record<string, unknown>)
          .map(([id, rawJob]) => parseJob(id, rawJob, scripts, workflowDefaultWorkingDir))
          .sort((a, b) => a.job.id.localeCompare(b.job.id))
      : []

  const jobs = parsedJobs.map(parsed => parsed.job)
  const orchestratorKinds = new Set<CiCommandKind>()
  for (const parsed of parsedJobs) {
    for (const kind of parsed.orchestratorKinds) {
      orchestratorKinds.add(kind)
    }
  }

  const name = asString(workflow.name)
  const built: CiWorkflow = name === undefined ? { file, jobs } : { file, name, jobs }
  return { workflow: built, orchestratorKinds }
}

/**
 * Detects GitHub Actions workflow files and parses their steps to recognize the
 * verification commands (install/lint/type-check/test/build) CI actually runs,
 * so checks can flag commands that exist in the repo but are never exercised in
 * CI. Parsing is read-only; repository code is never executed.
 */
export const detectCiWorkflows = (root: string, filePaths: string[]): CiEvidence => {
  const workflowFiles = filePaths
    .filter(filePath => /^\.github\/workflows\/.+\.ya?ml$/i.test(filePath))
    .sort()

  const scripts = readPackageScripts(root)
  const parsed = workflowFiles
    .map(file => parseWorkflow(root, file, scripts))
    .filter((entry): entry is { workflow: CiWorkflow; orchestratorKinds: Set<CiCommandKind> } => entry !== undefined)

  const workflows = parsed.map(entry => entry.workflow)

  const allKinds = new Set<CiCommandKind>()
  const orchestratorKinds = new Set<CiCommandKind>()
  for (const entry of parsed) {
    for (const kind of entry.orchestratorKinds) {
      orchestratorKinds.add(kind)
    }
    for (const job of entry.workflow.jobs) {
      for (const kind of job.commandKinds) {
        allKinds.add(kind)
      }
    }
  }

  return {
    workflowFiles,
    workflows,
    hasInstall: allKinds.has('install'),
    hasLint: allKinds.has('lint'),
    hasTypeCheck: allKinds.has('typecheck'),
    hasTest: allKinds.has('test'),
    hasBuild: allKinds.has('build'),
    orchestratorKinds: sortKinds(orchestratorKinds),
  }
}
