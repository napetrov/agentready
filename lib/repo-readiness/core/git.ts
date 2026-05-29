import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const runGit = (cwd: string, args: string[]): string => (
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
)

/**
 * Runs `fn` against a detached, throwaway checkout of `ref` using a temporary
 * `git worktree`. Unlike checking out refs in place, this never mutates the
 * caller's working tree, branch, or index, and works even when the working
 * tree has uncommitted changes.
 */
export function withWorktree<T>(root: string, ref: string, fn: (worktreePath: string) => T): T {
  const repoTop = runGit(root, ['rev-parse', '--show-toplevel'])
  const tempDir = mkdtempSync(path.join(tmpdir(), 'agentready-worktree-'))
  const worktreePath = path.join(tempDir, 'tree')

  try {
    // `--detach` checks out the ref's commit without moving any branch, so refs
    // that are also checked out in the main worktree (e.g. the current branch)
    // are still scannable.
    runGit(repoTop, ['worktree', 'add', '--quiet', '--detach', worktreePath, ref])
    return fn(worktreePath)
  } finally {
    try {
      runGit(repoTop, ['worktree', 'remove', '--force', worktreePath])
    } catch {
      // Best-effort cleanup of the worktree registration.
    }
    rmSync(tempDir, { recursive: true, force: true })
  }
}
