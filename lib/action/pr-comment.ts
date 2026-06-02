// Optional pull-request commenting for the GitHub Action. This posts (and
// updates in place) a single "sticky" comment carrying the markdown report so
// reviewers see the readiness result on the PR itself.
//
// Like the rest of lib/action, this avoids @actions/github (which pulls in
// @actions/http-client + undici) and instead uses the node20 global fetch,
// keeping the bundle small and dependency-free. The orchestration is split from
// the transport so it can be unit-tested with a fake API client.

import { readFileSync } from 'fs'

/**
 * Hidden marker embedded in the comment body so subsequent runs can find and
 * update the same comment instead of posting a new one each time.
 */
export const COMMENT_MARKER = '<!-- agentready-pr-comment -->'

/** Embeds the sticky marker at the top of a comment body. */
export const withMarker = (body: string): string => `${COMMENT_MARKER}\n${body}`

/** Whether a comment body was produced by this action. */
export const hasMarker = (body: string | undefined): boolean =>
  typeof body === 'string' && body.includes(COMMENT_MARKER)

/** Workflow context needed to locate the PR and authenticate. */
export interface PrCommentContext {
  /** Token with `pull-requests: write` (e.g. the workflow GITHUB_TOKEN). */
  token?: string
  /** "owner/repo", from GITHUB_REPOSITORY. */
  repository?: string
  /** Path to the event payload JSON, from GITHUB_EVENT_PATH. */
  eventPath?: string
  /** REST API base, from GITHUB_API_URL. Defaults to api.github.com. */
  apiUrl?: string
}

/** A GitHub issue comment, narrowed to the fields we use. */
export interface IssueComment {
  id: number
  body?: string
}

/** Tunes when and how postPrComment surfaces a comment. */
export interface PrCommentOptions {
  /**
   * Injected REST client. Production derives one from `ctx`; tests pass a fake.
   */
  api?: IssueCommentApi
  /**
   * When true, only surface a comment if the run has findings. A clean run
   * posts nothing new — but an existing sticky comment (left by an earlier run
   * that did have findings) is still updated, so it reflects the now-resolved
   * state instead of showing stale findings.
   */
  onlyOnFindings?: boolean
  /**
   * Whether the current run has findings/regressions. Only consulted when
   * `onlyOnFindings` is set.
   */
  hasFindings?: boolean
}

/** Injectable fetch, so the REST client can be unit-tested without network. */
export type FetchFn = typeof fetch

/**
 * The slice of the GitHub REST API this feature needs. Injecting it keeps
 * postPrComment unit-testable without real network access.
 */
export interface IssueCommentApi {
  list(prNumber: number): Promise<IssueComment[]>
  create(prNumber: number, body: string): Promise<void>
  update(commentId: number, body: string): Promise<void>
}

/** Outcome of an attempted PR comment, for logging. Never thrown. */
export interface PrCommentOutcome {
  status: 'created' | 'updated' | 'skipped' | 'failed'
  reason?: string
}

interface RepoSlug {
  owner: string
  repo: string
}

const parseRepository = (repository: string | undefined): RepoSlug | undefined => {
  if (!repository) return undefined
  const [owner, repo] = repository.split('/')
  if (!owner || !repo) return undefined
  return { owner, repo }
}

/**
 * Resolves the pull-request number from the event payload. Handles the common
 * shapes: `pull_request` events (`pull_request.number`/`number`) and
 * `issue_comment` on a PR (`issue.number`). Returns undefined when the run is
 * not associated with a PR or the payload can't be read.
 */
export const resolvePrNumber = (eventPath: string | undefined): number | undefined => {
  if (!eventPath) return undefined
  let payload: unknown
  try {
    payload = JSON.parse(readFileSync(eventPath, 'utf8'))
  } catch {
    return undefined
  }
  if (typeof payload !== 'object' || payload === null) return undefined
  const record = payload as Record<string, unknown>

  const fromPullRequest = (record.pull_request as Record<string, unknown> | undefined)?.number
  const fromIssue = (record.issue as Record<string, unknown> | undefined)?.number
  const candidate = fromPullRequest ?? record.number ?? fromIssue
  return typeof candidate === 'number' && Number.isInteger(candidate) ? candidate : undefined
}

