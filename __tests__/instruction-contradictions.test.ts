import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { detectInstructionContradictions } from '../lib/repo-readiness/detectors/instruction-contradictions'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'
import type { InstructionSurfaceEvidence } from '../lib/repo-readiness/instruction-surface-detector'

const rootScopeAlways = (path: string): InstructionSurfaceEvidence => ({
  path,
  ecosystems: ['generic-agent'],
  scope: 'root',
  activation: 'always',
  legacy: false,
  localPrivate: false,
  notes: [],
})

describe('detectInstructionContradictions (units)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-instrcontra-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): string => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
    return rel
  }

  it('flags two root, always-active instruction files that each reference a different single package manager', () => {
    const a = write('AGENTS.md', 'Install with `npm install`, then run `npm test`.')
    const b = write('CLAUDE.md', 'Install with `pnpm install`, then run `pnpm test`.')
    const evidence = detectInstructionContradictions(root, [rootScopeAlways(a), rootScopeAlways(b)])
    expect(evidence).toEqual([
      {
        kind: 'package-manager',
        paths: ['AGENTS.md', 'CLAUDE.md'],
        detail: '"AGENTS.md" references npm, but "CLAUDE.md" references pnpm.',
      },
    ])
  })

  it('does not flag two files that reference the same package manager', () => {
    const a = write('AGENTS.md', 'Run `npm install` then `npm test`.')
    const b = write('CLAUDE.md', 'Run `npm run build` first.')
    expect(detectInstructionContradictions(root, [rootScopeAlways(a), rootScopeAlways(b)])).toEqual([])
  })

  it('does not flag a file that mentions more than one package manager (plausibly discussing both on purpose)', () => {
    const a = write('AGENTS.md', 'Either `npm install` or `pnpm install` works here.')
    const b = write('CLAUDE.md', 'Run `pnpm test` before committing.')
    expect(detectInstructionContradictions(root, [rootScopeAlways(a), rootScopeAlways(b)])).toEqual([])
  })

  it('does not flag a single instruction file (nothing to contradict)', () => {
    const a = write('AGENTS.md', 'Run `npm install` then `npm test`.')
    expect(detectInstructionContradictions(root, [rootScopeAlways(a)])).toEqual([])
  })

  it('does not compare path-scoped or non-always-active instruction files', () => {
    const a = write('AGENTS.md', 'Run `npm install`.')
    const b = write('packages/app/AGENTS.md', 'Run `pnpm install` here instead.')
    const nested: InstructionSurfaceEvidence = {
      ...rootScopeAlways(b),
      scope: 'path-specific',
      activation: 'path-scoped',
    }
    expect(detectInstructionContradictions(root, [rootScopeAlways(a), nested])).toEqual([])
  })

  it('does not flag two files that mention no package manager at all', () => {
    const a = write('AGENTS.md', 'Keep changes small and reviewable.')
    const b = write('CLAUDE.md', 'Prefer explicit error handling.')
    expect(detectInstructionContradictions(root, [rootScopeAlways(a), rootScopeAlways(b)])).toEqual([])
  })

  it('does not treat a prohibited package manager as the file choosing it', () => {
    // "Never run npm install" is a prohibition, not AGENTS.md endorsing npm --
    // both files can genuinely agree on pnpm even though "npm" appears here.
    const a = write('AGENTS.md', 'Never run npm install here; use pnpm install instead.')
    const b = write('CLAUDE.md', 'Use pnpm install to set up the project.')
    expect(detectInstructionContradictions(root, [rootScopeAlways(a), rootScopeAlways(b)])).toEqual([])
  })

  it('does not treat a bare "not" contrast as the file choosing the negated manager', () => {
    // "Use pnpm, not npm install" is a contrast, not two files disagreeing --
    // "not" alone (without "do"/"does"/"should"/"will" in front of it) must
    // still suppress the negated mention.
    const a = write('AGENTS.md', 'Use pnpm, not npm install.')
    const b = write('CLAUDE.md', 'Use pnpm install to set up the project.')
    expect(detectInstructionContradictions(root, [rootScopeAlways(a), rootScopeAlways(b)])).toEqual([])
  })

  it.each([
    ['instead of', 'Use pnpm instead of npm install.'],
    ['rather than', 'Use pnpm rather than npm install.'],
  ])('does not treat a "%s" contrast as the file choosing the negated manager', (_label, text) => {
    // "Use pnpm instead of npm install" is a contrast, not two files
    // disagreeing -- bare "pnpm" is intentionally not counted as a mention,
    // so without recognizing this cue the file would be recorded as
    // choosing npm.
    const a = write('AGENTS.md', text)
    const b = write('CLAUDE.md', 'Use pnpm install to set up the project.')
    expect(detectInstructionContradictions(root, [rootScopeAlways(a), rootScopeAlways(b)])).toEqual([])
  })

  it('still flags a real mismatch when one file prohibits the other file\'s chosen manager', () => {
    // AGENTS.md only ever mentions npm positively; CLAUDE.md prohibits npm
    // and endorses pnpm -- a real disagreement (npm vs. pnpm) survives the
    // negation filter, which only suppresses the negated mention itself.
    const a = write('AGENTS.md', 'Install with `npm install`, then run `npm test`.')
    const b = write('CLAUDE.md', "Don't run npm install; use pnpm install instead.")
    const evidence = detectInstructionContradictions(root, [rootScopeAlways(a), rootScopeAlways(b)])
    expect(evidence).toEqual([
      {
        kind: 'package-manager',
        paths: ['AGENTS.md', 'CLAUDE.md'],
        detail: '"AGENTS.md" references npm, but "CLAUDE.md" references pnpm.',
      },
    ])
  })

  it('does not flag two root/always-active files with no overlapping ecosystem', () => {
    // Real ecosystems from instruction-surface-detector.ts: root AGENTS.md is
    // codex/github-copilot/cursor/windsurf/cline/generic-agent; .claude/CLAUDE.md
    // is claude-code only. No single agent loads both, so a "mismatch" between
    // them is not something any agent would actually hit.
    const a = write('AGENTS.md', 'Install with `npm install`, then run `npm test`.')
    const b = write('.claude/CLAUDE.md', 'Install with `pnpm install`, then run `pnpm test`.')
    const agentsMd: InstructionSurfaceEvidence = {
      ...rootScopeAlways(a),
      ecosystems: ['codex', 'github-copilot', 'cursor', 'windsurf', 'cline', 'generic-agent'],
    }
    const claudeMd: InstructionSurfaceEvidence = { ...rootScopeAlways(b), ecosystems: ['claude-code'] }
    expect(detectInstructionContradictions(root, [agentsMd, claudeMd])).toEqual([])
  })

  it('still flags root, always-active files that share at least one ecosystem', () => {
    // Root AGENTS.md and root CLAUDE.md both list github-copilot, so GitHub
    // Copilot CLI genuinely loads both at once -- the contradiction is real.
    const a = write('AGENTS.md', 'Install with `npm install`, then run `npm test`.')
    const b = write('CLAUDE.md', 'Install with `pnpm install`, then run `pnpm test`.')
    const agentsMd: InstructionSurfaceEvidence = {
      ...rootScopeAlways(a),
      ecosystems: ['codex', 'github-copilot', 'cursor', 'windsurf', 'cline', 'generic-agent'],
    }
    const claudeMd: InstructionSurfaceEvidence = { ...rootScopeAlways(b), ecosystems: ['claude-code', 'github-copilot'] }
    expect(detectInstructionContradictions(root, [agentsMd, claudeMd])).toEqual([
      {
        kind: 'package-manager',
        paths: ['AGENTS.md', 'CLAUDE.md'],
        detail: '"AGENTS.md" references npm, but "CLAUDE.md" references pnpm.',
      },
    ])
  })

  it('flags a legacy always-active rule file against a root file sharing its ecosystem', () => {
    // .cursorrules is scope: 'legacy' (not 'root'), but it's activation:
    // 'always' and shares the "cursor" ecosystem with root AGENTS.md -- a
    // Cursor user genuinely sees both loaded at once, so a mismatch here is
    // exactly as real as a root/root one.
    const a = write('AGENTS.md', 'Install with `npm install`, then run `npm test`.')
    const b = write('.cursorrules', 'Install with `pnpm install`, then run `pnpm test`.')
    const agentsMd: InstructionSurfaceEvidence = {
      ...rootScopeAlways(a),
      ecosystems: ['codex', 'github-copilot', 'cursor', 'windsurf', 'cline', 'generic-agent'],
    }
    const cursorrules: InstructionSurfaceEvidence = {
      ...rootScopeAlways(b),
      ecosystems: ['cursor', 'cline'],
      scope: 'legacy',
      legacy: true,
    }
    expect(detectInstructionContradictions(root, [agentsMd, cursorrules])).toEqual([
      {
        kind: 'package-manager',
        paths: ['.cursorrules', 'AGENTS.md'],
        detail: '".cursorrules" references pnpm, but "AGENTS.md" references npm.',
      },
    ])
  })
})

