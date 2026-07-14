import { execFileSync } from 'child_process'
import { closeSync, existsSync, lstatSync, openSync, readSync } from 'fs'
import path from 'path'
import ignore from 'ignore'
import type { GovernanceEvidence } from '../core/types'

// GitHub recognizes CODEOWNERS at the repo root, .github/, or docs/, and
// honors exactly one of them by that precedence order when more than one
// exists. Kept as separate per-tier patterns (rather than one combined
// pattern) so `resolveByPrecedence` can pick the root file over `.github/`
// over `docs/` regardless of `filePaths`' own sort order — `codeownersPath`
// now also feeds `detectCodeownersCoverageGaps` below, which reads and
// parses that specific file's patterns, so picking the wrong tier means
// checking coverage against a file GitHub itself would not actually use.
const CODEOWNERS_PATTERNS_BY_PRECEDENCE = [/^CODEOWNERS$/i, /^\.github\/CODEOWNERS$/i, /^docs\/CODEOWNERS$/i]
// A single pull-request-template file at root/.github/docs/, or any file
// inside a .github/PULL_REQUEST_TEMPLATE/ directory of multiple templates.
const PR_TEMPLATE_FILE_PATTERN = /^(?:\.github\/|docs\/)?PULL_REQUEST_TEMPLATE(\.[^./]+)?$/i
// GitHub also accepts a PULL_REQUEST_TEMPLATE/ directory (for multiple
// templates) directly at the repo root or under docs/, not just .github/.
const PR_TEMPLATE_DIR_PATTERN = /^(?:\.github\/|docs\/)?PULL_REQUEST_TEMPLATE\//i

const resolveByPrecedence = (filePaths: string[], patternsByPrecedence: RegExp[]): string | undefined => {
  for (const pattern of patternsByPrecedence) {
    const match = filePaths.find(filePath => pattern.test(filePath))
    if (match) return match
  }
  return undefined
}

/**
 * Detects review-routing surfaces: a CODEOWNERS file and a pull-request
 * template, at any path GitHub itself recognizes. Presence-only — this does
 * not infer actual ownership boundaries from git history or CODEOWNERS'
 * path rules; see `detectCodeownersCoverageGaps` below for the (separate,
 * opt-in-by-presence-of-CODEOWNERS) git-history-derived signal.
 */
export const detectGovernance = (filePaths: string[]): GovernanceEvidence => ({
  codeownersPath: resolveByPrecedence(filePaths, CODEOWNERS_PATTERNS_BY_PRECEDENCE),
  pullRequestTemplatePath: filePaths.find(
    filePath => PR_TEMPLATE_FILE_PATTERN.test(filePath) || PR_TEMPLATE_DIR_PATTERN.test(filePath),
  ),
})

const RECENT_COMMIT_LOOKBACK = 200
const MIN_DIRECTORY_COMMITS = 5
const MAX_REPORTED_DIRECTORIES = 10
const MAX_CODEOWNERS_BYTES = 200_000
// A control character that cannot appear in a commit hash or a file path,
// used to delimit commits in `git log` output so per-commit file lists can be
// grouped reliably (a blank-line heuristic breaks on the interaction between
// an empty `--pretty=format:` header and `--name-only`'s own blank separator).
const COMMIT_DELIMITER = '\x01'

const topLevelDirectory = (filePath: string): string | undefined => {
  const index = filePath.indexOf('/')
  return index === -1 ? undefined : filePath.slice(0, index)
}

