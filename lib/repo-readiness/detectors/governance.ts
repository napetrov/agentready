import { execFileSync } from 'child_process'
import { closeSync, existsSync, lstatSync, openSync, readSync } from 'fs'
import path from 'path'
import ignore from 'ignore'
import type { GovernanceEvidence } from '../core/types'

// GitHub recognizes CODEOWNERS at .github/, the repo root, or docs/ (in that
// order -- .github/ first, not root), and honors exactly one of them when
// more than one exists. Kept as separate per-tier patterns (rather than one
// combined pattern) so `resolveByPrecedence` can pick the right tier
// regardless of `filePaths`' own sort order — `codeownersPath` now also
// feeds `detectCodeownersCoverageGaps` below, which reads and parses that
// specific file's patterns, so picking the wrong tier means checking
// coverage against a file GitHub itself would not actually use.
const CODEOWNERS_PATTERNS_BY_PRECEDENCE = [/^\.github\/CODEOWNERS$/i, /^CODEOWNERS$/i, /^docs\/CODEOWNERS$/i]
// A single pull-request-template file at root/.github/docs/, or any file
// inside a .github/PULL_REQUEST_TEMPLATE/ directory of multiple templates.
const PR_TEMPLATE_FILE_PATTERN = /^(?:\.github\/|docs\/)?PULL_REQUEST_TEMPLATE(\.[^./]+)?$/i
// GitHub also accepts a PULL_REQUEST_TEMPLATE/ directory (for multiple
// templates) directly at the repo root or under docs/, not just .github/.
const PR_TEMPLATE_DIR_PATTERN = /^(?:\.github\/|docs\/)?PULL_REQUEST_TEMPLATE\//i
// A plausible GitHub CODEOWNERS owner token: @user, @org/team, or an email —
// used to reject placeholder second tokens (e.g. "/src/ TODO") that aren't
// actually owners; see `detectCodeownersCoverageGaps` below.
const CODEOWNERS_OWNER_TOKEN_PATTERN = /^(@[\w.-]+(\/[\w.-]+)?|[^\s@]+@[^\s@]+)$/

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
// GitHub documents a 3 MiB CODEOWNERS size limit (rules past that point are
// simply not honored by GitHub itself, so a 3 MiB bound here matches what
// GitHub actually reads) -- unlike per-candidate instruction-file reads
// elsewhere in this package, this detector only ever reads one file, so
// there is no aggregate-memory reason to bound it tighter than that.
const MAX_CODEOWNERS_BYTES = 3 * 1024 * 1024
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
// root must never be followed and read in full. Reuses the same `lstatSync`
// call to also check size: GitHub does not load a CODEOWNERS file over its
// documented size limit *at all* (no partial parsing, no owners requested
// for anything), so an oversized file must not be read as a truncated
// prefix and have whatever rules happened to fit applied -- it returns ''
// (not `undefined`; the caller already treats an empty/comment-only file as
// "no effective rules", which is exactly GitHub's real behavior here too).
const readBounded = (absolutePath: string, maxBytes: number): string | undefined => {
  if (!existsSync(absolutePath)) return undefined
  let stats
  try {
    stats = lstatSync(absolutePath)
  } catch {
    return undefined
  }
  if (stats.isSymbolicLink()) return undefined
  if (stats.size > maxBytes) return ''
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
const GIT_LOG_TIMEOUT_MS = 10_000

const recentlyChangedFilesByCommit = (root: string): string[][] => {
  try {
    const output = execFileSync(
      'git',
      [
        'log', '--no-merges', '--relative', '--name-only',
        `--pretty=format:${COMMIT_DELIMITER}%H`,
        '-n', String(RECENT_COMMIT_LOOKBACK), '--', '.',
      ],
      // `-n` bounds the commit *count* returned, not how long git spends
      // walking history to find them (e.g. many merge commits to skip past
      // to reach `RECENT_COMMIT_LOOKBACK` non-merge ones, or a slow/network
      // filesystem) -- a timeout keeps this best-effort signal from blocking
      // the whole scan on a pathological repo; a timed-out child throws,
      // which the catch below already treats like "git unavailable".
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GIT_LOG_TIMEOUT_MS },
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
 * which a single bulk commit could produce on its own), counts as "covered"
 * once any file actually changed in it matches a CODEOWNERS pattern (reusing
 * the `ignore` package's gitignore-style matching against real file paths,
 * not a synthetic directory placeholder — a common pattern like `*.ts @team`
 * matches files, not bare directory names, so matching against `"src/"`
 * would wrongly call every such directory uncovered), and is reported only
 * if it still appears in `scannedFilePaths` (the same ignore-filtered
 * inventory every other detector sees) — git history alone can't tell a
 * directory the scan intentionally excludes (`ignorePaths`, `.gitignore`)
 * or one that has since been deleted from a directory genuinely still owned
 * by nobody. Runs only when a CODEOWNERS file exists — the common case has
 * nothing to check coverage against, so it never pays the `git log` cost.
 */
export const detectCodeownersCoverageGaps = (
  root: string,
  codeownersPath: string | undefined,
  scannedFilePaths: string[],
): string[] | undefined => {
  if (!codeownersPath) return undefined
  const codeownersText = readBounded(path.join(root, codeownersPath), MAX_CODEOWNERS_BYTES)
  if (codeownersText === undefined) return undefined

  // A CODEOWNERS file that exists but has no effective rules (blank,
  // comment-only, oversized -- see `readBounded` -- or entirely ownerless
  // lines) is not treated as "nothing to check": GitHub would request no
  // code owner for anything in that case, so this deliberately does *not*
  // early-return here. It instead falls through with an empty
  // `orderedPatterns` array (below), so every active directory correctly
  // surfaces as uncovered rather than the check being silently skipped --
  // which would otherwise be a worse blind spot than having no CODEOWNERS
  // at all, since `detectGovernance` already found this path and so
  // `docs.codeowners.missing` won't fire either.
  // GitHub's CODEOWNERS syntax supports inline (trailing) comments, not just
  // whole-line ones -- e.g. "*.js @js-owner # inline comment" is documented
  // syntax. Stripping from the first "#" handles both in one pass (a
  // whole-line comment strips to "", filtered out below); done before owner
  // parsing so an @mention inside explanatory comment text (e.g. "/apps/
  // github # intentionally unowned; parent is @octocat") is never
  // mistaken for a real owner token.
  const contentLines = codeownersText
    .split('\n')
    .map(line => line.split('#')[0].trim())
    .filter(line => line.length > 0)

  // A CODEOWNERS line is a pattern optionally followed by owner tokens.
  // GitHub applies these with "last matching pattern wins" -- including a
  // *later* pattern with no owner tokens at all deliberately un-assigning
  // ownership for a carved-out subtree (GitHub's own docs give exactly this
  // example: "/apps/ @octocat" then a bare "/apps/github" leaves that
  // subdirectory unowned). A single combined `ignore()` matcher can't
  // replicate this: gitignore negation (the natural tool for "override an
  // earlier pattern") cannot re-include a path whose parent directory an
  // earlier pattern already excluded, which breaks on exactly this common
  // directory-anchored case. So each valid pattern (still dropping any
  // starting with "!" -- GitHub's CODEOWNERS syntax, unlike .gitignore, does
  // not support "!" negation, so such a pattern never actually matches) gets
  // its own single-pattern matcher and an `hasOwner` flag, tested against a
  // file in file order below, with the *last* matching one deciding
  // coverage -- a direct, reliable implementation of "last match wins" that
  // doesn't depend on `ignore()`'s own override semantics.
  //
  // A pattern followed by a token that *looks* like an attempted owner but
  // isn't a real one (e.g. "/src/ TODO") is different from a bare pattern
  // with no tokens at all: GitHub treats it as invalid syntax and skips the
  // whole line, leaving whatever earlier pattern matched still in effect --
  // it is not a valid ownerless override. Only a pattern with zero tokens
  // after it is a real (intentional) ownerless override.
  //
  // GitHub also documents "[ ]" character ranges as unsupported CODEOWNERS
  // syntax (unlike .gitignore) and skips the whole line when it appears; the
  // underlying `ignore()` matcher *does* support character ranges, so a
  // pattern like "/src/[ab].ts" must be dropped here too, or a repo relying
  // on it would be reported as covered when GitHub itself requests no
  // review.
  const orderedPatterns = contentLines
    .map(line => line.split(/\s+/))
    .filter(tokens => !tokens[0].startsWith('!') && !/[[\]]/.test(tokens[0]))
    .filter(tokens => tokens.length === 1 || tokens.slice(1).some(token => CODEOWNERS_OWNER_TOKEN_PATTERN.test(token)))
    .map(tokens => ({
      matcher: ignore().add(tokens[0]),
      hasOwner: tokens.length > 1,
    }))

  const isFileCovered = (filePath: string): boolean => {
    let covered = false
    for (const { matcher, hasOwner } of orderedPatterns) {
      if (matcher.ignores(filePath)) covered = hasOwner
    }
    return covered
  }

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
    [...(filesByDirectory.get(directory) ?? [])].some(filePath => isFileCovered(filePath))

  const scannedDirectories = new Set(
    scannedFilePaths.map(topLevelDirectory).filter((directory): directory is string => directory !== undefined),
  )

  const uncoveredActiveDirectories = [...commitCountsByDirectory.entries()]
    .filter(
      ([directory, count]) => scannedDirectories.has(directory) && count >= MIN_DIRECTORY_COMMITS && !isCovered(directory),
    )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_REPORTED_DIRECTORIES)
    .map(([directory]) => directory)

  return uncoveredActiveDirectories.length > 0 ? uncoveredActiveDirectories : undefined
}
