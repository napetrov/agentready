export type CapabilityEcosystem =
  | 'mcp'
  | 'codex'
  | 'claude-code'
  | 'github-copilot'
  | 'cursor'
  | 'windsurf'
  | 'cline'
  | 'roo-code'
  | 'vscode'
  | 'git-hooks'
  | 'lsp'
  | 'generic-agent'

export type CapabilitySurfaceKind =
  | 'mcp-server-config'
  | 'skill'
  | 'hook'
  | 'plugin'
  | 'code-intelligence'
  | 'assistant-config'

export interface RepositoryFileReference {
  path: string
  sizeBytes?: number
}

export interface CapabilitySurfaceEvidence {
  path: string
  kind: CapabilitySurfaceKind
  ecosystems: CapabilityEcosystem[]
  name?: string
  directoryScope?: string
  sizeBytes?: number
  notes: string[]
}

export interface DetectCapabilitySurfaceOptions {
  archiveRoot?: string
}

interface CapabilityPattern {
  match: (normalizedPath: string) => boolean
  kind: CapabilitySurfaceKind
  ecosystems: CapabilityEcosystem[]
  note: string
  name?: (normalizedPath: string) => string | undefined
  directoryScope?: (normalizedPath: string) => string | undefined
}

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '')

const archiveRootPattern = /-(main|master|develop|development|trunk|[a-f0-9]{7,40})$/i
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

  const root = firstFilePath.split('/')[0]
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

const fileNameWithoutExtension = (path: string): string | undefined => {
  const fileName = normalizePath(path).split('/').pop()
  if (!fileName) {
    return undefined
  }
  const extensionIndex = fileName.indexOf('.')
  return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName
}

const directoryName = (path: string): string | undefined => {
  const parent = parentDirectory(path)
  return parent?.split('/').pop()
}

