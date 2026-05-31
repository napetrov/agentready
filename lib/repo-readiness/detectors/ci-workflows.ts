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
  ],
  lint: [
    /\beslint\b/,
    /\b(prettier|biome)\b/,
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
  ],
  typecheck: [
    /\btsc\b(?!\s+(-b|--build))/,
    /\bmypy\b/,
    /\bpyright\b/,
    // The Go and Rust compilers type-check as part of build/test (and `cargo
    // check`), which is why the command-surface detector treats those toolchains
    // as exposing a type-check surface. Recognize the same commands here so a
    // normal `go test`/`cargo test` CI step is not falsely flagged as missing
    // type-check coverage.
    /\bcargo (check|build|test)\b/,
    /\bgo (build|test)\b/,
    /\b(npm|pnpm|yarn) run (type-check|typecheck|check:types)\b/,
    /\bmake (type-check|typecheck|types)\b/,
  ],
  test: [
    /\bpytest\b/,
    /\bjest\b/,
    /\bvitest\b/,
    /\bmocha\b/,
    /\btox\b/,
    /\bgo test\b/,
    /\bcargo test\b/,
    /\b(npm|pnpm|yarn) (run )?test\b/,
    /\bmake test\b/,
  ],
  build: [
    /\bgo build\b/,
    /\bcargo build\b/,
    /\bdocker build\b/,
    /\btsc\s+(-b|--build)\b/,
    /\b(npm|pnpm|yarn) run build\b/,
    /\bmake build\b/,
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
const COMMAND_SEPARATORS = /&&|\|\||[;\n|]/

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

// `pre-commit` runs the hooks declared in `.pre-commit-config.yaml`, which are
// conventionally linters, formatters, and sometimes type-checkers — but not the
// test suite or a build. So its presence only makes lint/type-check coverage
// uncertain; it must NOT suppress test/build not-run findings.
const PRECOMMIT_PATTERN = /\bpre-commit\b/
const PRECOMMIT_KINDS: CiCommandKind[] = ['lint', 'typecheck']

/**
 * The command kinds whose not-run check a `run:` step's orchestrator (if any)
 * makes uncertain, so the caller can scope suppression to exactly those kinds
 * rather than silencing every check. Each command invocation in the step is
 * judged independently: a runner only contributes uncertainty for the kinds it
 * could be hiding, never for a command we already recognized.
 */
const orchestratorCoverageFor = (run: string): CiCommandKind[] => {
  const coverage = new Set<CiCommandKind>()

  for (const segment of run.split(COMMAND_SEPARATORS)) {
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

  for (const segment of run.split(COMMAND_SEPARATORS)) {
    const text = segment.toLowerCase().trim()
    if (text.length === 0) {
      continue
    }

    // An install invocation only installs tooling; its package-name arguments
    // must not be read as having run lint/type-check/test/build.
    if (RUN_PATTERNS.install.some(pattern => pattern.test(text))) {
      kinds.add('install')
      continue
    }

    for (const kind of COMMAND_KIND_ORDER) {
      if (RUN_PATTERNS[kind].some(pattern => pattern.test(text))) {
        kinds.add(kind)
      }
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

interface RawStep {
  name?: unknown
  uses?: unknown
  run?: unknown
}

interface RawJob {
  steps?: unknown
}

interface RawWorkflow {
  name?: unknown
  jobs?: unknown
}

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const parseJob = (id: string, rawJob: unknown): { job: CiWorkflowJob; orchestratorKinds: Set<CiCommandKind> } => {
  const job = (rawJob ?? {}) as RawJob
  const steps = Array.isArray(job.steps) ? (job.steps as RawStep[]) : []
  const kinds = new Set<CiCommandKind>()
  const orchestratorKinds = new Set<CiCommandKind>()

  for (const step of steps) {
    const run = asString(step?.run)
    if (run) {
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
    }
  }

  return { job: { id, commandKinds: sortKinds(kinds) }, orchestratorKinds }
}

const parseWorkflow = (
  root: string,
  file: string,
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
  const rawJobs = workflow.jobs
  const parsedJobs =
    rawJobs && typeof rawJobs === 'object' && !Array.isArray(rawJobs)
      ? Object.entries(rawJobs as Record<string, unknown>)
          .map(([id, rawJob]) => parseJob(id, rawJob))
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

  const parsed = workflowFiles
    .map(file => parseWorkflow(root, file))
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
