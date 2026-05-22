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
  })

  test('detects tool-specific and legacy rule surfaces', () => {
    const result = detectInstructionSurfaces([
      { path: '.github/copilot-instructions.md' },
      { path: '.github/instructions/react.instructions.md' },
      { path: '.github/agents/reviewer.agent.md' },
      { path: '.cursor/rules/frontend.mdc' },
      { path: '.cursorrules' },
      { path: 'GEMINI.md' },
      { path: '.windsurf/rules/project.md' },
      { path: '.windsurfrules' },
      { path: '.clinerules/security.md' },
      { path: '.roo/rules-code/review.md' },
      { path: '.roorules-debug' },
    ])

    expect(result.find(item => item.path === '.github/copilot-instructions.md')).toMatchObject({
      ecosystems: ['github-copilot'],
      scope: 'root',
    })
    expect(result.find(item => item.path === '.github/agents/reviewer.agent.md')).toMatchObject({
      scope: 'capability',
      activation: 'manual',
    })
    expect(result.find(item => item.path === '.cursorrules')).toMatchObject({
      legacy: true,
      scope: 'legacy',
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
  })

  test('adds context-friction note for large instruction files', () => {
    const result = detectInstructionSurfaces([
      { path: 'AGENTS.md', sizeBytes: 250_000 },
    ])

    expect(result[0].notes).toContain('Instruction file is large enough to create context-friction risk.')
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