const capabilityPatterns: CapabilityPattern[] = [
  {
    match: path => path === '.mcp.json' || path === 'mcp.json',
    kind: 'mcp-server-config',
    ecosystems: ['mcp', 'generic-agent'],
    note: 'Repository-level MCP server configuration.',
    name: fileNameWithoutExtension,
  },
  {
    match: path => path === '.cursor/mcp.json',
    kind: 'mcp-server-config',
    ecosystems: ['mcp', 'cursor'],
    note: 'Cursor MCP server configuration.',
    name: () => 'cursor-mcp',
  },
  {
    match: path => path === '.vscode/mcp.json',
    kind: 'mcp-server-config',
    ecosystems: ['mcp', 'vscode', 'github-copilot'],
    note: 'VS Code MCP server configuration used by compatible assistants.',
    name: () => 'vscode-mcp',
  },
  {
    match: path => path === '.claude/mcp.json',
    kind: 'mcp-server-config',
    ecosystems: ['mcp', 'claude-code'],
    note: 'Claude Code MCP server configuration.',
    name: () => 'claude-mcp',
  },
  {
    match: path => path.startsWith('.claude/skills/') && path.endsWith('/SKILL.md'),
    kind: 'skill',
    ecosystems: ['claude-code'],
    note: 'Claude Code skill capability.',
    name: path => normalizePath(path).split('/')[2],
    directoryScope: parentDirectory,
  },
  {
    match: path => path.startsWith('.codex/skills/') && path.endsWith('/SKILL.md'),
    kind: 'skill',
    ecosystems: ['codex'],
    note: 'Codex skill capability.',
    name: path => normalizePath(path).split('/')[2],
    directoryScope: parentDirectory,
  },
  {
    match: path => path.startsWith('skills/') && path.endsWith('/SKILL.md'),
    kind: 'skill',
    ecosystems: ['generic-agent'],
    note: 'Generic repository skill capability.',
    name: path => normalizePath(path).split('/')[1],
    directoryScope: parentDirectory,
  },
  {
    match: path => path.startsWith('.husky/') && !path.endsWith('/_'),
    kind: 'hook',
    ecosystems: ['git-hooks'],
    note: 'Husky Git hook that can affect local validation or commit flow.',
    name: fileNameWithoutExtension,
    directoryScope: parentDirectory,
  },
  {
    match: path => path.startsWith('.githooks/'),
    kind: 'hook',
    ecosystems: ['git-hooks'],
    note: 'Repository Git hook script.',
    name: fileNameWithoutExtension,
    directoryScope: parentDirectory,
  },
  {
    match: path => path === '.pre-commit-config.yaml' || path === '.pre-commit-config.yml',
    kind: 'hook',
    ecosystems: ['git-hooks'],
    note: 'pre-commit hook configuration.',
    name: () => 'pre-commit',
  },
  {
    match: path => path === 'lefthook.yml' || path === 'lefthook.yaml',
    kind: 'hook',
    ecosystems: ['git-hooks'],
    note: 'Lefthook Git hook configuration.',
    name: () => 'lefthook',
  },
  {
    match: path => path === '.agents/plugins/marketplace.json',
    kind: 'plugin',
    ecosystems: ['codex', 'generic-agent'],
    note: 'Agent plugin marketplace manifest.',
    name: () => 'plugin-marketplace',
  },
  {
    match: path => path.endsWith('/.codex-plugin/plugin.json'),
    kind: 'plugin',
    ecosystems: ['codex'],
    note: 'Codex plugin manifest.',
    name: path => normalizePath(path).split('/').slice(-3, -2)[0],
    directoryScope: path => parentDirectory(parentDirectory(path) ?? path),
  },
  {
    match: path => path === '.vscode/settings.json' || path === '.vscode/extensions.json',
    kind: 'assistant-config',
    ecosystems: ['vscode', 'github-copilot'],
    note: 'VS Code workspace configuration that can affect assistant/editor behavior.',
    name: fileNameWithoutExtension,
    directoryScope: parentDirectory,
  },
  {
    match: path => path === '.cursor/settings.json' || path === '.cursorignore',
    kind: 'assistant-config',
    ecosystems: ['cursor'],
    note: 'Cursor workspace configuration.',
    name: fileNameWithoutExtension,
    directoryScope: parentDirectory,
  },
  {
    match: path => path === '.windsurf/settings.json' || path === '.codeiumignore',
    kind: 'assistant-config',
    ecosystems: ['windsurf'],
    note: 'Windsurf workspace configuration.',
    name: fileNameWithoutExtension,
    directoryScope: parentDirectory,
  },
  {
    match: path => path === '.cline/settings.json',
    kind: 'assistant-config',
    ecosystems: ['cline'],
    note: 'Cline workspace configuration.',
    name: fileNameWithoutExtension,
    directoryScope: parentDirectory,
  },
  {
    match: path => path === '.roomodes',
    kind: 'assistant-config',
    ecosystems: ['roo-code'],
    note: 'Roo Code project mode configuration.',
    name: () => 'roomodes',
  },
  {
    match: path => ['tsconfig.json', 'jsconfig.json', 'pyrightconfig.json', 'rust-project.json', '.clangd', 'go.work', 'go.mod'].includes(path),
    kind: 'code-intelligence',
    ecosystems: ['lsp'],
    note: 'Code-intelligence configuration used by language servers and assistants.',
    name: fileNameWithoutExtension,
  },
  {
    match: path => path.endsWith('/tsconfig.json') || path.endsWith('/jsconfig.json') || path.endsWith('/pyrightconfig.json'),
    kind: 'code-intelligence',
    ecosystems: ['lsp'],
    note: 'Nested code-intelligence configuration used by language servers and assistants.',
    name: fileNameWithoutExtension,
    directoryScope: parentDirectory,
  },
  {
    match: path => path.endsWith('/.clangd') || path.endsWith('/go.work') || path.endsWith('/go.mod'),
    kind: 'code-intelligence',
    ecosystems: ['lsp'],
    note: 'Nested code-intelligence configuration used by language servers and assistants.',
    name: directoryName,
    directoryScope: parentDirectory,
  },
]

export function detectCapabilitySurfaces(
  files: RepositoryFileReference[],
  options: DetectCapabilitySurfaceOptions = {},
): CapabilitySurfaceEvidence[] {
  const evidence: CapabilitySurfaceEvidence[] = []
  const normalizedFiles = files
    .map(file => ({ ...file, normalizedPath: normalizeRepositoryPath(file.path) }))
    .filter((file): file is RepositoryFileReference & { normalizedPath: string } => file.normalizedPath !== undefined)

  const archiveRoot = findArchiveRoot(normalizedFiles.map(file => file.normalizedPath), options.archiveRoot)

  for (const file of normalizedFiles) {
    const normalizedPath = stripArchiveRoot(file.normalizedPath, archiveRoot)
    const matchedPatterns = capabilityPatterns.filter(pattern => pattern.match(normalizedPath))

    for (const pattern of matchedPatterns) {
      evidence.push({
        path: normalizedPath,
        kind: pattern.kind,
        ecosystems: pattern.ecosystems,
        name: pattern.name?.(normalizedPath),
        directoryScope: pattern.directoryScope?.(normalizedPath),
        sizeBytes: file.sizeBytes,
        notes: [pattern.note],
      })
    }
  }

  return evidence.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind))
}
