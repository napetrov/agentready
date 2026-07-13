import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { detectGovernance } from '../lib/repo-readiness/detectors/governance'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

describe('detectGovernance (units)', () => {
  it('finds nothing in a repo with neither surface', () => {
    expect(detectGovernance(['README.md', 'src/index.ts'])).toEqual({})
  })

  it.each([
    ['CODEOWNERS', 'CODEOWNERS'],
    ['.github/CODEOWNERS', '.github/CODEOWNERS'],
    ['docs/CODEOWNERS', 'docs/CODEOWNERS'],
    ['codeowners (case-insensitive)', 'CodeOwners'],
  ])('finds CODEOWNERS at a GitHub-recognized location: %s', (_label, filePath) => {
    expect(detectGovernance([filePath]).codeownersPath).toBe(filePath)
  })

  it('does not treat a nested/unrecognized CODEOWNERS-like path as a match', () => {
    expect(detectGovernance(['src/CODEOWNERS', 'CODEOWNERS.md']).codeownersPath).toBeUndefined()
  })

  it.each([
    ['root pull_request_template.md', 'pull_request_template.md'],
    ['.github/pull_request_template.md', '.github/pull_request_template.md'],
    ['.github/PULL_REQUEST_TEMPLATE.md', '.github/PULL_REQUEST_TEMPLATE.md'],
    ['docs/pull_request_template.md', 'docs/pull_request_template.md'],
    ['a template inside .github/PULL_REQUEST_TEMPLATE/', '.github/PULL_REQUEST_TEMPLATE/bug.md'],
  ])('finds a PR template at a GitHub-recognized location: %s', (_label, filePath) => {
    expect(detectGovernance([filePath]).pullRequestTemplatePath).toBe(filePath)
  })

  it('does not treat a nested/unrecognized template path as a match', () => {
    expect(detectGovernance(['src/pull_request_template.md']).pullRequestTemplatePath).toBeUndefined()
  })

  it('finds both surfaces independently when both are present', () => {
    const evidence = detectGovernance(['.github/CODEOWNERS', '.github/pull_request_template.md', 'README.md'])
    expect(evidence).toEqual({
      codeownersPath: '.github/CODEOWNERS',
      pullRequestTemplatePath: '.github/pull_request_template.md',
    })
  })
})

describe('governance findings (integration)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-governance-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): void => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  it('flags a missing PR template regardless of repo size', () => {
    write('README.md', '# demo\n')
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    expect(report.findings.map(f => f.id)).toContain('docs.pull-request-template.missing')
  })

  it('does not flag missing CODEOWNERS for a trivial (<=20 source file) repo', () => {
    write('README.md', '# demo\n')
    write('src/index.ts', 'export const x = 1\n')
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    expect(report.findings.map(f => f.id)).not.toContain('docs.codeowners.missing')
  })

  it('flags a missing CODEOWNERS for a non-trivial (>20 source file) repo', () => {
    write('README.md', '# demo\n')
    for (let i = 0; i < 21; i += 1) {
      write(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    expect(report.findings.map(f => f.id)).toContain('docs.codeowners.missing')
  })

  it('emits neither finding when both surfaces are present', () => {
    write('README.md', '# demo\n')
    write('CODEOWNERS', '* @someone\n')
    write('.github/pull_request_template.md', '## What changed\n')
    for (let i = 0; i < 21; i += 1) {
      write(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    const ids = report.findings.map(f => f.id)
    expect(ids).not.toContain('docs.codeowners.missing')
    expect(ids).not.toContain('docs.pull-request-template.missing')
    expect(report.governance).toEqual({ codeownersPath: 'CODEOWNERS', pullRequestTemplatePath: '.github/pull_request_template.md' })
  })
})
