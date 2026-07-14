import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import ignore from 'ignore'
import type { GovernanceEvidence } from '../core/types'

// GitHub recognizes CODEOWNERS at the repo root, .github/, or docs/ (in that
// precedence order, though we only need "does one exist" here).
const CODEOWNERS_PATTERN = /^(?:\.github\/|docs\/)?CODEOWNERS$/i
// A single pull-request-template file at root/.github/docs/, or any file
// inside a .github/PULL_REQUEST_TEMPLATE/ directory of multiple templates.
const PR_TEMPLATE_FILE_PATTERN = /^(?:\.github\/|docs\/)?PULL_REQUEST_TEMPLATE(\.[^./]+)?$/i
// GitHub also accepts a PULL_REQUEST_TEMPLATE/ directory (for multiple
// templates) directly at the repo root or under docs/, not just .github/.
const PR_TEMPLATE_DIR_PATTERN = /^(?:\.github\/|docs\/)?PULL_REQUEST_TEMPLATE\//i

/**
 * Detects review-routing surfaces: a CODEOWNERS file and a pull-request
 * template, at any path GitHub itself recognizes. Presence-only — this does
 * not infer actual ownership boundaries from git history or CODEOWNERS'
 * path rules; see `detectCodeownersCoverageGaps` below for the (separate,
 * opt-in-by-presence-of-CODEOWNERS) git-history-derived signal.
 */
export const detectGovernance = (filePaths: string[]): GovernanceEvidence => ({
  codeownersPath: filePaths.find(filePath => CODEOWNERS_PATTERN.test(filePath)),
  pullRequestTemplatePath: filePaths.find(
    filePath => PR_TEMPLATE_FILE_PATTERN.test(filePath) || PR_TEMPLATE_DIR_PATTERN.test(filePath),
  ),
})

const RECENT_COMMIT_LOOKBACK = 200
const MIN_DIRECTORY_COMMITS = 5
const MAX_REPORTED_DIRECTORIES = 10
const MAX_CODEOWNERS_BYTES = 200_000

const topLevelDirectory = (filePath: string): string | undefined => {
  const index = filePath.indexOf('/')
  return index === -1 ? undefined : filePath.slice(0, index)
}

// `--relative` reports `--name-only` paths relative to `cwd` rather than the
// repo root, and `-- .` scopes both traversal and output to files under
// `cwd` — together these make the result correct even when `root` is a
// subdirectory of a larger git repository (e.g. one package in a monorepo,
// or a fixture directory nested inside this very repository's own history),
// not just when `root` is a repo's top level.
const recentlyChangedFiles = (root: string): string[] => {
  try {
    const output = execFileSync(
      'git',
      ['log', '--no-merges', '--relative', '--name-only', '--pretty=format:', '-n', String(RECENT_COMMIT_LOOKBACK), '--', '.'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return output.split('\n').map(line => line.trim()).filter(Boolean)
  } catch {
    // Not a git repository, git is unavailable, or history is empty/shallow —
    // this signal is best-effort and silently absent rather than a scan error.
    return []
  }
}

/**
 * Compares CODEOWNERS' path patterns against which top-level directories
 * actually see sustained recent commit activity, using local git history
 * only (bounded to the most recent `RECENT_COMMIT_LOOKBACK` commits touching
 * `root` — no network calls, no repository script execution). Presence-only
 * CODEOWNERS detection cannot tell whether its patterns actually cover where
 * changes happen; this closes that gap for the common case (top-level
 * directory ownership) without attempting full CODEOWNERS path-rule
 * semantics (reusing the `ignore` package's gitignore-style matching, which
 * CODEOWNERS patterns are documented to follow, as a close approximation).
 * Runs only when a CODEOWNERS file exists — the common case has nothing to
 * check coverage against, so it never pays the `git log` cost.
 */
export const detectCodeownersCoverageGaps = (root: string, codeownersPath: string | undefined): string[] | undefined => {
  if (!codeownersPath) return undefined
  const absoluteCodeownersPath = path.join(root, codeownersPath)
  if (!existsSync(absoluteCodeownersPath)) return undefined

  let codeownersText: string
  try {
    codeownersText = readFileSync(absoluteCodeownersPath, 'utf8').slice(0, MAX_CODEOWNERS_BYTES)
  } catch {
    return undefined
  }

  const patterns = codeownersText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => line.split(/\s+/)[0])
  if (patterns.length === 0) return undefined

  const matcher = ignore().add(patterns)
  const changedFiles = recentlyChangedFiles(root)
  if (changedFiles.length === 0) return undefined

  const commitCountsByDirectory = new Map<string, number>()
  for (const filePath of changedFiles) {
    const directory = topLevelDirectory(filePath)
    if (!directory) continue
    commitCountsByDirectory.set(directory, (commitCountsByDirectory.get(directory) ?? 0) + 1)
  }

  const uncoveredActiveDirectories = [...commitCountsByDirectory.entries()]
    .filter(([directory, count]) => count >= MIN_DIRECTORY_COMMITS && !matcher.ignores(`${directory}/`))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_REPORTED_DIRECTORIES)
    .map(([directory]) => directory)

  return uncoveredActiveDirectories.length > 0 ? uncoveredActiveDirectories : undefined
}
