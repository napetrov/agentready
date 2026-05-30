import type { CapabilityKind, CapabilitySurfaceEvidence } from '../core/types'
import { normalizeRepoPath } from '../core/util'

interface CapabilityPattern {
  match: (repoPath: string) => boolean
  kind: CapabilityKind
  tool: string
  note: string
}

// Deterministic, path-based recognition of agent capability surfaces. Detectors
// observe facts only; the checks layer decides what (if anything) to flag. We
// intentionally key off well-known, stable file locations rather than parsing
// arbitrary config so the signal stays high-confidence.
const capabilityPatterns: CapabilityPattern[] = [
  {
    match: repoPath => repoPath === '.mcp.json',
    kind: 'mcp',
    tool: 'claude-code',
    note: 'Project-scoped Model Context Protocol server configuration.',
  },
  {
    match: repoPath => repoPath === '.cursor/mcp.json',
    kind: 'mcp',
    tool: 'cursor',
    note: 'Cursor Model Context Protocol server configuration.',
  },
  {
    match: repoPath => repoPath === '.vscode/mcp.json',
    kind: 'mcp',
    tool: 'vscode',
    note: 'VS Code Model Context Protocol server configuration.',
  },
  {
    match: repoPath => repoPath.startsWith('.claude/skills/') && repoPath.endsWith('/SKILL.md'),
    kind: 'skill',
    tool: 'claude-code',
    note: 'Claude Code skill that an agent can invoke on demand.',
  },
  {
    match: repoPath => repoPath === '.claude/settings.json',
    kind: 'hook',
    tool: 'claude-code',
    note: 'Shared Claude Code settings; may define hooks and tool permissions.',
  },
  {
    match: repoPath => repoPath === '.claude/settings.local.json',
    kind: 'hook',
    tool: 'claude-code',
    note: 'Local Claude Code settings; usually uncommitted and developer-specific.',
  },
  {
    match: repoPath => repoPath.startsWith('.claude/hooks/'),
    kind: 'hook',
    tool: 'claude-code',
    note: 'Claude Code hook script executed around agent tool calls.',
  },
  {
    match: repoPath => repoPath === '.claude-plugin/plugin.json',
    kind: 'plugin',
    tool: 'claude-code',
    note: 'Claude Code plugin manifest.',
  },
  {
    match: repoPath => repoPath === '.claude-plugin/marketplace.json',
    kind: 'plugin',
    tool: 'claude-code',
    note: 'Claude Code plugin marketplace manifest.',
  },
  {
    match: repoPath => repoPath === '.vscode/settings.json',
    kind: 'lsp',
    tool: 'vscode',
    note: 'VS Code workspace settings that shape editor and language-server behavior.',
  },
  {
    match: repoPath => repoPath === '.vscode/extensions.json',
    kind: 'lsp',
    tool: 'vscode',
    note: 'VS Code recommended-extension list, including language servers.',
  },
  {
    match: repoPath => repoPath === '.editorconfig',
    kind: 'lsp',
    tool: 'editor',
    note: 'EditorConfig file defining cross-editor formatting conventions.',
  },
]

/**
 * Detects agent capability surfaces — MCP server configs, skills, hooks,
 * plugins, and code-intelligence/LSP config — that change what tools an agent
 * can reach for in this repository.
 */
export const detectCapabilitySurfaces = (filePaths: string[]): CapabilitySurfaceEvidence[] => {
  const evidence: CapabilitySurfaceEvidence[] = []

  for (const filePath of filePaths) {
    const repoPath = normalizeRepoPath(filePath)
    for (const pattern of capabilityPatterns) {
      if (pattern.match(repoPath)) {
        evidence.push({
          kind: pattern.kind,
          path: repoPath,
          tool: pattern.tool,
          notes: [pattern.note],
        })
      }
    }
  }

  return evidence.sort((a, b) => a.path.localeCompare(b.path))
}
