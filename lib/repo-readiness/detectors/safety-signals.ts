import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { SafetyCategory, SafetySignalEvidence } from '../core/types'

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
