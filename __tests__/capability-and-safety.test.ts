import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  detectCapabilitySurfaces,
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
  test('recognizes MCP, skill, hook, plugin, and LSP surfaces', () => {
    const capabilities = detectCapabilitySurfaces([
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

    expect(byKind('mcp')).toEqual(['.cursor/mcp.json', '.mcp.json', '.vscode/mcp.json'])
    expect(byKind('skill')).toEqual(['.claude/skills/review/SKILL.md'])
    expect(byKind('hook')).toEqual(['.claude/hooks/pre-commit.sh', '.claude/settings.json', '.claude/settings.local.json'])
    expect(byKind('plugin')).toEqual(['.claude-plugin/marketplace.json', '.claude-plugin/plugin.json'])
    expect(byKind('lsp')).toEqual(['.editorconfig', '.vscode/extensions.json', '.vscode/settings.json'])
    expect(capabilities.every(c => typeof c.tool === 'string' && c.notes.length > 0)).toBe(true)
  })

  test('ignores unrelated files', () => {
    expect(detectCapabilitySurfaces(['README.md', 'src/index.ts', 'package.json'])).toEqual([])
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

      const signals = detectSafetySignals(root)
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
      expect(detectSafetySignals(root)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('returns nothing when there is no package.json', () => {
    const root = createTempRepo()
    try {
      expect(detectSafetySignals(root)).toEqual([])
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
})
