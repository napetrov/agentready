import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync } from 'fs'
import path from 'path'
import type { HookExecutionRiskEvidence, SafetyCategory, SafetySignalEvidence } from '../core/types'

// npm/yarn/pnpm lifecycle scripts that can run automatically during dependency
// installation or git-dependency preparation, so their commands execute without
// an explicit, reviewed invocation. Publish/pack-only hooks such as
// `prepublishOnly` are intentionally excluded from this install-hook class.
const installLifecycleScripts = new Set([
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepublish',
])

interface CommandPattern {
  category: SafetyCategory
  pattern: RegExp
  note: string
}

// Heuristic command patterns. These are intentionally conservative and
// high-signal; the checks layer decides severity. Detectors never execute
// anything they find.
const commandPatterns: CommandPattern[] = [
  {
    category: 'destructive',
    pattern: /\brm\s+-[a-z]*\s*(-[a-z]*\s+)*(\/|~|\$HOME|\*)/i,
    note: 'Recursively or forcibly removes files outside the build output.',
  },
  {
    category: 'destructive',
    pattern: /\brm\s+-(rf|fr|r\s+-f|f\s+-r)\b/i,
    note: 'Recursive force-remove can delete unintended paths.',
  },
  {
    category: 'destructive',
    pattern: /\bgit\s+clean\s+-[a-z]*f/i,
    note: 'git clean -f discards untracked files irreversibly.',
  },
  {
    category: 'destructive',
    pattern: /\b(mkfs|dd\s+if=|>\s*\/dev\/sd)/i,
    note: 'Low-level disk operation that can destroy data.',
  },
  {
    category: 'network-exec',
    pattern: /\b(curl|wget|fetch)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|node|python3?)\b/i,
    note: 'Pipes a downloaded script straight into a shell or interpreter.',
  },
  {
    category: 'deploy',
    pattern: /\b(npm|yarn|pnpm)\s+publish\b/i,
    note: 'Publishes a package to a registry.',
  },
  {
    category: 'deploy',
    pattern: /\b(vercel|netlify|wrangler|firebase)\s+deploy\b/i,
    note: 'Deploys to a hosting provider.',
  },
  {
    category: 'deploy',
    pattern: /\bgh\s+release\s+(create|upload)\b/i,
    note: 'Creates or uploads a GitHub release.',
  },
  {
    category: 'deploy',
    pattern: /\b(kubectl\s+apply|terraform\s+apply|aws\s+s3\s+(cp|sync|rm)|gcloud\s+\w+\s+deploy)\b/i,
    note: 'Mutates remote infrastructure or cloud storage.',
  },
]

const readPackageScripts = (root: string): Record<string, string> => {
  const packageJsonPath = path.join(root, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  } catch {
    // The command-surface detector already surfaces malformed package.json, so
    // here we just skip safety analysis rather than double-reporting.
    return {}
  }

  const scripts = (parsed as { scripts?: unknown } | null)?.scripts
  if (typeof scripts !== 'object' || scripts === null) {
    return {}
  }

  const result: Record<string, string> = {}
  for (const [name, command] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof command === 'string') {
      result[name] = command
    }
  }
  return result
}

/**
 * Detects safety-relevant signals in package scripts: install-time lifecycle
 * hooks that run code automatically, destructive shell commands, scripts that
 * pipe network downloads into a shell, and deploy/publish paths. This lets an
 * agent (and its reviewers) know which commands are unsafe to run blindly.
 *
 * `filePaths` is the ignore-aware scan inventory; when `package.json` has been
 * filtered out of it (e.g. a vendored subproject excluded via `ignorePaths`)
 * the detector reports nothing, so safety findings never come from a manifest
 * the rest of the pipeline is ignoring.
 */
export const detectSafetySignals = (root: string, filePaths: string[]): SafetySignalEvidence[] => {
  if (!filePaths.includes('package.json')) {
    return []
  }

  const scripts = readPackageScripts(root)
  const signals: SafetySignalEvidence[] = []

  for (const [name, command] of Object.entries(scripts)) {
    const source = `package.json#scripts.${name}`

    if (installLifecycleScripts.has(name)) {
      signals.push({
        category: 'install-hook',
        source,
        script: name,
        command,
        notes: [`The "${name}" lifecycle script runs automatically (e.g. on install), executing its command without an explicit invocation.`],
      })
    }

    // A single command can match several patterns in the same category (for
    // example two destructive `rm` patterns). Emit at most one signal per
    // category per script so findings stay one-to-one with a real risk.
    const seenCategories = new Set<SafetyCategory>()
    for (const { category, pattern, note } of commandPatterns) {
      if (seenCategories.has(category) || !pattern.test(command)) {
        continue
      }
      seenCategories.add(category)
      signals.push({ category, source, script: name, command, notes: [note] })
    }
  }

  return signals.sort((a, b) => (
    a.category.localeCompare(b.category) || a.source.localeCompare(b.source)
  ))
}

