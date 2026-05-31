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
    /\b(npm|pnpm|yarn) run lint\b/,
    /\bmake (lint|fmt|format)\b/,
  ],
  typecheck: [
    /\btsc\b(?!\s+(-b|--build))/,
    /\bmypy\b/,
    /\bpyright\b/,
    /\bcargo check\b/,
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

/** Classifies the command kinds exercised by a shell `run:` step. */
export const classifyRunCommandKinds = (run: string): CiCommandKind[] => {
  const text = run.toLowerCase()
  const kinds = new Set<CiCommandKind>()
  for (const kind of COMMAND_KIND_ORDER) {
    if (RUN_PATTERNS[kind].some(pattern => pattern.test(text))) {
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

const parseJob = (id: string, rawJob: unknown): CiWorkflowJob => {
  const job = (rawJob ?? {}) as RawJob
  const steps = Array.isArray(job.steps) ? (job.steps as RawStep[]) : []
  const kinds = new Set<CiCommandKind>()

  for (const step of steps) {
    const run = asString(step?.run)
    if (run) {
      for (const kind of classifyRunCommandKinds(run)) {
        kinds.add(kind)
      }
    }
    const uses = asString(step?.uses)
    if (uses) {
      for (const kind of classifyUsesCommandKinds(uses)) {
        kinds.add(kind)
      }
    }
  }

  return { id, commandKinds: sortKinds(kinds) }
}

const parseWorkflow = (root: string, file: string): CiWorkflow | undefined => {
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
    return { file, jobs: [] }
  }

  const workflow = (parsed ?? {}) as RawWorkflow
  const rawJobs = workflow.jobs
  const jobs: CiWorkflowJob[] =
    rawJobs && typeof rawJobs === 'object' && !Array.isArray(rawJobs)
      ? Object.entries(rawJobs as Record<string, unknown>)
          .map(([id, rawJob]) => parseJob(id, rawJob))
          .sort((a, b) => a.id.localeCompare(b.id))
      : []

  const name = asString(workflow.name)
  return name === undefined ? { file, jobs } : { file, name, jobs }
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

  const workflows = workflowFiles
    .map(file => parseWorkflow(root, file))
    .filter((workflow): workflow is CiWorkflow => workflow !== undefined)

  const allKinds = new Set<CiCommandKind>()
  for (const workflow of workflows) {
    for (const job of workflow.jobs) {
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
  }
}