describe('instructions.contradiction finding (integration)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-instrcontra-int-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): void => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  it('emits a warning finding when AGENTS.md and CLAUDE.md disagree on package manager', () => {
    write('README.md', '# demo\n')
    write('AGENTS.md', 'Install with `npm install`.\n')
    write('CLAUDE.md', 'Install with `pnpm install`.\n')
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    const finding = report.findings.find(f => f.id.startsWith('instructions.contradiction.package-manager'))
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('warning')
    expect(report.instructionContradictions).toEqual([
      {
        kind: 'package-manager',
        paths: ['AGENTS.md', 'CLAUDE.md'],
        detail: '"AGENTS.md" references npm, but "CLAUDE.md" references pnpm.',
      },
    ])
  })

  it('emits no contradiction finding when instruction files agree', () => {
    write('README.md', '# demo\n')
    write('AGENTS.md', 'Install with `npm install`.\n')
    write('CLAUDE.md', 'Run `npm test` before committing.\n')
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    expect(report.instructionContradictions).toEqual([])
    expect(report.findings.some(f => f.id.startsWith('instructions.contradiction'))).toBe(false)
  })

  it('escalates to error under errorOnWarnings, like every other warning-level rule', () => {
    write('README.md', '# demo\n')
    write('AGENTS.md', 'Install with `npm install`.\n')
    write('CLAUDE.md', 'Install with `pnpm install`.\n')
    const report = scanLocalReadiness(root, {
      now: new Date('2026-05-30T00:00:00.000Z'),
      config: { errorOnWarnings: true },
    })
    const finding = report.findings.find(f => f.id.startsWith('instructions.contradiction.package-manager'))
    expect(finding?.severity).toBe('error')
  })
})