/**
 * Builds a REST client over the node20 global fetch (or an injected `fetchImpl`
 * for tests). Throws (rejects) on non-2xx responses so the caller can fail-open.
 */
export const createFetchApi = (
  slug: RepoSlug,
  token: string,
  apiUrl?: string,
  fetchImpl: FetchFn = fetch,
): IssueCommentApi => {
  const base = (apiUrl ?? 'https://api.github.com').replace(/\/+$/, '')
  // Read headers; write requests add Content-Type below (a GET carries no body).
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'agentready-action',
  }
  const writeHeaders = { ...headers, 'Content-Type': 'application/json' }

  const ensureOk = async (response: Response, action: string): Promise<void> => {
    if (!response.ok) {
      // Note: only the response body is included — never the request headers —
      // so the bearer token can't leak into a logged error message.
      const detail = await response.text().catch(() => '')
      throw new Error(`${action} failed: ${response.status} ${response.statusText} ${detail}`.trim())
    }
  }

  return {
    async list(prNumber: number): Promise<IssueComment[]> {
      const comments: IssueComment[] = []
      // Paginate so an older sticky comment is found even on busy PRs. Cap the
      // page count defensively rather than following Link headers.
      for (let page = 1; page <= 10; page += 1) {
        const url = `${base}/repos/${slug.owner}/${slug.repo}/issues/${prNumber}/comments?per_page=100&page=${page}`
        const response = await fetchImpl(url, { headers })
        await ensureOk(response, 'listing PR comments')
        const batch = (await response.json()) as IssueComment[]
        comments.push(...batch)
        if (batch.length < 100) break
      }
      return comments
    },
    async create(prNumber: number, body: string): Promise<void> {
      const url = `${base}/repos/${slug.owner}/${slug.repo}/issues/${prNumber}/comments`
      const response = await fetchImpl(url, { method: 'POST', headers: writeHeaders, body: JSON.stringify({ body }) })
      await ensureOk(response, 'creating PR comment')
    },
    async update(commentId: number, body: string): Promise<void> {
      const url = `${base}/repos/${slug.owner}/${slug.repo}/issues/comments/${commentId}`
      const response = await fetchImpl(url, { method: 'PATCH', headers: writeHeaders, body: JSON.stringify({ body }) })
      await ensureOk(response, 'updating PR comment')
    },
  }
}

/**
 * Posts the report as a sticky PR comment, updating the previous one in place
 * when present. Fail-open: any missing prerequisite or API error is reported in
 * the outcome rather than thrown, so commenting never fails the action.
 *
 * With `options.onlyOnFindings`, a clean run (no findings) posts nothing new —
 * avoiding empty "all clear" noise — yet still refreshes a prior sticky comment
 * so it no longer shows resolved findings.
 *
 * `options.api` is injectable for testing; in production it is derived from `ctx`.
 */
export const postPrComment = async (
  body: string,
  ctx: PrCommentContext,
  options: PrCommentOptions = {},
): Promise<PrCommentOutcome> => {
  const slug = parseRepository(ctx.repository)
  if (!slug) {
    return { status: 'skipped', reason: 'no GITHUB_REPOSITORY available' }
  }
  if (!ctx.token) {
    return { status: 'skipped', reason: 'no github-token provided' }
  }
  const prNumber = resolvePrNumber(ctx.eventPath)
  if (prNumber === undefined) {
    return { status: 'skipped', reason: 'not running on a pull request' }
  }

  const client = options.api ?? createFetchApi(slug, ctx.token, ctx.apiUrl)
  const commentBody = withMarker(body)

  try {
    const existing = (await client.list(prNumber)).find((comment) => hasMarker(comment.body))
    // Findings-only mode: a clean run with no prior comment stays silent. If a
    // prior comment exists we fall through and update it, so it reflects that
    // earlier findings are now resolved rather than lingering as stale.
    if (options.onlyOnFindings && !options.hasFindings && !existing) {
      return { status: 'skipped', reason: 'no findings to report' }
    }
    if (existing) {
      await client.update(existing.id, commentBody)
      return { status: 'updated' }
    }
    await client.create(prNumber, commentBody)
    return { status: 'created' }
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) }
  }
}