// Same bounded, symlink-averse read as `instruction-contradictions.ts`'s
// `readText` — a CODEOWNERS path that is a symlink pointing outside the repo
// root must never be followed and read in full, and the read itself must
// never load more than `maxBytes` into memory before any truncation.
const readBounded = (absolutePath: string, maxBytes: number): string | undefined => {
  if (!existsSync(absolutePath)) return undefined
  try {
    if (lstatSync(absolutePath).isSymbolicLink()) return undefined
  } catch {
    return undefined
  }
  let fd: number | undefined
  try {
    fd = openSync(absolutePath, 'r')
    const buffer = Buffer.alloc(maxBytes)
    const bytesRead = readSync(fd, buffer, 0, maxBytes, 0)
    return buffer.toString('utf8', 0, bytesRead)
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

// `--relative` reports `--name-only` paths relative to `cwd` rather than the
// repo root, and `-- .` scopes both traversal and output to files under
// `cwd` — together these make the result correct even when `root` is a
// subdirectory of a larger git repository (e.g. one package in a monorepo,
// or a fixture directory nested inside this very repository's own history),
// not just when `root` is a repo's top level. Each returned array is the set
// of file paths touched by one commit — grouped, not flattened, so a
// bulk-rename/import commit that touches many files in one directory counts
// as the single commit it is, not one "hit" per file.
const recentlyChangedFilesByCommit = (root: string): string[][] => {
  try {
    const output = execFileSync(
      'git',
      [
        'log', '--no-merges', '--relative', '--name-only',
        `--pretty=format:${COMMIT_DELIMITER}%H`,
        '-n', String(RECENT_COMMIT_LOOKBACK), '--', '.',
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return output
      .split(COMMIT_DELIMITER)
      .slice(1) // the chunk before the first delimiter is empty
      .map(chunk => chunk.split('\n').slice(1).map(line => line.trim()).filter(Boolean)) // drop the hash line
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
 * semantics. A directory counts as "active" once `MIN_DIRECTORY_COMMITS`
 * distinct commits touch it (not `MIN_DIRECTORY_COMMITS` file-change lines,
 * which a single bulk commit could produce on its own), and counts as
 * "covered" once any file actually changed in it matches a CODEOWNERS
 * pattern (reusing the `ignore` package's gitignore-style matching against
 * real file paths, not a synthetic directory placeholder — a common pattern
 * like `*.ts @team` matches files, not bare directory names, so matching
 * against `"src/"` would wrongly call every such directory uncovered).
 * Runs only when a CODEOWNERS file exists — the common case has nothing to
 * check coverage against, so it never pays the `git log` cost.
 */
export const detectCodeownersCoverageGaps = (root: string, codeownersPath: string | undefined): string[] | undefined => {
  if (!codeownersPath) return undefined
  const codeownersText = readBounded(path.join(root, codeownersPath), MAX_CODEOWNERS_BYTES)
  if (codeownersText === undefined) return undefined

  const patterns = codeownersText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => line.split(/\s+/)[0])
  if (patterns.length === 0) return undefined

  const matcher = ignore().add(patterns)
  const commits = recentlyChangedFilesByCommit(root)
  if (commits.length === 0) return undefined

  const commitCountsByDirectory = new Map<string, number>()
  const filesByDirectory = new Map<string, Set<string>>()
  for (const filesInCommit of commits) {
    const directoriesInCommit = new Set<string>()
    for (const filePath of filesInCommit) {
      const directory = topLevelDirectory(filePath)
      if (!directory) continue
      directoriesInCommit.add(directory)
      if (!filesByDirectory.has(directory)) filesByDirectory.set(directory, new Set())
      filesByDirectory.get(directory)?.add(filePath)
    }
    for (const directory of directoriesInCommit) {
      commitCountsByDirectory.set(directory, (commitCountsByDirectory.get(directory) ?? 0) + 1)
    }
  }

  const isCovered = (directory: string): boolean =>
    [...(filesByDirectory.get(directory) ?? [])].some(filePath => matcher.ignores(filePath))

  const uncoveredActiveDirectories = [...commitCountsByDirectory.entries()]
    .filter(([directory, count]) => count >= MIN_DIRECTORY_COMMITS && !isCovered(directory))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_REPORTED_DIRECTORIES)
    .map(([directory]) => directory)

  return uncoveredActiveDirectories.length > 0 ? uncoveredActiveDirectories : undefined
}
