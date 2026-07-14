import { closeSync, existsSync, lstatSync, openSync, readSync } from 'fs'
import path from 'path'
import type { InstructionContradictionEvidence, PackageManager } from '../core/types'
import type { InstructionSurfaceEvidence } from '../instruction-surface-detector'

const MAX_DOCUMENT_BYTES_SCANNED = 200_000

// Same bounded, symlink-averse read as `command-references.ts`'s `readText` —
// duplicated locally rather than shared because every detector in this
// package owns its own I/O helper (see `capability-surfaces.ts`,
// `safety-signals.ts`, `command-references.ts`), so a stale reference to a
// shared helper's exact truncation/symlink behavior is never a cross-file
// surprise when one detector's needs change.
const readText = (root: string, repoPath: string): string | undefined => {
  const absolutePath = path.join(root, repoPath)
  if (!existsSync(absolutePath)) {
    return undefined
  }
  try {
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

// Deliberately the same unambiguous shapes `command-references.ts` checks
// against the lockfile (`<pm> install|ci`, `<pm> run <script>`, bare
// `<pm> test|start`) — a package-manager mention embedded in a longer command
// is exactly as trustworthy a signal here as it is there.
const PACKAGE_MANAGER_MENTION_PATTERN = /\b(npm|yarn|pnpm|bun)\s+(?:install\b|ci\b|run\s+[A-Za-z0-9_:.-]+|test\b|start\b)/g

const mentionedPackageManagers = (text: string): Set<PackageManager> => {
  const managers = new Set<PackageManager>()
  for (const match of text.matchAll(PACKAGE_MANAGER_MENTION_PATTERN)) {
    const manager = PACKAGE_MANAGER_BINARIES[match[1].toLowerCase()]
    if (manager) managers.add(manager)
  }
  return managers
}

/**
 * Finds structurally-detectable contradictions between root-scope,
 * always-active instruction files (`AGENTS.md`, `CLAUDE.md`,
 * `.github/copilot-instructions.md`, `GEMINI.md`, …) — the ones an agent
 * loads into context at the same time, so a conflict between them is
 * something an agent will actually hit. Currently checks one high-precision
 * signal: two files that each exclusively reference a *different* single
 * package manager. A file that mentions more than one package manager is
 * plausibly discussing multiple supported managers on purpose and is not
 * compared, to keep false positives low — this mirrors why
 * `commands.reference.package-manager-mismatch` stays a soft, informational
 * signal rather than an unambiguous one.
 */
export const detectInstructionContradictions = (
  root: string,
  instructions: InstructionSurfaceEvidence[],
): InstructionContradictionEvidence[] => {
  const candidates = instructions.filter(surface => surface.scope === 'root' && surface.activation === 'always')

  const singleManagerByPath = new Map<string, PackageManager>()
  for (const surface of candidates) {
    const text = readText(root, surface.path)
    if (text === undefined) continue
    const managers = mentionedPackageManagers(text)
    if (managers.size === 1) {
      singleManagerByPath.set(surface.path, [...managers][0])
    }
  }

  const paths = [...singleManagerByPath.keys()].sort()
  const evidence: InstructionContradictionEvidence[] = []
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      const pathA = paths[i]
      const pathB = paths[j]
      const managerA = singleManagerByPath.get(pathA)
      const managerB = singleManagerByPath.get(pathB)
      if (managerA && managerB && managerA !== managerB) {
        evidence.push({
          kind: 'package-manager',
          paths: [pathA, pathB],
          detail: `"${pathA}" references ${managerA}, but "${pathB}" references ${managerB}.`,
        })
      }
    }
  }

  return evidence
}
