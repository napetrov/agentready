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
  ])('finds CODEOWNERS at a GitHub-recognized location: %s', (_label, filePath) => {
    expect(detectGovernance([filePath]).codeownersPath).toBe(filePath)
  })

  it('does not treat a nested/unrecognized CODEOWNERS-like path as a match', () => {
    expect(detectGovernance(['src/CODEOWNERS', 'CODEOWNERS.md']).codeownersPath).toBeUndefined()
  })

  it('does not recognize an incorrectly-cased "CodeOwners" as CODEOWNERS (GitHub\'s file lookup is case-sensitive)', () => {
    expect(detectGovernance(['CodeOwners']).codeownersPath).toBeUndefined()
  })

  it('prefers .github/CODEOWNERS over root and docs/ when multiple exist, regardless of input order', () => {
    // GitHub honors exactly one CODEOWNERS by .github/ > root > docs/
    // precedence (github.com/en/repositories/managing-your-repositorys-
    // settings-and-features/customizing-your-repository/about-code-owners).
    // ".github/CODEOWNERS" also sorts before "CODEOWNERS" lexicographically,
    // so this partially coincides with -- but must not be confused for --
    // just picking whatever happens to sort first in the walker's file list.
    expect(
      detectGovernance(['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']).codeownersPath,
    ).toBe('.github/CODEOWNERS')
  })

  it('prefers the root CODEOWNERS over docs/ when no .github/ file exists', () => {
    expect(detectGovernance(['docs/CODEOWNERS', 'CODEOWNERS']).codeownersPath).toBe('CODEOWNERS')
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
    // shape) makes the whole line invalid syntax GitHub skips -- it is not a
    // valid ownerless override, but with no other pattern matching this
    // directory, the net effect is the same: uncovered.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/src/ TODO\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
  })

  it('leaves a broader owned pattern in effect when a later line has an invalid placeholder instead of a real or no owner', () => {
    // Unlike a truly ownerless line ("/apps/github" with zero tokens after
    // the pattern), "/src/ TODO" is invalid CODEOWNERS syntax -- GitHub skips
    // the whole line rather than treating it as an intentional override, so
    // the broader "* @team" rule above it still covers src.
    initGitRepo(root)
    commitFile('CODEOWNERS', '* @team\n/src/ TODO\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toBeUndefined()
  })

  it('flags a directory whose only matching CODEOWNERS line mixes a real owner with an invalid placeholder token', () => {
    // GitHub skips a line as invalid syntax as a whole -- "/src/ @team TODO"
    // does not apply "@team" just because one of the two trailing tokens is
    // a valid owner shape; every trailing token must be a plausible owner.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/src/ @team TODO\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
  })

  it('does not let a differently-cased CODEOWNERS pattern cover a directory (GitHub matches case-sensitively)', () => {
    // GitHub evaluates CODEOWNERS patterns against its case-sensitive backing
    // filesystem, but the `ignore` package defaults to case-insensitive
    // matching -- "/Src/ @team" must not be treated as covering "src/*.ts".
    initGitRepo(root)
    commitFile('CODEOWNERS', '/Src/ @team\n')
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

  it('reads a CODEOWNERS file past the old 200KB cutoff, up to GitHub\'s real ~3MiB limit', () => {
    // GitHub documents a 3 MiB CODEOWNERS size limit, not 200KB -- a large
    // monorepo's real covering rule must not be silently truncated away.
    initGitRepo(root)
    const padding = `# padding\n`.repeat(25_000) // ~250KB, past the old 200KB cap
    commitFile('CODEOWNERS', `${padding}/src/ @src-owner\n`)
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toBeUndefined()
  })

  it('treats a CODEOWNERS file over the real GitHub size limit as having no effective rules', () => {
    // GitHub does not partially load an oversized CODEOWNERS -- it is not
    // loaded at all, so a covering rule anywhere in an over-the-limit file
    // (even near the top) must not count as coverage.
    initGitRepo(root)
    const padding = `# padding\n`.repeat(350_000) // ~3.5MB, over the 3 MiB limit
    commitFile('CODEOWNERS', `/src/ @src-owner\n${padding}`)
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
  })

  it('honors a later ownerless pattern that carves an unowned subtree out of a broader owned pattern', () => {
    // GitHub's own CODEOWNERS docs give exactly this example: "/apps/
    // @octocat" followed by a bare "/apps/github" line leaves that
    // subdirectory without a code owner, overriding the broader pattern
    // above it via "last matching pattern wins" -- not a no-op.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/apps/ @octocat\n/apps/github\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`apps/github/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    const scannedFilePaths = ['CODEOWNERS', ...Array.from({ length: 5 }, (_, i) => `apps/github/file-${i}.ts`)]
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', scannedFilePaths)).toEqual(['apps'])
  })

  it('does not mistake an @mention inside an inline comment for a real owner', () => {
    // GitHub's CODEOWNERS syntax supports inline comments ("*.js @owner #
    // comment" is documented syntax) -- an @mention appearing only in the
    // comment explaining an ownerless override must not count as an owner.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/apps/ @octocat\n/apps/github # intentionally unowned; parent is @octocat\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`apps/github/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    const scannedFilePaths = ['CODEOWNERS', ...Array.from({ length: 5 }, (_, i) => `apps/github/file-${i}.ts`)]
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', scannedFilePaths)).toEqual(['apps'])
  })

  it('still covers a sibling subtree the ownerless override does not apply to', () => {
    initGitRepo(root)
    commitFile('CODEOWNERS', '/apps/ @octocat\n/apps/github\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`apps/other/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    const scannedFilePaths = ['CODEOWNERS', ...Array.from({ length: 5 }, (_, i) => `apps/other/file-${i}.ts`)]
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', scannedFilePaths)).toBeUndefined()
  })

  it('does not let an unsupported "!" negation pattern un-cover a directory a broader pattern still owns', () => {
    // GitHub's CODEOWNERS syntax has no "!" negation (unlike .gitignore,
    // which the `ignore` package implements) -- a "*.ts @team" followed by
    // "!src/*.ts @other" line means GitHub still treats "*.ts" as the last
    // effectively-matching pattern for src/*.ts (the negation line matches
    // nothing), so src stays covered. Feeding "!src/*.ts" to `ignore()`
    // unfiltered would re-exclude it and wrongly flag src as uncovered.
    initGitRepo(root)
    commitFile('CODEOWNERS', '*.ts @team\n!src/*.ts @other\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toBeUndefined()
  })

  it('does not let an unsupported "[ ]" character-range pattern mark a directory covered', () => {
    // GitHub documents "[ ]" character ranges as unsupported CODEOWNERS
    // syntax (unlike .gitignore, which the `ignore` package implements) and
    // skips the whole line -- so "/src/[ab].ts" never actually assigns an
    // owner and src stays uncovered. Feeding it to `ignore()` unfiltered
    // would match src/a.ts via the range and wrongly report src as covered.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/src/[ab].ts @team\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
  })

  it('flags active directories when CODEOWNERS is comment-only (no effective rules)', () => {
    // A blank/comment-only CODEOWNERS still exists (so docs.codeowners.missing
    // won't fire), but GitHub requests no code owner for anything -- this must
    // not be treated as "nothing to check" either, or a placeholder CODEOWNERS
    // file produces zero findings, a worse blind spot than no file at all.
    initGitRepo(root)
    commitFile('CODEOWNERS', '# TODO: fill this in\n\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/file-${i}.ts`, `export const x${i} = ${i}\n`)
    }
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', ['CODEOWNERS', ...srcFilePaths(5)])).toEqual(['src'])
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

  it('ignores recent commits to files outside the scan inventory when counting activity and testing coverage, even within an otherwise-scanned directory', () => {
    // A directory can have some files the scan tracks (e.g. src/index.ts)
    // and others it doesn't (e.g. ignored generated files) -- filtering must
    // happen per file, not just per top-level directory. If the *only*
    // recent commits touched the ignored files, "src" must not be counted as
    // active at all; testing coverage against those ignored files' paths
    // (which a file-level owner may not match) would otherwise produce a
    // false coverage-gap for a directory a real owner does cover.
    initGitRepo(root)
    commitFile('CODEOWNERS', '/src/*.ts @team\n')
    commitFile('src/index.ts', 'export const x = 1\n')
    for (let i = 0; i < 5; i += 1) {
      commitFile(`src/generated/file-${i}.pb.ts`, `export const x${i} = ${i}\n`)
    }
    const scannedFilePaths = ['CODEOWNERS', 'src/index.ts']
    expect(detectCodeownersCoverageGaps(root, 'CODEOWNERS', scannedFilePaths)).toBeUndefined()
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
