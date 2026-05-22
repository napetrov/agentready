export type InstructionEcosystem =
  | 'codex'
  | 'claude-code'
  | 'github-copilot'
  | 'cursor'
  | 'gemini'
  | 'windsurf'
  | 'cline'
  | 'roo-code'
  | 'generic-agent'

export type InstructionScope =
  | 'root'
  | 'path-specific'
  | 'mode-specific'
  | 'local-private'
  | 'legacy'
  | 'capability'
  | 'unknown'

export type InstructionActivation =
  | 'always'
  | 'path-scoped'
  | 'mode-scoped'
  | 'manual'
  | 'on-demand'
  | 'unknown'

export interface RepositoryFileReference {
  path: string
  sizeBytes?: number
  content?: string
}

export interface InstructionSurfaceEvidence {
  path: string
  ecosystems: InstructionEcosystem[]
  scope: InstructionScope
  activation: InstructionActivation
  sizeBytes?: number
  directoryScope?: string
  mode?: string
  legacy: boolean
  localPrivate: boolean
  notes: string[]
}

interface InstructionPattern {
  match: (normalizedPath: string) => boolean
  ecosystems: InstructionEcosystem[]
  scope: InstructionScope | ((normalizedPath: string) => InstructionScope)
  activation: InstructionActivation | ((normalizedPath: string) => InstructionActivation)
  legacy?: boolean
  localPrivate?: boolean
  note?: string
  directoryScope?: (normalizedPath: string) => string | undefined
  mode?: (normalizedPath: string) => string | undefined
}

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '')

const normalizePath = (path: string): string => trimSlashes(path.replace(/\\/g, '/'))

const parentDirectory = (path: string): string | undefined => {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  if (index <= 0) {
    return undefined
  }
  return normalized.slice(0, index)
}

const directoryBeforeFile = (path: string, fileName: string): string | undefined => {
  const normalized = normalizePath(path)
  if (!normalized.endsWith(`/${fileName}`)) {
    return undefined
  }
  const directory = normalized.slice(0, -fileName.length - 1)
  return directory || undefined
}

const modeFromPath = (path: string, prefix: string): string | undefined => {
  const normalized = normalizePath(path)
  const fileName = normalized.split('/').pop()
  if (!fileName || !fileName.startsWith(prefix)) {
    return undefined
  }
  return fileName.slice(prefix.length).replace(/\.(md|txt)$/, '') || undefined
}

