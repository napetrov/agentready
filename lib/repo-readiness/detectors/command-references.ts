import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { CommandEvidence, CommandReferenceEvidence, PackageManager } from '../core/types'

const MAX_DOCUMENT_BYTES_SCANNED = 200_000

const readText = (root: string, repoPath: string): string | undefined => {
  const absolutePath = path.join(root, repoPath)
  if (!existsSync(absolutePath)) {
    return undefined
  }
  try {
    return readFileSync(absolutePath, 'utf8').slice(0, MAX_DOCUMENT_BYTES_SCANNED)
  } catch {
    return undefined
  }
}

const PACKAGE_MANAGER_BINARIES: Record<string, PackageManager> = { npm: 'npm', yarn: 'yarn', pnpm: 'pnpm', bun: 'bun' }

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
const MAKE_TARGET_PATTERN = /\bmake\s+([A-Za-z0-9_.-]+)/g

/**
 * Scans doc/instruction text for command references that do not match the
 * repository's detected command surfaces: an `npm run <script>` (or
 * yarn/pnpm/bun equivalent) whose script does not exist, a `make <target>`
 * whose target does not exist, or an explicit package-manager mention that
 * disagrees with the manager the repo's lockfile implies. Deterministic
 * text-pattern matching, not command execution.
 */
export const detectCommandReferences = (
  root: string,
  docPaths: string[],
  commands: CommandEvidence,
): CommandReferenceEvidence[] => {
  const evidence: CommandReferenceEvidence[] = []
  const isNode = commands.ecosystems.includes('node')
  const isMake = commands.ecosystems.includes('make')
  const scripts = new Set(commands.scripts)
  const makeTargets = new Set(commands.makeTargets)

  for (const docPath of [...new Set(docPaths)]) {
    const text = readText(root, docPath)
    if (text === undefined) continue

    if (isNode) {
      for (const match of text.matchAll(RUN_SCRIPT_PATTERN)) {
        const [reference, , script] = match
        if (!scripts.has(script)) {
          evidence.push({
            path: docPath,
            reference: reference.trim(),
            kind: 'npm-script',
            detail: `No "${script}" script in package.json.`,
          })
        }
      }
      for (const match of text.matchAll(BARE_SCRIPT_PATTERN)) {
        const [reference, , script] = match
        if (!scripts.has(script)) {
          evidence.push({
            path: docPath,
            reference: reference.trim(),
            kind: 'npm-script',
            detail: `No "${script}" script in package.json.`,
          })
        }
      }
    }

    if (isMake) {
      for (const match of text.matchAll(MAKE_TARGET_PATTERN)) {
        const [reference, target] = match
        if (!makeTargets.has(target.toLowerCase())) {
          evidence.push({
            path: docPath,
            reference: reference.trim(),
            kind: 'make-target',
            detail: `No "${target}" target in the Makefile.`,
          })
        }
      }
    }

    if (commands.packageManager) {
      for (const match of text.matchAll(INSTALL_PATTERN)) {
        const [reference, binary] = match
        const mentioned = PACKAGE_MANAGER_BINARIES[binary.toLowerCase()]
        if (mentioned && mentioned !== commands.packageManager) {
          evidence.push({
            path: docPath,
            reference: reference.trim(),
            kind: 'package-manager-mismatch',
            detail: `Repository lockfile indicates "${commands.packageManager}", not "${mentioned}".`,
          })
        }
      }
    }
  }

  return evidence.sort((a, b) => `${a.path}${a.reference}`.localeCompare(`${b.path}${b.reference}`))
}
