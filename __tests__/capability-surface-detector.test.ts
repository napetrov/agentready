import { detectCapabilitySurfaces } from '../lib/repo-readiness/capability-surface-detector'

describe('detectCapabilitySurfaces', () => {
  test('detects MCP configs across common assistant ecosystems', () => {
    const result = detectCapabilitySurfaces([
      { path: '.mcp.json', sizeBytes: 200 },
      { path: '.cursor/mcp.json', sizeBytes: 300 },
      { path: '.vscode/mcp.json', sizeBytes: 400 },
      { path: '.claude/mcp.json', sizeBytes: 500 },
    ])

    expect(result.map(item => item.path)).toEqual([
      '.claude/mcp.json',
      '.cursor/mcp.json',
      '.mcp.json',
      '.vscode/mcp.json',
    ])
    expect(result.find(item => item.path === '.mcp.json')).toMatchObject({
      kind: 'mcp-server-config',
      ecosystems: ['mcp', 'generic-agent'],
    })
    expect(result.find(item => item.path === '.cursor/mcp.json')?.ecosystems).toEqual(['mcp', 'cursor'])
    expect(result.find(item => item.path === '.vscode/mcp.json')?.ecosystems).toEqual(['mcp', 'vscode', 'github-copilot'])
    expect(result.find(item => item.path === '.claude/mcp.json')?.ecosystems).toEqual(['mcp', 'claude-code'])
  })

  test('detects skills, hooks, plugins, assistant configs, and code intelligence', () => {
    const result = detectCapabilitySurfaces([
      { path: '.claude/skills/security-review/SKILL.md' },
      { path: '.codex/skills/release-notes/SKILL.md' },
      { path: 'skills/local-audit/SKILL.md' },
      { path: '.husky/pre-commit' },
      { path: '.pre-commit-config.yaml' },
      { path: 'lefthook.yml' },
      { path: '.agents/plugins/marketplace.json' },
      { path: 'plugins/slack/.codex-plugin/plugin.json' },
      { path: '.vscode/settings.json' },
      { path: '.cursor/settings.json' },
      { path: '.windsurf/settings.json' },
      { path: '.cline/settings.json' },
      { path: '.roomodes' },
      { path: 'tsconfig.json' },
      { path: 'packages/web/tsconfig.json' },
      { path: '.clangd' },
      { path: 'services/api/go.mod' },
    ])

    expect(result.find(item => item.path === '.claude/skills/security-review/SKILL.md')).toMatchObject({
      kind: 'skill',
      ecosystems: ['claude-code'],
      name: 'security-review',
      directoryScope: '.claude/skills/security-review',
    })
    expect(result.find(item => item.path === '.codex/skills/release-notes/SKILL.md')).toMatchObject({
      kind: 'skill',
      ecosystems: ['codex'],
      name: 'release-notes',
    })
    expect(result.find(item => item.path === '.husky/pre-commit')).toMatchObject({
      kind: 'hook',
      ecosystems: ['git-hooks'],
      name: 'pre-commit',
    })
    expect(result.find(item => item.path === '.agents/plugins/marketplace.json')).toMatchObject({
      kind: 'plugin',
      name: 'plugin-marketplace',
    })
    expect(result.find(item => item.path === 'plugins/slack/.codex-plugin/plugin.json')).toMatchObject({
      kind: 'plugin',
      ecosystems: ['codex'],
      name: 'slack',
      directoryScope: 'plugins/slack',
    })
    expect(result.find(item => item.path === '.vscode/settings.json')).toMatchObject({
      kind: 'assistant-config',
      ecosystems: ['vscode', 'github-copilot'],
    })
    expect(result.find(item => item.path === '.roomodes')).toMatchObject({
      kind: 'assistant-config',
      ecosystems: ['roo-code'],
    })
    expect(result.find(item => item.path === 'packages/web/tsconfig.json')).toMatchObject({
      kind: 'code-intelligence',
      ecosystems: ['lsp'],
      directoryScope: 'packages/web',
    })
    expect(result.find(item => item.path === 'services/api/go.mod')).toMatchObject({
      kind: 'code-intelligence',
      ecosystems: ['lsp'],
      name: 'api',
      directoryScope: 'services/api',
    })
  })

  test('rejects unsafe paths and strips archive roots', () => {
    const result = detectCapabilitySurfaces([
      { path: '../.mcp.json' },
      { path: '/repo/.cursor/mcp.json' },
      { path: 'repo-main/' },
      { path: 'repo-main/.mcp.json' },
      { path: 'repo-main/packages/api/tsconfig.json' },
    ])

    expect(result.map(item => item.path)).toEqual([
      '.mcp.json',
      'packages/api/tsconfig.json',
    ])
  })

  test('ignores unrelated files', () => {
    const result = detectCapabilitySurfaces([
      { path: 'README.md' },
      { path: 'src/index.ts' },
      { path: '.github/workflows/ci.yml' },
    ])

    expect(result).toEqual([])
  })
})
