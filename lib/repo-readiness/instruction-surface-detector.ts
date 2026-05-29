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

export interface DetectInstructionSurfaceOptions {
  archiveRoot?: string
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

const archiveRootPattern = /-(main|master|develop|development|trunk|[a-f0-9]{7,40})$/i
// Intentionally matches control and bidirectional-override characters used in
// path-spoofing attempts; such characters are rejected from instruction paths.
// eslint-disable-next-line no-control-regex
const unsafePathCharacterPattern = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/

const normalizePath = (path: string): string => trimSlashes(path.replace(/\\/g, '/'))

const normalizeRepositoryPath = (path: string): string | undefined => {
  const forwardSlashPath = path.replace(/\\/g, '/')

  if (
    forwardSlashPath.startsWith('/')
    || /^[a-z]:\//i.test(forwardSlashPath)
    || unsafePathCharacterPattern.test(forwardSlashPath)
  ) {
    return undefined
  }

  const normalized = trimSlashes(forwardSlashPath)

  if (!normalized) {
    return undefined
  }

  const segments = normalized.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    return undefined
  }

  return segments.join('/')
}

const findArchiveRoot = (paths: string[], explicitArchiveRoot?: string): string | undefined => {
  if (paths.length === 0) {
    return undefined
  }

  const normalizedArchiveRoot = explicitArchiveRoot ? normalizeRepositoryPath(explicitArchiveRoot) : undefined
  if (normalizedArchiveRoot && !normalizedArchiveRoot.includes('/')) {
    return paths.every(path => path === normalizedArchiveRoot || path.startsWith(`${normalizedArchiveRoot}/`))
      ? normalizedArchiveRoot
      : undefined
  }

  const firstFilePath = paths.find(path => path.includes('/'))
  if (!firstFilePath) {
    return undefined
  }

  const firstPathSegments = firstFilePath.split('/')
  const root = firstPathSegments[0]

  if (!root || !archiveRootPattern.test(root)) {
    return undefined
  }

  return paths.includes(root) && paths.every(path => path === root || path.startsWith(`${root}/`))
    ? root
    : undefined
}

const stripArchiveRoot = (path: string, archiveRoot?: string): string => {
  if (!archiveRoot || !path.startsWith(`${archiveRoot}/`)) {
    return path
  }

  return path.slice(archiveRoot.length + 1)
}

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
    ecosystems: ['codex', 'github-copilot', 'cursor', 'windsurf', 'cline', 'generic-agent'],
    scope: 'root',
    activation: 'always',
    note: 'Portable repository-level agent instruction entrypoint.',
  },
  {
    match: path => path.endsWith('/AGENTS.md'),
    ecosystems: ['codex', 'github-copilot', 'cursor', 'windsurf', 'cline', 'generic-agent'],
    scope: 'path-specific',
    activation: 'path-scoped',
    directoryScope: path => directoryBeforeFile(path, 'AGENTS.md'),
    note: 'Nested agent instructions usually apply to the containing directory.',
  },
  {
    match: path => path === 'AGENTS.override.md' || path.endsWith('/AGENTS.override.md'),
    ecosystems: ['codex'],
    scope: (path: string) => (path === 'AGENTS.override.md' ? 'root' : 'path-specific'),
    activation: (path: string) => (path === 'AGENTS.override.md' ? 'always' : 'path-scoped'),
    directoryScope: path => directoryBeforeFile(path, 'AGENTS.override.md'),
    note: 'Repository-level Codex override instruction file.',
  },
  {
    match: path => path === 'CLAUDE.md',
    ecosystems: ['claude-code', 'github-copilot'],
    scope: 'root',
    activation: 'always',
    note: 'Claude Code project memory; also recognized by GitHub Copilot CLI as an agent instruction file.',
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
    scope: 'unknown',
    activation: 'unknown',
    note: 'Claude Code project rule file; frontmatter may control path applicability.',
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
    note: 'GitHub Copilot instruction file; frontmatter controls path applicability.',
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
    scope: 'unknown',
    activation: 'unknown',
    note: 'Cursor project rule file; MDC metadata controls activation and file applicability.',
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
    match: path => path === 'GEMINI.md',
    ecosystems: ['gemini', 'github-copilot'],
    scope: 'root',
    activation: 'always',
    note: 'Gemini project context file; also recognized by GitHub Copilot CLI as an agent instruction file.',
  },
  {
    match: path => path.endsWith('/GEMINI.md'),
    ecosystems: ['gemini'],
    scope: 'path-specific',
    activation: 'path-scoped',
    directoryScope: path => directoryBeforeFile(path, 'GEMINI.md'),
    note: 'Gemini project context file.',
  },
  {
    match: path => path.startsWith('.windsurf/rules/') && path.endsWith('.md'),
    ecosystems: ['windsurf'],
    scope: 'unknown',
    activation: 'unknown',
    note: 'Windsurf workspace rule file; metadata controls trigger and file applicability.',
  },
  {
    match: path => path === '.windsurfrules',
    ecosystems: ['windsurf', 'cline'],
    scope: 'legacy',
    activation: 'always',
    legacy: true,
    note: 'Legacy Windsurf rule file; also auto-detected by Cline.',
  },
  {
    match: path => path.startsWith('.clinerules/') && (path.endsWith('.md') || path.endsWith('.txt')),
    ecosystems: ['cline'],
    scope: 'root',
    activation: 'unknown',
    note: 'Cline workspace rule file managed through the Rules panel.',
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
    match: path => path.startsWith('.roo/rules/') && (path.endsWith('.md') || path.endsWith('.txt')),
    ecosystems: ['roo-code'],
    scope: 'root',
    activation: 'always',
    note: 'Roo Code workspace rule file applied across modes.',
  },
  {
    match: path => /^\.roo\/rules-[^/]+\//.test(path) && (path.endsWith('.md') || path.endsWith('.txt')),
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
  {
    match: path => path === '.roomodes',
    ecosystems: ['roo-code'],
    scope: 'mode-specific',
    activation: 'mode-scoped',
    note: 'Roo Code project mode configuration with mode-specific instructions.',
  },
]

export function detectInstructionSurfaces(
  files: RepositoryFileReference[],
  options: DetectInstructionSurfaceOptions = {},
): InstructionSurfaceEvidence[] {
  const evidence: InstructionSurfaceEvidence[] = []
  const normalizedFiles = files
    .map(file => ({ ...file, normalizedPath: normalizeRepositoryPath(file.path) }))
    .filter((file): file is RepositoryFileReference & { normalizedPath: string } => file.normalizedPath !== undefined)

  const archiveRoot = findArchiveRoot(normalizedFiles.map(file => file.normalizedPath), options.archiveRoot)

  for (const file of normalizedFiles) {
    const normalizedPath = stripArchiveRoot(file.normalizedPath, archiveRoot)
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
