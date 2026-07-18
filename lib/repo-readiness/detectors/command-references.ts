import { closeSync, existsSync, lstatSync, openSync, readSync } from 'fs'
import path from 'path'
import type { CommandEvidence, CommandReferenceEvidence, PackageManager } from '../core/types'

const MAX_DOCUMENT_BYTES_SCANNED = 200_000

// Reads at most MAX_DOCUMENT_BYTES_SCANNED bytes at the I/O layer, rather than
// reading (and UTF-8 decoding) the whole file before truncating — a
// mislabeled huge file (e.g. a binary asset with a .md extension) should
// never force a full read into memory just to scan for command references.
const readText = (root: string, repoPath: string): string | undefined => {
  const absolutePath = path.join(root, repoPath)
  if (!existsSync(absolutePath)) {
    return undefined
  }
  try {
    // A root-scope symlinked doc (e.g. README.md symlinked to
    // packages/app/README.md — the file-inventory walker keeps these visible
    // by path, never dereferencing them) must not be read through: its
    // content would belong to a different, possibly package-scoped location,
    // but `repoPath` here is the symlink's own root-scope path, so any
    // commands it documents would be checked against the wrong command
    // surface. Same "classify by path, never read through" invariant the
    // file-inventory walker already applies to symlinks.
    if (lstatSync(absolutePath).isSymbolicLink()) {
      return undefined
    }
  } catch {
    return undefined
  }
  let fd: number | undefined
  try {
    fd = openSync(absolutePath, 'r')
    const buffer = Buffer.alloc(MAX_DOCUMENT_BYTES_SCANNED)
    const bytesRead = readSync(fd, buffer, 0, MAX_DOCUMENT_BYTES_SCANNED, 0)
    return buffer.toString('utf8', 0, bytesRead)
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

const PACKAGE_MANAGER_BINARIES: Record<string, PackageManager> = { npm: 'npm', yarn: 'yarn', pnpm: 'pnpm', bun: 'bun' }

// `commands.packageManager` defaults to `npm` for any repo with a bare
// package.json and no lockfile at all (see detectPackageManager in
// command-surfaces.ts) — a reasonable default for reporting, but not a real
// signal to contradict documented `pnpm install`/`yarn install` guidance
// against. Only gate the mismatch check on an actual lockfile.
const LOCKFILE_NAMES = new Set(['pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'package-lock.json'])

// Explicit `<pm> run <script>` is unambiguous: every supported package manager
// routes it straight to package.json scripts, so any target that is not a
// known script is a real mismatch. Bare `<pm> <verb>` forms (`npm build`,
// `yarn lint`, ...) are intentionally NOT checked here — they collide with
// each package manager's own built-in CLI verbs (install, add, remove, why,
// ...), so a bare-form reference cannot be reliably classified as "referring
// to a script" without much higher false-positive risk.
const RUN_SCRIPT_PATTERN = /\b(npm|yarn|pnpm|bun)\s+run\s+([A-Za-z0-9_:.-]+)/g
// `test`/`start` are the two bare subcommands every supported package manager
// special-cases to mean "run the like-named script", so they are safe to
// check without the "run" keyword.
const BARE_SCRIPT_PATTERN = /\b(npm|yarn|pnpm|bun)\s+(test|start)\b/g
const INSTALL_PATTERN = /\b(npm|yarn|pnpm|bun)\s+(install|ci)\b/g
// Includes `/`: a path-like target (`docs/html`) is valid make syntax, and
// the command-surface Makefile parser (`makeTargetPattern` in
// command-surfaces.ts) already preserves slash-containing target names, so
// this capture must match the same shape or every such target looks missing.
const MAKE_TARGET_PATTERN = /\bmake\s+([A-Za-z0-9_./-]+)/g
// `npm run dev --workspace packages/app` (or `-w`/`--workspaces`) routes to a
// workspace package's own scripts, not the root package.json this detector
// checks against — a script that only exists in that workspace is a false
// positive, not a stale reference. Only the same line is checked: the flag
// qualifies the command it appears on, not the whole document.
const WORKSPACE_FLAG_PATTERN = /(?:^|\s)(?:-w|--workspaces|--workspace)\b/

const isWorkspaceQualified = (text: string, matchIndex: number, matchLength: number): boolean => {
  const lineStart = text.lastIndexOf('\n', matchIndex) + 1
  const lineEndIndex = text.indexOf('\n', matchIndex + matchLength)
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex
  return WORKSPACE_FLAG_PATTERN.test(text.slice(lineStart, lineEnd))
}

// Bare `<pm> <verb>` (no "run") is intentionally NOT checked by
// `RUN_SCRIPT_PATTERN`/`BARE_SCRIPT_PATTERN` above for any verb but
// test/start, because every package manager also has its own built-in CLI
// verbs (`npm audit`, `pnpm add`, `yarn why`, ...) that a naive rule would
// misreport as a missing script. `findMissingShortcuts` below narrows this
// two different ways instead of guessing: (1) a curated, per-manager
// allowlist of real CLI verbs, so a genuine built-in is never flagged, and
// (2) the match must sit inside a Markdown code span (inline `` `...` `` or a
// fenced ``` block) — a real "run this" instruction is almost always shown as
// code, while prose that merely mentions "npm packages" or "the pnpm
// ecosystem" is not. Together these keep the same "unambiguous only"
// guarantee the existing checks make, without a separate confidence tier.
const PACKAGE_MANAGER_BUILTIN_VERBS: Record<PackageManager, ReadonlySet<string>> = {
  npm: new Set([
    'access', 'adduser', 'audit', 'bugs', 'cache', 'ci', 'completion', 'config', 'dedupe', 'deprecate',
    'diff', 'dist-tag', 'docs', 'doctor', 'edit', 'exec', 'explain', 'explore', 'find-dupes', 'fund',
    'help', 'hook', 'init', 'install', 'install-ci-test', 'install-test', 'link', 'll', 'login', 'logout',
    'ls', 'org', 'outdated', 'owner', 'pack', 'ping', 'pkg', 'prefix', 'profile', 'prune', 'publish',
    'query', 'rebuild', 'repo', 'restart', 'root', 'run', 'run-script', 'sbom', 'search', 'set',
    'set-script', 'shrinkwrap', 'star', 'stars', 'star', 'stop', 'team', 'token', 'uninstall', 'unpublish',
    'unstar', 'update', 'version', 'view', 'whoami',
  ]),
  yarn: new Set([
    'add', 'audit', 'autoclean', 'bin', 'cache', 'check', 'config', 'create', 'dedupe', 'dlx', 'exec',
    'explain', 'generate-lock-entry', 'global', 'help', 'import', 'info', 'init', 'install', 'licenses',
    'link', 'list', 'login', 'logout', 'node', 'outdated', 'pack', 'patch', 'patch-commit', 'plugin',
    'policies', 'publish', 'rebuild', 'remove', 'run', 'set', 'tag', 'team', 'unlink', 'unplug', 'up',
    'upgrade', 'upgrade-interactive', 'version', 'versions', 'why', 'workspace', 'workspaces',
  ]),
  pnpm: new Set([
    'add', 'audit', 'bin', 'create', 'dedupe', 'deploy', 'doctor', 'env', 'exec', 'fetch', 'import',
    'init', 'install', 'licenses', 'link', 'list', 'ls', 'outdated', 'pack', 'patch', 'patch-commit',
    'patch-remove', 'prune', 'publish', 'rebuild', 'remove', 'root', 'run', 'self-update', 'server',
    'setup', 'store', 'unlink', 'update', 'why', 'dlx', 'x',
  ]),
  bun: new Set([
    'add', 'audit', 'bin', 'build', 'create', 'exec', 'info', 'init', 'install', 'link', 'outdated', 'pm',
    'publish', 'remove', 'run', 'uninstall', 'unlink', 'update', 'upgrade', 'x',
  ]),
}

// A word already excluded by (or handled equivalently to) another function
// above -- `run` (RUN_SCRIPT_PATTERN), `test`/`start` (BARE_SCRIPT_PATTERN),
// `install`/`ci` (INSTALL_PATTERN, findPackageManagerMismatches) -- must not
// also be considered here, or the same reference could be double-reported
// under two different `kind`s.
const SHORTCUT_EXCLUDED_VERBS = new Set(['run', 'test', 'start', 'install', 'ci'])
const SHORTCUT_VERB_PATTERN = /\b(npm|yarn|pnpm|bun)\s+([A-Za-z][A-Za-z0-9:_-]*)/g

const CODE_SPAN_PATTERNS = [/```[\s\S]*?```/g, /~~~[\s\S]*?~~~/g, /`[^`\n]+`/g]

/** Byte ranges of Markdown code spans (fenced ``` /~~~ blocks and inline `` ` `` spans) in `text`. */
const codeSpanRanges = (text: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = []
  for (const pattern of CODE_SPAN_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue
      ranges.push([match.index, match.index + match[0].length])
    }
  }
  return ranges
}

const isWithinCodeSpan = (ranges: Array<[number, number]>, matchIndex: number, matchLength: number): boolean =>
  ranges.some(([start, end]) => matchIndex >= start && matchIndex + matchLength <= end)

const findMissingShortcuts = (text: string, docPath: string, scripts: Set<string>): CommandReferenceEvidence[] => {
  const evidence: CommandReferenceEvidence[] = []
  const codeRanges = codeSpanRanges(text)
  for (const match of text.matchAll(SHORTCUT_VERB_PATTERN)) {
    const [reference, binary, verb] = match
    const manager = PACKAGE_MANAGER_BINARIES[binary.toLowerCase()]
    if (!manager || match.index === undefined) continue
    const lowerVerb = verb.toLowerCase()
    if (SHORTCUT_EXCLUDED_VERBS.has(lowerVerb)) continue
    if (PACKAGE_MANAGER_BUILTIN_VERBS[manager].has(lowerVerb)) continue
    if (!isWithinCodeSpan(codeRanges, match.index, reference.length)) continue
    if (isWorkspaceQualified(text, match.index, reference.length)) continue

    // npm, unlike yarn/pnpm/bun, has no general "run any script by name
    // without `run`" fallback -- only test/start/stop/restart are npm's own
    // built-in commands that happen to run the like-named script (already
    // excluded above via SHORTCUT_EXCLUDED_VERBS/PACKAGE_MANAGER_BUILTIN_VERBS).
    // Any other bare `npm <word>` errors with "Unknown command" even when a
    // matching script exists in package.json -- npm just suggests `npm run
    // <word>` instead of running it. So for npm this is flagged regardless of
    // `scripts.has(verb)`; for yarn/pnpm/bun (which do fall back to running
    // an arbitrary matching script), an existing script means it resolves
    // fine.
    if (manager !== 'npm' && scripts.has(verb)) continue

    evidence.push({
      path: docPath,
      reference: reference.trim(),
      kind: 'shortcut-script',
      detail: manager === 'npm'
        ? `npm has no bare-script shortcut for "${verb}" (only test/start/stop/restart run this way) -- use "npm run ${verb}" instead.`
        : `"${manager} ${verb}" is not a "${manager}" built-in command and no "${verb}" script exists in package.json.`,
    })
  }
  return evidence
}

const missingScript = (docPath: string, reference: string, script: string): CommandReferenceEvidence => ({
  path: docPath,
  reference: reference.trim(),
  kind: 'npm-script',
  detail: `No "${script}" script in package.json.`,
})

const findMissingScripts = (text: string, docPath: string, scripts: Set<string>, filePaths: string[]): CommandReferenceEvidence[] => {
  const evidence: CommandReferenceEvidence[] = []
  for (const match of text.matchAll(RUN_SCRIPT_PATTERN)) {
    const [reference, , script] = match
    if (scripts.has(script)) continue
    if (isWorkspaceQualified(text, match.index ?? 0, reference.length)) continue
    evidence.push(missingScript(docPath, reference, script))
  }
  for (const match of text.matchAll(BARE_SCRIPT_PATTERN)) {
    const [reference, binary, script] = match
    if (scripts.has(script)) continue
    // Two documented, tool-native fallbacks that need no package script:
    // Bun's test runner discovers test files on its own, and npm's own
    // `start` falls back to `node server.js` when no "start" script exists
    // but a root server.js does.
    if (binary === 'bun' && script === 'test') continue
    if (binary === 'npm' && script === 'start' && filePaths.includes('server.js')) continue
    if (isWorkspaceQualified(text, match.index ?? 0, reference.length)) continue
    evidence.push(missingScript(docPath, reference, script))
  }
  return evidence
}

const findMissingMakeTargets = (text: string, docPath: string, makeTargets: Set<string>): CommandReferenceEvidence[] => {
  const evidence: CommandReferenceEvidence[] = []
  for (const match of text.matchAll(MAKE_TARGET_PATTERN)) {
    const [reference, target] = match
    // A hyphen-led capture is a make option (-j, -C, --always-make, ...), not
    // a target — e.g. `make -j test` or `make -C subdir test`. Skip rather
    // than misreport the flag as a missing target; correctly finding the real
    // target after option/argument tokens (some flags, like -C, take a
    // following argument that isn't a target either) needs real argument
    // parsing this heuristic doesn't attempt.
    if (target.startsWith('-')) continue
    // A variable override (`make PREFIX=/usr/local install`, `make CFLAGS=-O2
    // test`) is not a target either — GNU make treats any argument containing
    // `=` as a variable assignment. The capture group's character class
    // already stops before `=` (it isn't a member), so this is detected by
    // checking the character immediately following the match; same
    // abstain-rather-than-misreport treatment as the flag case above.
    if (text[(match.index ?? 0) + reference.length] === '=') continue
    if (!makeTargets.has(target.toLowerCase())) {
      evidence.push({
        path: docPath,
        reference: reference.trim(),
        kind: 'make-target',
        detail: `No "${target}" target in the Makefile.`,
      })
    }
  }
  return evidence
}

const findPackageManagerMismatches = (text: string, docPath: string, packageManager: PackageManager): CommandReferenceEvidence[] => {
  const evidence: CommandReferenceEvidence[] = []
  for (const match of text.matchAll(INSTALL_PATTERN)) {
    const [reference, binary] = match
    const mentioned = PACKAGE_MANAGER_BINARIES[binary.toLowerCase()]
    if (mentioned && mentioned !== packageManager) {
      evidence.push({
        path: docPath,
        reference: reference.trim(),
        kind: 'package-manager-mismatch',
        detail: `Repository lockfile indicates "${packageManager}", not "${mentioned}".`,
      })
    }
  }
  return evidence
}

/**
 * Scans doc/instruction text for command references that do not match the
 * repository's detected command surfaces: an `npm run <script>` (or
 * yarn/pnpm/bun equivalent) whose script does not exist, a `make <target>`
 * whose target does not exist, or an explicit package-manager mention that
 * disagrees with the manager an actual lockfile implies. Deterministic
 * text-pattern matching, not command execution. `docPaths` should be
 * root-level docs only — `commands` only carries root command surfaces
 * (root package.json/Makefile), so checking a nested/package-scoped doc
 * against it would misattribute that package's own valid commands as stale.
 */
export const detectCommandReferences = (
  root: string,
  docPaths: string[],
  commands: CommandEvidence,
  filePaths: string[],
): CommandReferenceEvidence[] => {
  const isNode = commands.ecosystems.includes('node')
  const isMake = commands.ecosystems.includes('make')
  const scripts = new Set(commands.scripts)
  const makeTargets = new Set(commands.makeTargets)
  const hasLockfile = filePaths.some(filePath => LOCKFILE_NAMES.has(filePath))

  const evidence: CommandReferenceEvidence[] = []
  for (const docPath of [...new Set(docPaths)]) {
    const text = readText(root, docPath)
    if (text === undefined) continue

    if (isNode) evidence.push(...findMissingScripts(text, docPath, scripts, filePaths))
    if (isNode) evidence.push(...findMissingShortcuts(text, docPath, scripts))
    if (isMake) evidence.push(...findMissingMakeTargets(text, docPath, makeTargets))
    if (commands.packageManager && hasLockfile) {
      evidence.push(...findPackageManagerMismatches(text, docPath, commands.packageManager))
    }
  }

  // The same stale reference can legitimately appear more than once in one
  // document's prose (e.g. mentioned in both a "CI" and a "locally" note);
  // collapse those into a single finding instead of inflating the count.
  const deduped = [...new Map(evidence.map(item => [`${item.path}|${item.kind}|${item.reference}`, item])).values()]

  return deduped.sort((a, b) => `${a.path}${a.reference}`.localeCompare(`${b.path}${b.reference}`))
}
