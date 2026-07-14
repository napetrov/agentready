import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { detectCodeownersCoverageGaps, detectGovernance } from '../lib/repo-readiness/detectors/governance'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'

const runGit = (root: string, args: string[]): void => {
  // Disable commit signing so isolated fixture repositories can commit without
  // the host's global signing configuration.
  execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
}

const initGitRepo = (root: string): void => {
  runGit(root, ['init', '--initial-branch=main'])
  runGit(root, ['config', 'user.email', 'agentready@example.com'])
  runGit(root, ['config', 'user.name', 'AgentReady Test'])
}

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

  it('prefers the root CODEOWNERS over .github/ and docs/ when multiple exist, regardless of input order', () => {
    // GitHub honors exactly one CODEOWNERS by root > .github/ > docs/
    // precedence. ".github/CODEOWNERS" sorts before "CODEOWNERS"
    // lexicographically, so this also guards against silently picking
    // whatever happens to sort first in the walker's file list.
    expect(
      detectGovernance(['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']).codeownersPath,
    ).toBe('CODEOWNERS')
  })

  it('prefers .github/CODEOWNERS over docs/CODEOWNERS when no root file exists', () => {
    expect(detectGovernance(['docs/CODEOWNERS', '.github/CODEOWNERS']).codeownersPath).toBe('.github/CODEOWNERS')
  })

  it.each([
    ['root pull_request_template.md', 'pull_request_template.md'],
    ['.github/pull_request_template.md', '.github/pull_request_template.md'],
    ['.github/PULL_REQUEST_TEMPLATE.md', '.github/PULL_REQUEST_TEMPLATE.md'],
    ['docs/pull_request_template.md', 'docs/pull_request_template.md'],
    ['a template inside .github/PULL_REQUEST_TEMPLATE/', '.github/PULL_REQUEST_TEMPLATE/bug.md'],
    ['a template inside root PULL_REQUEST_TEMPLATE/', 'PULL_REQUEST_TEMPLATE/bug.md'],
    ['a template inside docs/PULL_REQUEST_TEMPLATE/', 'docs/PULL_REQUEST_TEMPLATE/bug.md'],
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

describe('detectCodeownersCoverageGaps (units)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-ownership-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): void => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  const commitFile = (rel: string, content: string): void => {
    write(rel, content)
    runGit(root, ['add', rel])
    runGit(root, ['commit', '-m', `add ${rel}`])
  }

  const srcFilePaths = (count: number): string[] => Array.from({ length: count }, (_, i) => `src/file-${i}.ts`)

  it('is undefined when there is no CODEOWNERS path', () => {
    initGitRepo(root)
    commitFile('README.md', '# demo\n')
    expect(detectCodeownersCoverageGaps(root, undefined, ['README.md'])).toBeUndefined()
  })

  it('is undefined when the scan target is not a git repository', () => {
    write('CODEOWNERS', '/docs/ @doc-owner\n')
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS'])).toBeUndefined()
  })

  it('flags a top-level directory with sustained recent activity that CODEOWNERS does not cover', () => {
    initGitRepo(root)
    commitFile('CODEOWNERS', '/docs/ @doc-owner\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
  })

  it('does not flag a directory CODEOWNERS already covers', () => {
    initGitRepo(root)
    commitFile('CODEOWNERS', '/src/ @src-owner\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toBeUndefined()
  })

  it('flags a directory whose only matching CODEOWNERS line has no owner', () => {
    // "/src/" with no trailing @owner is an invalid GitHub CODEOWNERS rule --
    // GitHub assigns no owner to matching files, so it must not count as
    // coverage just because the pattern itself would match.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/src/\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
  })

  it('flags a directory whose only matching CODEOWNERS line has a placeholder second token instead of a real owner', () => {
    // A second token that isn't a real owner (no "@user"/"@org/team"/email
    // shape) is just as invalid to GitHub as no second token at all --
    // "/src/ TODO" must not count as coverage either.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/src/ TODO\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
  })

  it('covers a directory whose CODEOWNERS line uses an email owner', () => {
    initGitRepo(root)
    commitFile('CODEOWNERS', '/src/ owner@example.com\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toBeUndefined()
  })

  it('does not flag a directory below the sustained-activity threshold', () => {
    initGitRepo(root)
    commitFile('CODEOWNERS', '/docs/ @doc-owner\n')
    for (let i = 0; i < 4; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(4)])).toBeUndefined()
  })

  it('a wildcard CODEOWNERS pattern covers every directory', () => {
    initGitRepo(root)
    commitFile('CODEOWNERS', '* @everyone\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toBeUndefined()
  })

  it('does not count a single bulk commit touching many files as sustained activity', () => {
    // One commit adding 5 files under src/ produces 5 --name-only path lines,
    // but only one distinct commit -- below the MIN_DIRECTORY_COMMITS floor.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/docs/ @doc-owner\n')
    for (let i = 0; i < 5; i += 1) {
      write(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    runGit(root, ['add', 'src'])
    runGit(root, ['commit', '-m', 'bulk import'])
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toBeUndefined()
  })

  it('recognizes a file-glob CODEOWNERS pattern as covering the files it actually matches', () => {
    // "*.ts @team" matches file paths, not the bare "src/" directory name --
    // the directory must not be flagged just because a directory-shaped check
    // against the pattern would miss it.
    initGitRepo(root)
    commitFile('CODEOWNERS', '*.ts @ts-owner\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toBeUndefined()
  })

  it('still flags a directory whose file-glob-covered pattern does not match its actual files', () => {
    initGitRepo(root)
    commitFile('CODEOWNERS', '*.py @py-owner\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
  })

  it('does not flag a directory absent from the current scan inventory (ignored or since deleted)', () => {
    // Git history alone can't distinguish "excluded by ignorePaths/.gitignore"
    // from "deleted from the working tree since" -- both mean the directory
    // is outside what the rest of the scan actually looks at, so neither
    // should surface a coverage-gap finding for it.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/docs/ @doc-owner\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS'])).toBeUndefined()
  })
})

describe('docs.codeowners.coverage-gap finding (integration)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-ownership-int-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const write = (rel: string, content: string): void => {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  const commitFile = (rel: string, content: string): void => {
    write(rel, content)
    runGit(root, ['add', rel])
    runGit(root, ['commit', '-m', `add ${rel}`])
  }

  it('emits an info finding when CODEOWNERS misses an actively-changed directory', () => {
    initGitRepo(root)
    commitFile('README.md', '# demo\n')
    commitFile('CODEOWNERS', '/docs/ @doc-owner\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    const finding = report.findings.find(f => f.id === 'docs.codeowners.coverage-gap:src')
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('info')
    expect(finding?.path).toBe('src')
    expect(report.governance.uncoveredActiveDirectories).toEqual(['src'])
  })

  it('emits no coverage-gap finding when CODEOWNERS covers the active directory', () => {
    initGitRepo(root)
    commitFile('README.md', '# demo\n')
    commitFile('CODEOWNERS', '/src/ @src-owner\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    expect(report.findings.map(f => f.id)).not.toContain('docs.codeowners.coverage-gap:src')
    expect(report.governance.uncoveredActiveDirectories).toBeUndefined()
  })

  it('emits one finding per uncovered directory, distinguishable by path in a diff', () => {
    // Regression for the diff-fidelity bug: findingKey is id+path, so a
    // single constant-id aggregate finding would make base ["src"] and head
    // ["src", "docs"] compare equal, hiding the newly-uncovered directory.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/vendor/ @vendor-owner\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
      commitFile(`docs/page-${i}.md`, `# page ${i}\n`)
    }
    const report = scanLocalReadiness(root, { now: new Date('2026-05-30T00:00:00.000Z') })
    const gapFindings = report.findings.filter(f => f.id.startsWith('docs.codeowners.coverage-gap:'))
    expect(gapFindings.map(f => f.id).sort()).toEqual([
      'docs.codeowners.coverage-gap:docs',
      'docs.codeowners.coverage-gap:src',
    ])
    expect(gapFindings.map(f => f.path).sort()).toEqual(['docs', 'src'])
  })
})
