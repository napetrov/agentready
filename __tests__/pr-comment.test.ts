import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  COMMENT_MARKER,
  hasMarker,
  postPrComment,
  resolvePrNumber,
  withMarker,
  type IssueComment,
  type IssueCommentApi,
} from '../lib/action/pr-comment'

let eventSeq = 0
const writeEvent = (dir: string, payload: unknown): string => {
  // Unique filename per call: callers build several events in one expression
  // (e.g. ctx({ eventPath: writeEvent(...) })) and a shared path would let
  // argument-evaluation order clobber the intended payload.
  const file = path.join(dir, `event-${(eventSeq += 1)}.json`)
  writeFileSync(file, JSON.stringify(payload))
  return file
}

/** A fake REST client that records calls and serves a fixed comment list. */
class FakeApi implements IssueCommentApi {
  created: { prNumber: number; body: string }[] = []
  updated: { commentId: number; body: string }[] = []
  constructor(private readonly comments: IssueComment[] = []) {}
  async list(): Promise<IssueComment[]> {
    return this.comments
  }
  async create(prNumber: number, body: string): Promise<void> {
    this.created.push({ prNumber, body })
  }
  async update(commentId: number, body: string): Promise<void> {
    this.updated.push({ commentId, body })
  }
}

describe('marker helpers', () => {
  it('embeds and detects the marker', () => {
    const body = withMarker('hello')
    expect(body.startsWith(COMMENT_MARKER)).toBe(true)
    expect(hasMarker(body)).toBe(true)
    expect(hasMarker('no marker here')).toBe(false)
    expect(hasMarker(undefined)).toBe(false)
  })
})

describe('resolvePrNumber', () => {
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'agentready-prnum-'))
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('returns undefined without an event path', () => {
    expect(resolvePrNumber(undefined)).toBeUndefined()
  })

  it('returns undefined for an unreadable file', () => {
    expect(resolvePrNumber(path.join(dir, 'missing.json'))).toBeUndefined()
  })

  it('reads pull_request.number', () => {
    expect(resolvePrNumber(writeEvent(dir, { pull_request: { number: 42 } }))).toBe(42)
  })

  it('reads top-level number', () => {
    expect(resolvePrNumber(writeEvent(dir, { number: 7 }))).toBe(7)
  })

  it('reads issue.number for issue_comment events', () => {
    expect(resolvePrNumber(writeEvent(dir, { issue: { number: 13 } }))).toBe(13)
  })

  it('returns undefined when no PR number is present', () => {
    expect(resolvePrNumber(writeEvent(dir, { ref: 'refs/heads/main' }))).toBeUndefined()
  })

  it('returns undefined for a non-integer number', () => {
    expect(resolvePrNumber(writeEvent(dir, { number: 'abc' }))).toBeUndefined()
  })
})

describe('postPrComment', () => {
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'agentready-prcomment-'))
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const ctx = (overrides: Record<string, unknown> = {}) => ({
    token: 'tok',
    repository: 'octo/repo',
    eventPath: writeEvent(dir, { pull_request: { number: 99 } }),
    ...overrides,
  })

  it('skips when no repository is available', async () => {
    const result = await postPrComment('body', ctx({ repository: undefined }), new FakeApi())
    expect(result.status).toBe('skipped')
    expect(result.reason).toMatch(/GITHUB_REPOSITORY/)
  })

  it('skips on a malformed repository slug', async () => {
    const result = await postPrComment('body', ctx({ repository: 'no-slash' }), new FakeApi())
    expect(result.status).toBe('skipped')
  })

  it('skips when no token is provided', async () => {
    const result = await postPrComment('body', ctx({ token: undefined }), new FakeApi())
    expect(result.status).toBe('skipped')
    expect(result.reason).toMatch(/github-token/)
  })

  it('skips when not running on a pull request', async () => {
    const result = await postPrComment('body', ctx({ eventPath: writeEvent(dir, { ref: 'x' }) }), new FakeApi())
    expect(result.status).toBe('skipped')
    expect(result.reason).toMatch(/pull request/)
  })

  it('creates a new comment when none exists', async () => {
    const api = new FakeApi([{ id: 1, body: 'unrelated' }])
    const result = await postPrComment('the report', ctx(), api)
    expect(result.status).toBe('created')
    expect(api.created).toHaveLength(1)
    expect(api.created[0]).toEqual({ prNumber: 99, body: withMarker('the report') })
    expect(api.updated).toHaveLength(0)
  })

  it('updates the existing sticky comment in place', async () => {
    const api = new FakeApi([
      { id: 1, body: 'unrelated' },
      { id: 55, body: withMarker('old report') },
    ])
    const result = await postPrComment('new report', ctx(), api)
    expect(result.status).toBe('updated')
    expect(api.updated).toEqual([{ commentId: 55, body: withMarker('new report') }])
    expect(api.created).toHaveLength(0)
  })

  it('fails open when the API throws', async () => {
    const api: IssueCommentApi = {
      list: async () => {
        throw new Error('boom')
      },
      create: async () => undefined,
      update: async () => undefined,
    }
    const result = await postPrComment('body', ctx(), api)
    expect(result.status).toBe('failed')
    expect(result.reason).toMatch(/boom/)
  })
})
