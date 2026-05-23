import { detectInstructionSurfaces } from '../lib/repo-readiness/instruction-surface-detector'

describe('detectInstructionSurfaces', () => {
  test('detects root and nested portable agent instructions', () => {
    const result = detectInstructionSurfaces([
      { path: 'AGENTS.md', sizeBytes: 1200 },
      { path: 'apps/web/AGENTS.md', sizeBytes: 900 },
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      path: 'AGENTS.md',
      scope: 'root',
      activation: 'always',
      legacy: false,
      localPrivate: false,
    })
    expect(result[0].ecosystems).toContain('codex')
    expect(result[0].ecosystems).toContain('github-copilot')
    expect(result[0].ecosystems).toContain('cursor')

    expect(result[1]).toMatchObject({
      path: 'apps/web/AGENTS.md',
      scope: 'path-specific',
      activation: 'path-scoped',
      directoryScope: 'apps/web',
    })
  })

  test('detects Claude Code memory, local memory, rules, and skills', () => {
    const result = detectInstructionSurfaces([
      { path: 'CLAUDE.md', sizeBytes: 1000 },
      { path: 'services/api/CLAUDE.md', sizeBytes: 1000 },
      { path: 'CLAUDE.local.md', sizeBytes: 1000 },
      { path: '.claude/rules/testing.md', sizeBytes: 1000 },
      { path: '.claude/skills/security-review/SKILL.md', sizeBytes: 1000 },
    ])

    expect(result.map(item => item.path)).toEqual([
      '.claude/rules/testing.md',
      '.claude/skills/security-review/SKILL.md',
      'CLAUDE.local.md',
      'CLAUDE.md',
      'services/api/CLAUDE.md',
    ])

    expect(result.find(item => item.path === 'CLAUDE.local.md')).toMatchObject({
      ecosystems: ['claude-code'],
      scope: 'local-private',
      localPrivate: true,
    })

    expect(result.find(item => item.path === '.claude/skills/security-review/SKILL.md')).toMatchObject({
      scope: 'capability',
      activation: 'on-demand',
    })
    expect(result.find(item => item.path === '.claude/rules/testing.md')).toMatchObject({
      scope: 'unknown',
      activation: 'unknown',
    })
  })

  test('detects tool-specific and legacy rule surfaces', () => {
    const result = detectInstructionSurfaces([
      { path: '.github/copilot-instructions.md' },
      { path: '.github/instructions/react.instructions.md' },
      { path: '.github/agents/reviewer.agent.md' },
      { path: '.cursor/rules/frontend.mdc' },
      { path: '.cursorrules' },
      { path: 'GEMINI.md' },
      { path: 'packages/api/GEMINI.md' },
      { path: '.windsurf/rules/project.md' },
      { path: '.windsurfrules' },
      { path: '.clinerules/security.md' },
      { path: '.roo/rules-code/review.md' },
      { path: '.roorules-debug' },
      { path: '.roomodes' },
    ])

    expect(result.find(item => item.path === '.github/copilot-instructions.md')).toMatchObject({
      ecosystems: ['github-copilot'],
      scope: 'root',
    })
    expect(result.find(item => item.path === '.github/instructions/react.instructions.md')).toMatchObject({
      ecosystems: ['github-copilot'],
      scope: 'path-specific',
      activation: 'path-scoped',
    })
    expect(result.find(item => item.path === '.github/agents/reviewer.agent.md')).toMatchObject({
      scope: 'capability',
      activation: 'manual',
    })
    expect(result.find(item => item.path === '.cursorrules')).toMatchObject({
      legacy: true,
      scope: 'legacy',
    })
    expect(result.find(item => item.path === '.cursor/rules/frontend.mdc')).toMatchObject({
      scope: 'unknown',
      activation: 'unknown',
    })
    expect(result.find(item => item.path === '.windsurf/rules/project.md')).toMatchObject({
      scope: 'unknown',
      activation: 'unknown',
    })
    expect(result.find(item => item.path === '.windsurfrules')?.ecosystems).toContain('cline')
    expect(result.find(item => item.path === '.clinerules/security.md')).toMatchObject({
      scope: 'root',
      activation: 'unknown',
    })
    expect(result.find(item => item.path === 'packages/api/GEMINI.md')).toMatchObject({
      scope: 'path-specific',
      activation: 'path-scoped',
      directoryScope: 'packages/api',
    })
    expect(result.find(item => item.path === '.roo/rules-code/review.md')).toMatchObject({
      scope: 'mode-specific',
      activation: 'mode-scoped',
      mode: 'code',
    })
    expect(result.find(item => item.path === '.roorules-debug')).toMatchObject({
      scope: 'mode-specific',
      activation: 'mode-scoped',
      legacy: true,
      mode: 'debug',
    })
    expect(result.find(item => item.path === '.roomodes')).toMatchObject({
      scope: 'mode-specific',
      activation: 'mode-scoped',
    })
  })

  test('adds context-friction note for large instruction files', () => {
    const result = detectInstructionSurfaces([
      { path: 'AGENTS.md', sizeBytes: 250_000 },
    ])

    expect(result[0].notes).toContain('Instruction file is large enough to create context-friction risk.')
  })

  test('classifies root and nested Codex overrides consistently', () => {
    const result = detectInstructionSurfaces([
      { path: 'AGENTS.override.md' },
      { path: 'apps/api/AGENTS.override.md' },
    ])

    expect(result.find(item => item.path === 'AGENTS.override.md')).toMatchObject({
      scope: 'root',
      activation: 'always',
      directoryScope: undefined,
    })
    expect(result.find(item => item.path === 'apps/api/AGENTS.override.md')).toMatchObject({
      scope: 'path-specific',
      activation: 'path-scoped',
      directoryScope: 'apps/api',
    })
  })

  test('detects compatible root instruction files across ecosystems', () => {
    const result = detectInstructionSurfaces([
      { path: 'CLAUDE.md' },
      { path: 'GEMINI.md' },
    ])

    expect(result.find(item => item.path === 'CLAUDE.md')?.ecosystems).toEqual([
      'claude-code',
      'github-copilot',
    ])
    expect(result.find(item => item.path === 'GEMINI.md')?.ecosystems).toEqual([
      'gemini',
      'github-copilot',
    ])
  })

  test('ignores non-instruction files under Roo rule directories', () => {
    const result = detectInstructionSurfaces([
      { path: '.roo/rules/project.md' },
      { path: '.roo/rules/assets/logo.png' },
      { path: '.roo/rules-code/review.txt' },
      { path: '.roo/rules-code/generated.json' },
    ])

    expect(result.map(item => item.path)).toEqual([
      '.roo/rules-code/review.txt',
      '.roo/rules/project.md',
    ])
    expect(result.find(item => item.path === '.roo/rules/project.md')).toMatchObject({
      scope: 'root',
      activation: 'always',
      directoryScope: undefined,
    })
  })

  test('ignores lowercase agents.md files on case-sensitive repository paths', () => {
    const result = detectInstructionSurfaces([
      { path: 'agents.md' },
      { path: 'apps/web/agents.md' },
    ])

    expect(result).toEqual([])
  })

  test('rejects paths that are not safe repository-relative paths', () => {
    const result = detectInstructionSurfaces([
      { path: '../AGENTS.md' },
      { path: '/AGENTS.md' },
      { path: 'C:\\repo\\AGENTS.md' },
      { path: '..\\CLAUDE.local.md' },
      { path: 'apps/../AGENTS.md' },
      { path: './AGENTS.md' },
      { path: 'apps/web/AGENTS.md\nREADME.md' },
      { path: 'apps/web/\u202eAGENTS.md' },
    ])

    expect(result).toEqual([])
  })

  test('strips GitHub archive root before classifying instruction scope', () => {
    const result = detectInstructionSurfaces([
      { path: 'repo-main/' },
      { path: 'repo-main/AGENTS.md', sizeBytes: 1200 },
      { path: 'repo-main/apps/web/AGENTS.md', sizeBytes: 900 },
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      path: 'AGENTS.md',
      scope: 'root',
      activation: 'always',
    })
    expect(result[1]).toMatchObject({
      path: 'apps/web/AGENTS.md',
      scope: 'path-specific',
      directoryScope: 'apps/web',
    })
  })

  test('does not infer archive root from filtered nested paths', () => {
    const result = detectInstructionSurfaces([
      { path: 'repo-main/AGENTS.md' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      path: 'repo-main/AGENTS.md',
      scope: 'path-specific',
      directoryScope: 'repo-main',
    })
  })

  test('ignores unrelated files', () => {
    const result = detectInstructionSurfaces([
      { path: 'README.md' },
      { path: 'src/agent.ts' },
      { path: '.github/workflows/ci.yml' },
    ])

    expect(result).toEqual([])
  })
})
