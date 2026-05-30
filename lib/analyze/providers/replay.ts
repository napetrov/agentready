import { createHash } from 'crypto'
import type { LlmProvider, LlmRequest, LlmResponse } from '../provider'

// Record/replay provider (design §8, §11). AgentReady's own tests must never
// call a live model; this provider serves canned responses keyed by a stable
// hash of the request, and can record real responses (when wrapping another
// provider) to refresh fixtures.

/** A stored request/response pair. */
export interface ReplayFixture {
  key: string
  response: LlmResponse
}

/** Stable key over the request fields that determine a response. */
export const replayKey = (request: LlmRequest): string =>
  createHash('sha256')
    .update(request.task)
    .update('\0')
    .update(request.system)
    .update('\0')
    .update(request.input)
    .update('\0')
    .update(JSON.stringify(request.outputSchema))
    .digest('hex')

/**
 * A provider that replays fixtures by request key. Unknown requests throw by
 * default so a test that drifts from its fixtures fails loudly rather than
 * silently hitting nothing.
 */
export const createReplayProvider = (
  fixtures: ReplayFixture[],
  options: { id?: string; onMiss?: (key: string) => LlmResponse } = {},
): LlmProvider => {
  const byKey = new Map(fixtures.map(f => [f.key, f.response]))
  return {
    id: options.id ?? 'replay',
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const key = replayKey(request)
      const hit = byKey.get(key)
      if (hit) return hit
      if (options.onMiss) return options.onMiss(key)
      throw new Error(`replay provider has no fixture for request key ${key}`)
    },
  }
}

/**
 * Wraps a real provider to capture fixtures while delegating. Use in a one-off
 * recording run; the collected fixtures feed `createReplayProvider` in tests.
 */
export const createRecordingProvider = (
  inner: LlmProvider,
  sink: ReplayFixture[],
): LlmProvider => ({
  id: inner.id,
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const response = await inner.complete(request)
    sink.push({ key: replayKey(request), response })
    return response
  },
})
