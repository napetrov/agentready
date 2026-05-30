import { readFileSync, statSync } from 'fs'
import path from 'path'
import type { LocalReadinessReport } from '../repo-readiness/core/types'

// Slicing builds the bounded text an analyzer sends to a model. The design rule
// (docs/product/llm-analytics-design.md §5.3): send the relevant file(s) plus a
// tree *summary*, never the whole repo, under a hard byte budget.

export interface SliceOptions {
  /** Hard cap on total sliced bytes. Files are truncated/dropped to fit. */
  maxBytes?: number
  /** Per-file cap, so one large file cannot consume the whole budget. */
  maxBytesPerFile?: number
}

const DEFAULT_MAX_BYTES = 24_000
const DEFAULT_MAX_BYTES_PER_FILE = 12_000

export interface SlicedInput {
  /** The assembled text to send to the model. */
  text: string
  /** Repo-relative paths actually included (after the budget was applied). */
  includedPaths: string[]
  /** Paths requested but dropped because the budget was exhausted. */
  droppedPaths: string[]
  /** Total bytes of `text`. */
  bytes: number
}

const truncate = (content: string, maxBytes: number): { text: string; truncated: boolean } => {
  if (Buffer.byteLength(content, 'utf8') <= maxBytes) {
    return { text: content, truncated: false }
  }
  // Truncate on a character boundary that fits the byte budget.
  let text = content.slice(0, maxBytes)
  while (Buffer.byteLength(text, 'utf8') > maxBytes) {
    text = text.slice(0, -1)
  }
  return { text, truncated: true }
}

/**
 * Reads and concatenates the requested repo files into a single bounded block,
 * honoring per-file and total byte budgets. Unreadable files are skipped (the
 * layer is advisory; a missing file must not break a run). Returns the assembled
 * text plus exactly which paths were included vs. dropped.
 */
export const sliceFiles = (root: string, relPaths: string[], options: SliceOptions = {}): SlicedInput => {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const maxBytesPerFile = options.maxBytesPerFile ?? DEFAULT_MAX_BYTES_PER_FILE

  const parts: string[] = []
  const includedPaths: string[] = []
  const droppedPaths: string[] = []
  let used = 0

  for (const relPath of relPaths) {
    let content: string
    try {
      content = readFileSync(path.join(root, relPath), 'utf8')
    } catch {
      droppedPaths.push(relPath)
      continue
    }

    const { text: capped, truncated } = truncate(content, maxBytesPerFile)
    const header = `=== ${relPath}${truncated ? ' (truncated)' : ''} ===\n`
    const block = `${header}${capped}\n`
    const blockBytes = Buffer.byteLength(block, 'utf8')

    if (used + blockBytes > maxBytes) {
      droppedPaths.push(relPath)
      continue
    }

    parts.push(block)
    includedPaths.push(relPath)
    used += blockBytes
  }

  const text = parts.join('\n')
  return { text, includedPaths, droppedPaths, bytes: Buffer.byteLength(text, 'utf8') }
}

/**
 * A compact, human-readable summary of repository shape derived from the
 * deterministic report — counts, doc/CI/instruction inventory, and command
 * surfaces. Cheap context that orients a model without sending the whole tree.
 */
export const summarizeEvidence = (report: LocalReadinessReport): string => {
  const { summary, docs, commands, ci, instructions, capabilities } = report
  const lines = [
    `root: ${path.basename(report.root) || report.root}`,
    `files: ${summary.totalFiles} (source ${summary.sourceFiles}, test ${summary.testFiles}, docs ${summary.documentationFiles})`,
    `ecosystems: ${commands.ecosystems.join(', ') || 'none'}`,
    `commands: test=${commands.hasTest} lint=${commands.hasLint} build=${commands.hasBuild} typecheck=${commands.hasTypeCheck}`,
    `ci workflows: ${ci.workflowFiles.length}`,
    `readme: ${docs.readme.length > 0 ? docs.readme.join(', ') : 'none'}`,
    `architecture docs: ${docs.architecture.length > 0 ? docs.architecture.join(', ') : 'none'}`,
    `instruction surfaces: ${instructions.length > 0 ? instructions.map(i => i.path).join(', ') : 'none'}`,
    `capability surfaces: ${capabilities.length}`,
    `findings: ${report.findings.length}`,
  ]
  return lines.join('\n')
}

/** Existence check used by analyzers when deciding whether a slice is worth sending. */
export const fileExists = (root: string, relPath: string): boolean => {
  try {
    return statSync(path.join(root, relPath)).isFile()
  } catch {
    return false
  }
}
