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
