import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  detectCapabilitySurfaces,
  detectHookExecutionRisks,
  detectSafetySignals,
  scanLocalReadiness,
  validateLocalReadinessReportContract,
} from '../lib/repo-readiness'

const fixedNow = new Date('2026-05-23T00:00:00.000Z')

const createTempRepo = (): string => mkdtempSync(path.join(tmpdir(), 'agentready-cap-'))

const writeRepoFile = (root: string, repoPath: string, content: string): void => {
  const absolutePath = path.join(root, repoPath)
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

describe('capability-surface detector', () => {
  test('recognizes MCP, skill, hook, plugin, and LSP surfaces, classified by risk tier', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.mcp.json', '{}\n')
      writeRepoFile(root, '.cursor/mcp.json', '{}\n')
      writeRepoFile(root, '.vscode/mcp.json', '{}\n')
      writeRepoFile(root, '.claude/skills/review/SKILL.md', '# review\n')
      writeRepoFile(root, '.claude/settings.json', JSON.stringify({ hooks: { PreToolUse: [{ matcher: '*', hooks: [] }] } }))
      writeRepoFile(root, '.claude/settings.local.json', JSON.stringify({ permissions: { allow: ['Bash'] } }))
      writeRepoFile(root, '.claude/hooks/pre-commit.sh', '#!/bin/sh\n')
      writeRepoFile(root, '.claude-plugin/plugin.json', '{}\n')
      writeRepoFile(root, '.claude-plugin/marketplace.json', '{}\n')
      writeRepoFile(root, '.vscode/settings.json', '{}\n')
      writeRepoFile(root, '.vscode/extensions.json', '{}\n')
      writeRepoFile(root, '.editorconfig', 'root = true\n')
      writeRepoFile(root, 'src/index.ts', 'export {}\n')

      const capabilities = detectCapabilitySurfaces(root, [
        '.mcp.json',
        '.cursor/mcp.json',
        '.vscode/mcp.json',
        '.claude/skills/review/SKILL.md',
        '.claude/settings.json',
        '.claude/settings.local.json',
        '.claude/hooks/pre-commit.sh',
        '.claude-plugin/plugin.json',
        '.claude-plugin/marketplace.json',
        '.vscode/settings.json',
        '.vscode/extensions.json',
        '.editorconfig',
        'src/index.ts',
      ])

      const byKind = (kind: string): string[] => capabilities.filter(c => c.kind === kind).map(c => c.path)
      const riskOf = (repoPath: string): string | undefined => capabilities.find(c => c.path === repoPath)?.riskTier

      expect(byKind('mcp')).toEqual(['.cursor/mcp.json', '.mcp.json', '.vscode/mcp.json'])
      expect(byKind('skill')).toEqual(['.claude/skills/review/SKILL.md'])
      expect(byKind('hook')).toEqual(['.claude/hooks/pre-commit.sh', '.claude/settings.json', '.claude/settings.local.json'])
      expect(byKind('plugin')).toEqual(['.claude-plugin/marketplace.json', '.claude-plugin/plugin.json'])
      expect(byKind('lsp')).toEqual(['.editorconfig', '.vscode/extensions.json', '.vscode/settings.json'])
      expect(capabilities.every(c => typeof c.tool === 'string' && c.notes.length > 0)).toBe(true)

      // High: arbitrary-command/unverifiable-tool-set surfaces.
      expect(riskOf('.mcp.json')).toBe('high')
      expect(riskOf('.cursor/mcp.json')).toBe('high')
      expect(riskOf('.vscode/mcp.json')).toBe('high')
      expect(riskOf('.claude/hooks/pre-commit.sh')).toBe('high')
      expect(riskOf('.claude-plugin/plugin.json')).toBe('high')
      expect(riskOf('.claude-plugin/marketplace.json')).toBe('high')
      expect(riskOf('.claude/settings.json')).toBe('high') // configures a non-empty hooks block
      // Medium: settings config with no hooks configured.
      expect(riskOf('.claude/settings.local.json')).toBe('medium')
      // Low: no execution surface.
      expect(riskOf('.claude/skills/review/SKILL.md')).toBe('low')
      expect(riskOf('.editorconfig')).toBe('low')
      expect(riskOf('.vscode/settings.json')).toBe('low')
      expect(riskOf('.vscode/extensions.json')).toBe('low')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('ignores unrelated files', () => {
    expect(detectCapabilitySurfaces('/unused-root', ['README.md', 'src/index.ts', 'package.json'])).toEqual([])
  })

  test('classifies .claude/settings.json risk from its own content, not just its presence', () => {
    const root = createTempRepo()
    try {
      const riskOf = (): string | undefined => detectCapabilitySurfaces(root, ['.claude/settings.json'])[0]?.riskTier

      writeRepoFile(root, '.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash'] } }))
      expect(riskOf()).toBe('medium')

      writeRepoFile(root, '.claude/settings.json', JSON.stringify({ hooks: {} }))
      expect(riskOf()).toBe('medium') // present but empty: no hook actually configured

      writeRepoFile(root, '.claude/settings.json', JSON.stringify({ hooks: { PreToolUse: [] } }))
      expect(riskOf()).toBe('medium') // empty matcher-group array: no hook actually configured

      writeRepoFile(root, '.claude/settings.json', JSON.stringify({ hooks: { PreToolUse: [{ matcher: '*', hooks: [] }] } }))
      expect(riskOf()).toBe('high') // non-empty matcher-group array: a real hook is configured

      writeRepoFile(root, '.claude/settings.json', 'not valid json')
      expect(riskOf()).toBe('medium') // unparsable: fall back rather than guess
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('falls back to medium for a settings path that does not exist on disk', () => {
    const capabilities = detectCapabilitySurfaces(path.join(tmpdir(), 'agentready-cap-missing'), ['.claude/settings.json'])
    expect(capabilities[0].riskTier).toBe('medium')
  })
})

describe('safety-signal detector', () => {
  test('flags install hooks, destructive, network-exec, and deploy commands', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, 'package.json', JSON.stringify({
        scripts: {
          test: 'jest',
          postinstall: 'node ./scripts/setup.js',
          clean: 'rm -rf /tmp/build',
          bootstrap: 'curl https://example.com/install.sh | bash',
          release: 'npm publish',
          ship: 'vercel deploy',
        },
      }))

      const signals = detectSafetySignals(root, ['package.json'])
      const byCategory = (category: string): string[] => signals.filter(s => s.category === category).map(s => s.script)

      expect(byCategory('install-hook')).toEqual(['postinstall'])
      expect(byCategory('destructive')).toEqual(['clean'])
      expect(byCategory('network-exec')).toEqual(['bootstrap'])
      expect(byCategory('deploy').sort()).toEqual(['release', 'ship'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('returns nothing for safe, ordinary scripts', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, 'package.json', JSON.stringify({
        scripts: { build: 'tsc', lint: 'eslint .', test: 'jest' },
      }))
      expect(detectSafetySignals(root, ['package.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not classify publish-only lifecycle scripts as install hooks', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, 'package.json', JSON.stringify({
        scripts: {
          prepublishOnly: 'npm run build',
          prepack: 'npm run build',
          postpack: 'node ./scripts/after-pack.js',
          postpublish: 'node ./scripts/after-publish.js',
        },
      }))
      expect(detectSafetySignals(root, ['package.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('returns nothing when there is no package.json', () => {
    const root = createTempRepo()
    try {
      expect(detectSafetySignals(root, [])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('ignores package.json that is absent from the filtered inventory', () => {
    const root = createTempRepo()
    try {
      // The manifest exists on disk with a dangerous script, but the scan
      // inventory excludes it (e.g. via ignorePaths), so no signal is emitted.
      writeRepoFile(root, 'package.json', JSON.stringify({
        scripts: { postinstall: 'curl https://example.com/x.sh | bash' },
      }))
      expect(detectSafetySignals(root, ['README.md'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

const claudeSettingsWithHook = (event: string, command: string): string =>
  JSON.stringify({ hooks: { [event]: [{ matcher: '', hooks: [{ type: 'command', command }] }] } })

describe('hook-execution-risk detector', () => {
  test('flags a SessionStart hook that runs a package-manager install command', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'pnpm install --frozen-lockfile && pnpm prisma generate'))
      const risks = detectHookExecutionRisks(root, ['.claude/settings.json'])
      // Only the install segment is reported -- "pnpm prisma generate" is a
      // separate chained command that doesn't match the install pattern.
      expect(risks).toEqual([
        {
          path: '.claude/settings.json',
          event: 'SessionStart',
          command: 'pnpm install --frozen-lockfile',
        },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('evaluates each chained command segment independently: a safe first install does not mask an unsafe second one', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'npm install --ignore-scripts && pnpm install'))
      const risks = detectHookExecutionRisks(root, ['.claude/settings.json'])
      expect(risks).toEqual([
        { path: '.claude/settings.json', event: 'SessionStart', command: 'pnpm install' },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('deduplicates identical (path, event, command) evidence from separate matcher groups', () => {
    const root = createTempRepo()
    try {
      const settings = JSON.stringify({
        hooks: {
          SessionStart: [
            { matcher: '', hooks: [{ type: 'command', command: 'npm install' }] },
            { matcher: '', hooks: [{ type: 'command', command: 'npm install' }] },
          ],
        },
      })
      writeRepoFile(root, '.claude/settings.json', settings)
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([
        { path: '.claude/settings.json', event: 'SessionStart', command: 'npm install' },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('flags npm\'s "i" install alias, not just the full "install" word', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'npm i'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([
        { path: '.claude/settings.json', event: 'SessionStart', command: 'npm i' },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not flag yarn\'s "i" (yarn has no such install alias)', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'yarn i'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not flag an install command that explicitly disables lifecycle scripts (--ignore-scripts)', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'bun install --ignore-scripts'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('flags an install command that explicitly negates --ignore-scripts (=false)', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'npm install --ignore-scripts=false'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([
        { path: '.claude/settings.json', event: 'SessionStart', command: 'npm install --ignore-scripts=false' },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('flags a repeated --ignore-scripts flag using the last (effective) value, not the first', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(
        root,
        '.claude/settings.json',
        claudeSettingsWithHook('SessionStart', 'npm install --ignore-scripts --ignore-scripts=false'),
      )
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([
        { path: '.claude/settings.json', event: 'SessionStart', command: 'npm install --ignore-scripts --ignore-scripts=false' },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not flag when a repeated --ignore-scripts flag\'s last value is the suppressing one', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(
        root,
        '.claude/settings.json',
        claudeSettingsWithHook('SessionStart', 'npm install --ignore-scripts=false --ignore-scripts'),
      )
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('flags an install command with a global option (attached value) before the subcommand', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'npm --loglevel=silent install'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([
        { path: '.claude/settings.json', event: 'SessionStart', command: 'npm --loglevel=silent install' },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not flag when a global option before install explicitly disables lifecycle scripts', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'npm --ignore-scripts install'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('still does not match a global option before install when a space-separated flag value is used (known limitation)', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'npm --workspace packages/app install'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('also checks .claude/settings.local.json', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.local.json', claudeSettingsWithHook('SessionStart', 'npm ci'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.local.json'])).toEqual([
        { path: '.claude/settings.local.json', event: 'SessionStart', command: 'npm ci' },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not flag a hook that requires explicit user invocation (e.g. PreToolUse)', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('PreToolUse', 'pnpm install'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not flag an automatic hook whose command is not an install/lifecycle command', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'echo "session started"'))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('returns nothing when the settings file is absent from the filtered inventory', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'pnpm install'))
      expect(detectHookExecutionRisks(root, ['README.md'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not throw on an unparsable settings file', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', '{ not valid json')
      expect(() => detectHookExecutionRisks(root, ['.claude/settings.json'])).not.toThrow()
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('returns nothing when there are no hooks configured', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, '.claude/settings.json', JSON.stringify({ permissions: {} }))
      expect(detectHookExecutionRisks(root, ['.claude/settings.json'])).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('scan integration', () => {
  test('surfaces capabilities and safety findings in the full report', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, 'README.md', '# Demo\n')
      writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
      writeRepoFile(root, '.github/workflows/ci.yml', 'name: CI\n')
      writeRepoFile(root, '.mcp.json', '{}\n')
      writeRepoFile(root, 'package.json', JSON.stringify({
        scripts: {
          lint: 'eslint .',
          test: 'jest',
          postinstall: 'node ./scripts/setup.js',
          deploy: 'rm -rf dist && vercel deploy',
        },
      }))

      const report = scanLocalReadiness(root, { now: fixedNow })

      expect(report.capabilities.map(c => c.path)).toContain('.mcp.json')
      expect(report.capabilities.find(c => c.path === '.mcp.json')?.riskTier).toBe('high')
      const findingIds = report.findings.map(f => f.id)
      expect(findingIds).toContain('safety.install-hook:package.json#scripts.postinstall')
      expect(findingIds).toContain('safety.deploy:package.json#scripts.deploy')
      expect(findingIds).toContain('safety.destructive:package.json#scripts.deploy')

      const installFinding = report.findings.find(f => f.id === 'safety.install-hook:package.json#scripts.postinstall')
      expect(installFinding?.severity).toBe('info')
      const destructiveFinding = report.findings.find(f => f.id === 'safety.destructive:package.json#scripts.deploy')
      expect(destructiveFinding?.severity).toBe('warning')

      expect(validateLocalReadinessReportContract(report)).toEqual({ valid: true, errors: [] })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('surfaces the composite agent-hook finding when a SessionStart hook runs an install command', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, 'README.md', '# Demo\n')
      writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
      writeRepoFile(root, '.claude/settings.json', claudeSettingsWithHook('SessionStart', 'pnpm install --frozen-lockfile'))

      const report = scanLocalReadiness(root, { now: fixedNow })
      const finding = report.findings.find(f => f.id === 'safety.agent-hook.executes-repository-code:.claude/settings.json:SessionStart:pnpm install --frozen-lockfile')
      expect(finding).toMatchObject({ severity: 'warning', path: '.claude/settings.json' })
      expect(finding?.recommendation).toContain('pnpm install --frozen-lockfile')

      expect(validateLocalReadinessReportContract(report)).toEqual({ valid: true, errors: [] })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('gives two distinct SessionStart install commands in the same file distinct finding ids', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, 'README.md', '# Demo\n')
      writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
      const settings = JSON.stringify({
        hooks: {
          SessionStart: [
            { matcher: '', hooks: [{ type: 'command', command: 'npm install' }] },
            { matcher: '', hooks: [{ type: 'command', command: 'npm run postinstall-check && npm ci' }] },
          ],
        },
      })
      writeRepoFile(root, '.claude/settings.json', settings)

      const report = scanLocalReadiness(root, { now: fixedNow })
      const ids = report.findings
        .filter(f => f.id.startsWith('safety.agent-hook.executes-repository-code:'))
        .map(f => f.id)
      expect(ids).toHaveLength(2)
      expect(new Set(ids).size).toBe(2)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('flags a high-risk capability surface but not a low/medium-risk one', () => {
    const root = createTempRepo()
    try {
      writeRepoFile(root, 'README.md', '# Demo\n')
      writeRepoFile(root, 'AGENTS.md', 'Run npm test.\n')
      writeRepoFile(root, '.mcp.json', '{}\n')
      writeRepoFile(root, '.editorconfig', 'root = true\n')

      const report = scanLocalReadiness(root, { now: fixedNow })
      const findingIds = report.findings.map(f => f.id)

      expect(findingIds).toContain('safety.capability.high-risk:.mcp.json')
      expect(findingIds).not.toContain('safety.capability.high-risk:.editorconfig')
      const finding = report.findings.find(f => f.id === 'safety.capability.high-risk:.mcp.json')
      expect(finding?.severity).toBe('info')

      expect(validateLocalReadinessReportContract(report)).toEqual({ valid: true, errors: [] })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
