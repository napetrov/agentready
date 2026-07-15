import { closeSync, existsSync, lstatSync, openSync, readSync } from 'fs'
import path from 'path'
import type { InstructionContradictionEvidence, PackageManager } from '../core/types'
import type { InstructionEcosystem, InstructionSurfaceEvidence } from '../instruction-surface-detector'

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

// A mention like "Never run npm install" is a *prohibition*, not the file
// choosing npm — counting it the same as "Use npm install" would flag two
// files as disagreeing when they may both actually prefer the same manager
// (one just also warns off another). Checked against the current clause only
// (back to the nearest sentence/clause boundary, not a fixed character
// count) — a fixed-width lookback would misfire on "Don't run npm install;
// use pnpm install instead.", where a wide-enough window reaches back across
// the ";" and wrongly suppresses the real "use pnpm" endorsement too.
const CLAUSE_BOUNDARY_PATTERN = /[.;,!?\n]/g
const NEGATION_CUE_PATTERN = /\b(never|don'?t|doesn'?t|not|avoid|shouldn'?t|won'?t|stop\s+using|no\s+longer)\b/i

const clauseStartBefore = (text: string, index: number): number => {
  let start = 0
  for (const boundary of text.slice(0, index).matchAll(CLAUSE_BOUNDARY_PATTERN)) {
    if (boundary.index !== undefined) start = boundary.index + 1
  }
  return start
}

const mentionedPackageManagers = (text: string): Set<PackageManager> => {
  const managers = new Set<PackageManager>()
  for (const match of text.matchAll(PACKAGE_MANAGER_MENTION_PATTERN)) {
    const manager = PACKAGE_MANAGER_BINARIES[match[1].toLowerCase()]
    if (!manager || match.index === undefined) continue
    const precedingContext = text.slice(clauseStartBefore(text, match.index), match.index)
    if (NEGATION_CUE_PATTERN.test(precedingContext)) continue
    managers.add(manager)
  }
  return managers
}

/**
 * Finds structurally-detectable contradictions between unconditionally-loaded
 * instruction files (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`,
 * `GEMINI.md`, legacy always-on rule files like `.cursorrules`, …) — the ones
 * an agent loads into context at the same time, so a conflict between them is
 * something an agent will actually hit. "At the same time" means
 * `activation === 'always'` at whole-repo scope (`root` for current entrypoints,
 * `legacy` for superseded-but-still-honored ones like `.cursorrules`/
 * `.windsurfrules`/`.clinerules` — a tool that still reads its legacy file
 * loads it just as unconditionally as a root one) *and* sharing at least one
 * ecosystem — e.g. root `AGENTS.md` (codex, github-copilot, cursor, …) and
 * `.claude/CLAUDE.md` (claude-code only) both qualify on scope/activation but
 * share no ecosystem, so no single agent ecosystem loads both and comparing
 * them would flag a "contradiction" no agent could ever be confused by.
 * Currently checks one high-precision signal: two files that each
 * exclusively reference a *different* single package manager. A file that
 * mentions more than one package manager is plausibly discussing multiple
 * supported managers on purpose and is not compared, to keep false positives
 * low — this mirrors why `commands.reference.package-manager-mismatch` stays
 * a soft, informational signal rather than an unambiguous one.
 */
export const detectInstructionContradictions = (
  root: string,
  instructions: InstructionSurfaceEvidence[],
): InstructionContradictionEvidence[] => {
  const candidates = instructions.filter(
    surface => (surface.scope === 'root' || surface.scope === 'legacy') && surface.activation === 'always',
  )

  const singleManagerByPath = new Map<string, PackageManager>()
  const ecosystemsByPath = new Map<string, Set<InstructionEcosystem>>()
  for (const surface of candidates) {
    ecosystemsByPath.set(surface.path, new Set(surface.ecosystems))
    const text = readText(root, surface.path)
    if (text === undefined) continue
    const managers = mentionedPackageManagers(text)
    if (managers.size === 1) {
      singleManagerByPath.set(surface.path, [...managers][0])
    }
  }

  const sharesEcosystem = (pathA: string, pathB: string): boolean => {
    const ecosystemsA = ecosystemsByPath.get(pathA)
    const ecosystemsB = ecosystemsByPath.get(pathB)
    if (!ecosystemsA || !ecosystemsB) return false
    for (const ecosystem of ecosystemsA) {
      if (ecosystemsB.has(ecosystem)) return true
    }
    return false
  }

  const paths = [...singleManagerByPath.keys()].sort()
  const evidence: InstructionContradictionEvidence[] = []
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      const pathA = paths[i]
      const pathB = paths[j]
      const managerA = singleManagerByPath.get(pathA)
      const managerB = singleManagerByPath.get(pathB)
      if (managerA && managerB && managerA !== managerB && sharesEcosystem(pathA, pathB)) {
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
