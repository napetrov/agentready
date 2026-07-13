import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { CapabilityKind, CapabilityRiskTier, CapabilitySurfaceEvidence } from '../core/types'
import { normalizeRepoPath } from '../core/util'

interface CapabilityPattern {
  match: (repoPath: string) => boolean
  kind: CapabilityKind
  tool: string
  note: string
  /**
   * Static risk tier for the surface, or a function that inspects the file's
   * own content to refine it (used only for settings files whose risk depends
   * on whether they actually configure a hook, not just their existence).
   */
  riskTier: CapabilityRiskTier | ((root: string, repoPath: string) => CapabilityRiskTier)
}

// A Claude Code settings file is only as risky as what it configures: one
// that defines a non-empty `hooks` block can run arbitrary commands around
// every tool call (the same blast radius as a hook script), while one that
// only sets permissions/other preferences has no execution surface of its
// own. Read-only, best-effort — an unparsable or missing file falls back to
// `medium` rather than guessing high or silently downgrading to low.
const hookSettingsRiskTier = (root: string, repoPath: string): CapabilityRiskTier => {
  const absolutePath = path.join(root, repoPath)
  if (!existsSync(absolutePath)) return 'medium'
  try {
    const settings = JSON.parse(readFileSync(absolutePath, 'utf8')) as Record<string, unknown>
    const hooks = settings.hooks
    // An event key with an empty matcher-group array (e.g. `PreToolUse: []`)
    // configures nothing, same as an empty `hooks` object — check for at
    // least one non-empty event, not just that the `hooks` key is present.
    const hasHooks =
      hooks !== undefined
      && hooks !== null
      && (typeof hooks !== 'object'
        || Object.values(hooks as Record<string, unknown>).some(value => (Array.isArray(value) ? value.length > 0 : Boolean(value))))
    return hasHooks ? 'high' : 'medium'
  } catch {
    return 'medium'
  }
}

// Deterministic, path-based recognition of agent capability surfaces. Detectors
// observe facts without judgment beyond this file's own content (never another
// file's); the checks layer decides what (if anything) to flag. We
// intentionally key off well-known, stable file locations rather than parsing
// arbitrary config so the signal stays high-confidence.
//
// Risk tiers reflect blast radius, not likelihood of misuse: `high` covers
// surfaces that can run arbitrary commands or grant tools whose scope this
// detector cannot verify statically (a hook script, a configured hooks block,
// any MCP server config — the server's actual tool set is only visible over
// the MCP protocol at runtime, not in its launch config — and plugin
// manifests, which can themselves bundle MCP servers and hooks). `low` is
// read-only/informational (LSP/editor config, a skill's instructions).
const capabilityPatterns: CapabilityPattern[] = [
  {
    match: repoPath => repoPath === '.mcp.json',
    kind: 'mcp',
    tool: 'claude-code',
    note: 'Project-scoped Model Context Protocol server configuration.',
    riskTier: 'high',
  },
  {
    match: repoPath => repoPath === '.cursor/mcp.json',
    kind: 'mcp',
    tool: 'cursor',
    note: 'Cursor Model Context Protocol server configuration.',
    riskTier: 'high',
  },
  {
    match: repoPath => repoPath === '.vscode/mcp.json',
    kind: 'mcp',
    tool: 'vscode',
    note: 'VS Code Model Context Protocol server configuration.',
    riskTier: 'high',
  },
  {
    match: repoPath => repoPath.startsWith('.claude/skills/') && repoPath.endsWith('/SKILL.md'),
    kind: 'skill',
    tool: 'claude-code',
    note: 'Claude Code skill that an agent can invoke on demand.',
    riskTier: 'low',
  },
  {
    match: repoPath => repoPath === '.claude/settings.json',
    kind: 'hook',
    tool: 'claude-code',
    note: 'Shared Claude Code settings; may define hooks and tool permissions.',
    riskTier: hookSettingsRiskTier,
  },
  {
    match: repoPath => repoPath === '.claude/settings.local.json',
    kind: 'hook',
    tool: 'claude-code',
    note: 'Local Claude Code settings; usually uncommitted and developer-specific.',
    riskTier: hookSettingsRiskTier,
  },
  {
    match: repoPath => repoPath.startsWith('.claude/hooks/'),
    kind: 'hook',
    tool: 'claude-code',
    note: 'Claude Code hook script executed around agent tool calls.',
    riskTier: 'high',
  },
  {
    match: repoPath => repoPath === '.claude-plugin/plugin.json',
    kind: 'plugin',
    tool: 'claude-code',
    note: 'Claude Code plugin manifest.',
    riskTier: 'high',
  },
  {
    match: repoPath => repoPath === '.claude-plugin/marketplace.json',
    kind: 'plugin',
    tool: 'claude-code',
    note: 'Claude Code plugin marketplace manifest.',
    riskTier: 'high',
  },
  {
    match: repoPath => repoPath === '.vscode/settings.json',
    kind: 'lsp',
    tool: 'vscode',
    note: 'VS Code workspace settings that shape editor and language-server behavior.',
    riskTier: 'low',
  },
  {
    match: repoPath => repoPath === '.vscode/extensions.json',
    kind: 'lsp',
    tool: 'vscode',
    note: 'VS Code recommended-extension list, including language servers.',
    riskTier: 'low',
  },
  {
    match: repoPath => repoPath === '.editorconfig',
    kind: 'lsp',
    tool: 'editor',
    note: 'EditorConfig file defining cross-editor formatting conventions.',
    riskTier: 'low',
  },
]

/**
 * Detects agent capability surfaces — MCP server configs, skills, hooks,
 * plugins, and code-intelligence/LSP config — that change what tools an agent
 * can reach for in this repository, each classified by blast-radius risk tier
 * so reports can flag high-risk surfaces for approval workflows instead of
 * just listing them.
 */
export const detectCapabilitySurfaces = (root: string, filePaths: string[]): CapabilitySurfaceEvidence[] => {
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
          riskTier: typeof pattern.riskTier === 'function' ? pattern.riskTier(root, repoPath) : pattern.riskTier,
        })
      }
    }
  }

  return evidence.sort((a, b) => a.path.localeCompare(b.path))
}
