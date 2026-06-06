import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { isTransientGitResourceError, readScannedRepoKeys, repoKey, selectBatch } from '../bin/agentready-realworld-cron'

describe('real-world cron repository selection', () => {
  const repos = [
    { name: 'one', url: 'https://github.com/example/one.git' },
    { name: 'two', url: 'https://github.com/example/two.git' },
    { name: 'three', url: 'https://github.com/example/three.git' },
    { name: 'four', url: 'https://github.com/example/four.git' },
  ]

  it('normalizes GitHub URL variants to the same repo key', () => {
    expect(repoKey({ name: 'repo', url: 'git@github.com:Owner/Repo.git' })).toBe('github.com/owner/repo')
    expect(repoKey({ name: 'repo', url: 'https://github.com/owner/repo/' })).toBe('github.com/owner/repo')
  })

  it('skips repositories already present in the ledger', () => {
    const seen = new Set([repoKey(repos[0]), repoKey(repos[2])])

    const selection = selectBatch(repos, { nextIndex: 0 }, 3, seen)

    expect(selection.repos.map(repo => repo.name)).toEqual(['two', 'four'])
    expect(selection.skippedSeen).toBe(2)
  })

  it('reads previously scanned repositories from all monthly ledgers', () => {
    const reportsDir = mkdtempSync(path.join(tmpdir(), 'agentready-realworld-'))
    const ledgersDir = path.join(reportsDir, 'ledgers')
    mkdirSync(ledgersDir)
    writeFileSync(path.join(ledgersDir, '2026-06.jsonl'), [
      JSON.stringify({ repo: repos[1] }),
      JSON.stringify({ repo: { name: 'three', url: 'git@github.com:example/three.git' } }),
      JSON.stringify({ repo: repos[3], classification: 'repo-selection-blocker' }),
      '',
    ].join('\n'))

    const seen = readScannedRepoKeys(reportsDir)

    expect(seen).toContain(repoKey(repos[1]))
    expect(seen).toContain(repoKey(repos[2]))
    expect(seen).not.toContain(repoKey(repos[3]))
  })

  it('recognizes transient git resource failures as retryable', () => {
    expect(isTransientGitResourceError('fatal: unable to create thread: Resource temporarily unavailable')).toBe(true)
    expect(isTransientGitResourceError('fatal: fetch-pack: invalid index-pack output')).toBe(true)
    expect(isTransientGitResourceError('fatal: repository not found')).toBe(false)
  })
})
