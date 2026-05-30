import {
  createOpenAiCompatProvider,
  detectProvider,
  type FetchLike,
  type LlmRequest,
} from '../lib/analyze'

const request: LlmRequest = {
  task: 'triage',
  system: 'Judge readiness.',
  input: 'evidence',
  outputSchema: { type: 'object' },
  maxTokens: 256,
}

// Builds a fake fetch that records the call and returns a canned body.
const fakeFetch = (
  body: string,
  opts: { ok?: boolean; status?: number; statusText?: string } = {},
): { fetchImpl: FetchLike; calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> } => {
  const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      statusText: opts.statusText ?? 'OK',
      text: async () => body,
    }
  }
  return { fetchImpl, calls }
}

const chatBody = (content: string, model = 'srv-1'): string =>
  JSON.stringify({
    model,
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 11, completion_tokens: 7 },
  })

describe('openai-compat provider', () => {
  it('posts to the chat completions endpoint and parses JSON content', async () => {
    const { fetchImpl, calls } = fakeFetch(chatBody(JSON.stringify({ verdict: 'ok' })))
    const provider = createOpenAiCompatProvider({
      baseUrl: 'http://localhost:11434/v1/',
      model: 'llama3.1',
      fetchImpl,
    })

    const result = await provider.complete(request)

    expect(provider.id).toBe('openai-compat')
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions')
    expect(result.output).toEqual({ verdict: 'ok' })
    expect(result.model).toBe('llama3.1@srv-1')
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 7 })
  })

  it('sends an Authorization header only when an API key is set', async () => {
    const withKey = fakeFetch(chatBody('{}'))
    await createOpenAiCompatProvider({ baseUrl: 'https://x/v1', model: 'm', apiKey: 'secret', fetchImpl: withKey.fetchImpl }).complete(request)
    expect(withKey.calls[0].init.headers.authorization).toBe('Bearer secret')

    const noKey = fakeFetch(chatBody('{}'))
    await createOpenAiCompatProvider({ baseUrl: 'https://x/v1', model: 'm', fetchImpl: noKey.fetchImpl }).complete(request)
    expect(noKey.calls[0].init.headers.authorization).toBeUndefined()
  })

  it('requests deterministic, schema-pinned, JSON output', async () => {
    const { fetchImpl, calls } = fakeFetch(chatBody('{}'))
    await createOpenAiCompatProvider({ baseUrl: 'https://x/v1', model: 'm', fetchImpl }).complete(request)
    const sent = JSON.parse(calls[0].init.body)
    expect(sent.temperature).toBe(0)
    expect(sent.response_format).toEqual({ type: 'json_object' })
    expect(sent.max_tokens).toBe(256)
    expect(sent.messages[0].content).toContain('JSON Schema')
  })

  it('throws on a non-OK response', async () => {
    const { fetchImpl } = fakeFetch('boom', { ok: false, status: 500, statusText: 'Server Error' })
    const provider = createOpenAiCompatProvider({ baseUrl: 'https://x/v1', model: 'm', fetchImpl })
    await expect(provider.complete(request)).rejects.toThrow(/request failed: 500/)
  })

  it('throws when the message content is not valid JSON', async () => {
    const { fetchImpl } = fakeFetch(chatBody('not json'))
    const provider = createOpenAiCompatProvider({ baseUrl: 'https://x/v1', model: 'm', fetchImpl })
    await expect(provider.complete(request)).rejects.toThrow(/not valid JSON/)
  })
})

describe('detectProvider', () => {
  it('returns undefined when no provider env is set (deterministic-only)', () => {
    expect(detectProvider({})).toBeUndefined()
  })

  it('prefers an explicit OpenAI-compatible base URL', () => {
    const detected = detectProvider({ AGENTREADY_LLM_BASE_URL: 'http://localhost:1234/v1', AGENTREADY_LLM_MODEL: 'm' })
    expect(detected?.source).toBe('AGENTREADY_LLM_BASE_URL')
    expect(detected?.provider.id).toBe('openai-compat')
  })

  it('detects a local Ollama host', () => {
    const detected = detectProvider({ OLLAMA_HOST: 'http://localhost:11434' })
    expect(detected?.source).toBe('OLLAMA_HOST')
  })

  it('detects a hosted OpenAI key', () => {
    const detected = detectProvider({ OPENAI_API_KEY: 'sk-test' })
    expect(detected?.source).toBe('OPENAI_API_KEY')
  })

  it('orders detection: explicit base URL wins over OLLAMA_HOST and OPENAI_API_KEY', () => {
    const detected = detectProvider({
      AGENTREADY_LLM_BASE_URL: 'http://localhost:1/v1',
      OLLAMA_HOST: 'http://localhost:11434',
      OPENAI_API_KEY: 'sk-test',
    })
    expect(detected?.source).toBe('AGENTREADY_LLM_BASE_URL')
  })
})