// Claude Code hook settings files -- the same two paths
// `detectCapabilitySurfaces` already recognizes as `hook`-kind capability
// surfaces (see `capability-surfaces.ts`'s `hookSettingsRiskTier`), read here
// independently rather than shared with that detector: every detector in this
// package owns its own I/O (see `command-references.ts`, `governance.ts`,
// `instruction-contradictions.ts`), and this check needs the hook *event
// name* and *command text*, not just whether the file configures some hook.
const HOOK_SETTINGS_PATHS = ['.claude/settings.json', '.claude/settings.local.json']

const MAX_HOOK_SETTINGS_BYTES = 1_000_000

// Same bounded, symlink-averse read as `command-references.ts`'s `readText`/
// `governance.ts`'s `readBounded` -- a settings file is untrusted repository
// content like any other, so an oversized or symlinked one must not be read
// into memory in full before the JSON.parse (which would itself throw on a
// truncated read, but only after paying for it). 1MB is generous headroom
// over any real Claude Code settings file while still bounding the worst
// case.
const readBoundedSettings = (absolutePath: string): string | undefined => {
  if (!existsSync(absolutePath)) return undefined
  try {
    if (lstatSync(absolutePath).isSymbolicLink()) return undefined
  } catch {
    return undefined
  }
  let fd: number | undefined
  try {
    fd = openSync(absolutePath, 'r')
    const buffer = Buffer.alloc(MAX_HOOK_SETTINGS_BYTES)
    const bytesRead = readSync(fd, buffer, 0, MAX_HOOK_SETTINGS_BYTES, 0)
    return buffer.toString('utf8', 0, bytesRead)
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

// Event names that fire without any explicit user action within the session
// -- session lifecycle events, not ones triggered by the user actively
// prompting or the agent actively calling a tool. `SessionStart` is the
// event that matters most here: it fires the moment a session begins on
// whatever branch is already checked out, before a user has done anything an
// agent-checked-out-untrusted-branch scenario would require them to review.
const AUTOMATIC_HOOK_EVENTS = new Set(['SessionStart', 'SessionEnd', 'PreCompact', 'Notification'])

// Deliberately scoped to the package-manager install/lifecycle-script vector
// (the same one `installLifecycleScripts` above targets for package.json
// scripts) rather than every command a hook might run -- that is the specific
// mechanism by which a hook can execute code the checked-out branch controls
// (preinstall/postinstall/prepare scripts), not a general "this hook runs
// some command" signal `safety.capability.high-risk` already covers. `install`
// applies to all four managers; `ci` is a real install command only for npm
// and pnpm (https://pnpm.io/cli/ci) -- `yarn ci`/`bun ci` are not recognized
// install forms and would instead run (or fail to find) a script literally
// named "ci", not install dependencies. Also matches npm/pnpm/bun's
// documented `i` alias for `install` (yarn has no such alias) -- a hook
// author is at least as likely to write the short form as the long one. Not
// exhaustive of every npm typo-tolerant install alias (`in`, `ins`, `inst`,
// ...); `i` is the one actually in common use.
const HOOK_INSTALL_COMMAND_PATTERN = /\b(?:npm|yarn|pnpm|bun)\s+install\b|\b(?:npm|pnpm)\s+ci\b|\b(?:npm|pnpm|bun)\s+i\b/i

// npm/yarn/pnpm/bun all document the same `--ignore-scripts` flag, and it
// does what the name says: it skips exactly the lifecycle scripts
// (preinstall/postinstall/prepare) that make this composite risk real. An
// install command that explicitly disables them is not the branch-controlled
// code-execution risk this detector exists to catch. Matches (and captures)
// every documented negation form -- `--no-ignore-scripts` (npm's standard
// `--no-<flag>` boolean negation), `--ignore-scripts=false`/`=0`, and the
// space-separated `--ignore-scripts false`/`0` -- so any of them correctly
// reads as "scripts are NOT ignored" (a real risk, not suppressed) rather
// than only trusting the bare/`=true` forms.
const IGNORE_SCRIPTS_FLAG_PATTERN = /--(no-)?ignore-scripts\b(?:[= ]+(true|false|1|0)\b)?/i

/**
 * Whether `command` explicitly disables install lifecycle scripts (skipping
 * preinstall/postinstall/prepare), given a `--ignore-scripts` flag in any of
 * its documented forms. An explicit value (`=false`, ` false`, `=0`, ` 0`)
 * always wins over a `--no-` prefix -- that combination isn't real npm usage,
 * but if it appears, trusting the explicit value is the safer read.
 */
const commandIgnoresLifecycleScripts = (command: string): boolean => {
  const match = command.match(IGNORE_SCRIPTS_FLAG_PATTERN)
  if (!match) return false
  const explicitValue = match[2]?.toLowerCase()
  if (explicitValue !== undefined) return explicitValue === 'true' || explicitValue === '1'
  return !match[1]
}

// A hook command is shell text, not a single invocation -- `npm install
// --ignore-scripts && pnpm install` chains two independent commands, and
// evaluating install-pattern/--ignore-scripts matching against the whole
// string would let the first (safe) install's flag be misread as covering
// the second (unsafe) one, or vice versa. Split on the standard sequential
// shell separators (&&, ||, ;, newline -- deliberately not `|`, which pipes
// data between commands rather than sequencing independent ones) and
// evaluate each segment on its own.
const COMMAND_CHAIN_SPLIT_PATTERN = /&&|\|\||;|\n/

const splitCommandChain = (command: string): string[] =>
  command.split(COMMAND_CHAIN_SPLIT_PATTERN).map(segment => segment.trim()).filter(segment => segment.length > 0)

interface HookCommandEntry {
  event: string
  command: string
}

// Claude Code hook settings shape each event key to an array of "matcher
// groups", each carrying its own nested `hooks: [{ type, command }, ...]`
// array. Best-effort and permissive about the exact nesting (falls back to
// treating the group itself as a command entry when there is no nested
// `hooks` array) rather than throwing on a shape this detector does not fully
// recognize -- a settings file this permissive reader cannot parse simply
// yields no entries, the same fail-open behavior `hookSettingsRiskTier` in
// `capability-surfaces.ts` uses for the same file.
const extractHookCommands = (hooksConfig: unknown): HookCommandEntry[] => {
  if (typeof hooksConfig !== 'object' || hooksConfig === null) return []
  const entries: HookCommandEntry[] = []
  for (const [event, groups] of Object.entries(hooksConfig as Record<string, unknown>)) {
    if (!Array.isArray(groups)) continue
    for (const group of groups) {
      if (typeof group !== 'object' || group === null) continue
      const nested = (group as { hooks?: unknown }).hooks
      const candidates = Array.isArray(nested) ? nested : [group]
      for (const candidate of candidates) {
        if (typeof candidate !== 'object' || candidate === null) continue
        const command = (candidate as { command?: unknown }).command
        if (typeof command === 'string') entries.push({ event, command })
      }
    }
  }
  return entries
}

/**
 * Detects the composite risk neither `safety.install-hook` (package-script
 * lifecycle hooks only) nor `safety.capability.high-risk` (presence of a
 * hook surface, not what it runs or when) reports on its own: an agent-tool
 * hook event that fires automatically, with no explicit user action, whose
 * command invokes a package-manager install/lifecycle command. `filePaths` is
 * the ignore-aware scan inventory, so a settings file excluded from the scan
 * reports nothing here either. Each shell-chained command segment (see
 * `splitCommandChain`) is evaluated independently, so `npm install
 * --ignore-scripts && pnpm install` still reports the second, unsuppressed
 * install. Deduplicated by (path, event, matched segment) -- two matcher
 * groups that happen to configure the identical command must not double-
 * count the same risk as two findings.
 */
export const detectHookExecutionRisks = (root: string, filePaths: string[]): HookExecutionRiskEvidence[] => {
  const evidence: HookExecutionRiskEvidence[] = []
  const seen = new Set<string>()

  for (const settingsPath of HOOK_SETTINGS_PATHS) {
    if (!filePaths.includes(settingsPath)) continue

    const settingsText = readBoundedSettings(path.join(root, settingsPath))
    if (settingsText === undefined) continue

    let settings: unknown
    try {
      settings = JSON.parse(settingsText)
    } catch {
      continue
    }

    const hooksConfig = (settings as { hooks?: unknown } | null)?.hooks
    for (const { event, command } of extractHookCommands(hooksConfig)) {
      if (!AUTOMATIC_HOOK_EVENTS.has(event)) continue
      for (const segment of splitCommandChain(command)) {
        if (!HOOK_INSTALL_COMMAND_PATTERN.test(segment)) continue
        if (commandIgnoresLifecycleScripts(segment)) continue
        const key = `${settingsPath} ${event} ${segment}`
        if (seen.has(key)) continue
        seen.add(key)
        evidence.push({ path: settingsPath, event, command: segment })
      }
    }
  }

  return evidence.sort((a, b) => (
    a.path.localeCompare(b.path) || a.event.localeCompare(b.event) || a.command.localeCompare(b.command)
  ))
}