const instructionPatterns: InstructionPattern[] = [
  {
    match: path => path === 'AGENTS.md',
    ecosystems: ['codex', 'github-copilot', 'windsurf', 'cline', 'generic-agent'],
    scope: 'root',
    activation: 'always',
    note: 'Portable repository-level agent instruction entrypoint.',
  },
  {
    match: path => path.endsWith('/AGENTS.md'),
    ecosystems: ['codex', 'github-copilot', 'windsurf', 'cline', 'generic-agent'],
    scope: 'path-specific',
    activation: 'path-scoped',
    directoryScope: path => directoryBeforeFile(path, 'AGENTS.md'),
    note: 'Nested agent instructions usually apply to the containing directory.',
  },
  {
    match: path => path === 'AGENTS.override.md' || path.endsWith('/AGENTS.override.md'),
    ecosystems: ['codex'],
    scope: 'path-specific',
    activation: 'path-scoped',
    directoryScope: path => directoryBeforeFile(path, 'AGENTS.override.md'),
    note: 'Codex-specific override instruction file.',
  },
  {
    match: path => path === 'CLAUDE.md',
    ecosystems: ['claude-code'],
    scope: 'root',
    activation: 'always',
    note: 'Claude Code project memory loaded at session start.',
  },
  {
    match: path => path === '.claude/CLAUDE.md',
    ecosystems: ['claude-code'],
    scope: 'root',
    activation: 'always',
    note: 'Claude Code project memory under .claude.',
  },
  {
    match: path => path.endsWith('/CLAUDE.md') && path !== '.claude/CLAUDE.md',
    ecosystems: ['claude-code'],
    scope: 'path-specific',
    activation: 'path-scoped',
    directoryScope: path => directoryBeforeFile(path, 'CLAUDE.md'),
    note: 'Claude Code subdirectory memory for local conventions.',
  },
  {
    match: path => path === 'CLAUDE.local.md' || path.endsWith('/CLAUDE.local.md'),
    ecosystems: ['claude-code'],
    scope: 'local-private',
    activation: 'always',
    localPrivate: true,
    directoryScope: path => directoryBeforeFile(path, 'CLAUDE.local.md'),
    note: 'Local Claude Code memory should usually be ignored and uncommitted.',
  },
  {
    match: path => path.startsWith('.claude/rules/') && path.endsWith('.md'),
    ecosystems: ['claude-code'],
    scope: 'path-specific',
    activation: 'unknown',
    directoryScope: parentDirectory,
    note: 'Claude Code project rule file.',
  },
  {
    match: path => path.startsWith('.claude/skills/') && path.endsWith('/SKILL.md'),
    ecosystems: ['claude-code'],
    scope: 'capability',
    activation: 'on-demand',
    directoryScope: parentDirectory,
    note: 'Claude Code skill capability surface.',
  },
  {
    match: path => path === '.github/copilot-instructions.md',
    ecosystems: ['github-copilot'],
    scope: 'root',
    activation: 'always',
    note: 'GitHub Copilot repository custom instructions.',
  },
  {
    match: path => path.startsWith('.github/instructions/') && path.endsWith('.instructions.md'),
    ecosystems: ['github-copilot'],
    scope: 'path-specific',
    activation: 'path-scoped',
    directoryScope: parentDirectory,
    note: 'GitHub Copilot path-specific instruction file.',
  },
  {
    match: path => path.startsWith('.github/agents/') && path.endsWith('.agent.md'),
    ecosystems: ['github-copilot'],
    scope: 'capability',
    activation: 'manual',
    directoryScope: parentDirectory,
    note: 'GitHub Copilot custom agent definition.',
  },
  {
    match: path => path.startsWith('.cursor/rules/') && path.endsWith('.mdc'),
    ecosystems: ['cursor'],
    scope: 'path-specific',
    activation: 'unknown',
    directoryScope: parentDirectory,
    note: 'Cursor project rule file.',
  },
  {
    match: path => path === '.cursorrules',
    ecosystems: ['cursor', 'cline'],
    scope: 'legacy',
    activation: 'always',
    legacy: true,
    note: 'Legacy Cursor rule file.',
  },
  {
    match: path => path === 'GEMINI.md' || path.endsWith('/GEMINI.md'),
    ecosystems: ['gemini'],
    scope: (path: string) => (path === 'GEMINI.md' ? 'root' : 'path-specific'),
    activation: 'always',
    directoryScope: path => directoryBeforeFile(path, 'GEMINI.md'),
    note: 'Gemini project context file.',
  },
  {
    match: path => path.startsWith('.windsurf/rules/') && path.endsWith('.md'),
    ecosystems: ['windsurf'],
    scope: 'path-specific',
    activation: 'unknown',
    directoryScope: parentDirectory,
    note: 'Windsurf workspace rule file.',
  },
  {
    match: path => path === '.windsurfrules',
    ecosystems: ['windsurf'],
    scope: 'legacy',
    activation: 'always',
    legacy: true,
    note: 'Legacy Windsurf rule file.',
  },
  {
    match: path => path.startsWith('.clinerules/') && (path.endsWith('.md') || path.endsWith('.txt')),
    ecosystems: ['cline'],
    scope: 'path-specific',
    activation: 'unknown',
    directoryScope: parentDirectory,
    note: 'Cline workspace rule file.',
  },
  {
    match: path => path === '.clinerules',
    ecosystems: ['cline'],
    scope: 'legacy',
    activation: 'always',
    legacy: true,
    note: 'Legacy Cline rule file.',
  },
  {
    match: path => path.startsWith('.roo/rules/'),
    ecosystems: ['roo-code'],
    scope: 'path-specific',
    activation: 'always',
    directoryScope: parentDirectory,
    note: 'Roo Code workspace rule file.',
  },
  {
    match: path => /^\.roo\/rules-[^/]+\//.test(path),
    ecosystems: ['roo-code'],
    scope: 'mode-specific',
    activation: 'mode-scoped',
    directoryScope: parentDirectory,
    mode: path => normalizePath(path).split('/')[1]?.replace(/^rules-/, ''),
    note: 'Roo Code mode-specific rule file.',
  },
  {
    match: path => path === '.roorules' || /^\.roorules-[^/]+$/.test(path),
    ecosystems: ['roo-code'],
    scope: (path: string) => (path === '.roorules' ? 'legacy' : 'mode-specific'),
    activation: (path: string) => (path === '.roorules' ? 'always' : 'mode-scoped'),
    legacy: true,
    mode: path => modeFromPath(path, '.roorules-'),
    note: 'Roo Code legacy rule file.',
  },
]

export function detectInstructionSurfaces(files: RepositoryFileReference[]): InstructionSurfaceEvidence[] {
  const evidence: InstructionSurfaceEvidence[] = []

  for (const file of files) {
    const normalizedPath = normalizePath(file.path)
    const matchedPatterns = instructionPatterns.filter(pattern => pattern.match(normalizedPath))

    for (const pattern of matchedPatterns) {
      const scope = typeof pattern.scope === 'function' ? pattern.scope(normalizedPath) : pattern.scope
      const activation = typeof pattern.activation === 'function'
        ? pattern.activation(normalizedPath)
        : pattern.activation

      const notes = pattern.note ? [pattern.note] : []

      if (file.sizeBytes !== undefined && file.sizeBytes > 200_000) {
        notes.push('Instruction file is large enough to create context-friction risk.')
      }

      evidence.push({
        path: normalizedPath,
        ecosystems: pattern.ecosystems,
        scope,
        activation,
        sizeBytes: file.sizeBytes,
        directoryScope: pattern.directoryScope?.(normalizedPath),
        mode: pattern.mode?.(normalizedPath),
        legacy: pattern.legacy ?? false,
        localPrivate: pattern.localPrivate ?? false,
        notes,
      })
    }
  }

  return evidence.sort((a, b) => a.path.localeCompare(b.path))
}
