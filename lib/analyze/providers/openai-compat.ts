import type { LlmProvider, LlmRequest, LlmResponse } from '../provider'

/**
 * A minimal subset of the `fetch` signature, injected so the adapter is unit
 * testable without network access. Defaults to the global `fetch` (Node 18+).
 */
export type FetchLike = (
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
  },
) => Promise<{
  ok: boolean
  status: number
  statusText: string
  text: () => Promise<string>
}>

export interface OpenAiCompatOptions {
  /**
   * Base URL of an OpenAI-compatible Chat Completions API. Covers OpenAI itself
   * (`https://api.openai.com/v1`) and local servers — Ollama
   * (`http://localhost:11434/v1`), vLLM, LM Studio — which expose the same shape.
   */
  baseUrl: string
  /** Model name to request. */
  model: string
  /** API key, when the endpoint requires one (local servers often do not). */
  apiKey?: string
  /** Sampling temperature; defaults to 0 for near-deterministic structured output. */
  temperature?: number
  /** Per-call timeout in milliseconds. */
  timeoutMs?: number
  /** Injected fetch for testing; defaults to the global `fetch`. */
  fetchImpl?: FetchLike
}

interface ChatCompletionResponse {
  model?: string
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

/**
 * Builds a system prompt that pins the model to the requested JSON shape. We use
 * the broadly-supported `response_format: { type: 'json_object' }` (Ollama,
 * vLLM, LM Studio, and OpenAI all honor it) and embed the schema in the prompt,
 * rather than the newer `json_schema` mode that not every local server supports.
 * The caller still validates the parsed output against the analyzer's Zod schema.
 */
const buildSystemPrompt = (request: LlmRequest): string =>
  `${request.system}\n\nRespond with a single JSON object that conforms to this JSON Schema. Do not include any prose, markdown, or code fences.\n\nJSON Schema:\n${JSON.stringify(request.outputSchema)}`

/**
 * An OpenAI-compatible Chat Completions adapter. This single adapter covers the
 * hosted OpenAI API and any local/self-hosted server that speaks the same
 * protocol, which is the privacy-preserving, no-egress path from the design doc.
 *
 * The adapter throws on transport/parse errors; fail-open behavior is the
 * responsibility of the calling pipeline (see the provider port docs).
 */
export const createOpenAiCompatProvider = (options: OpenAiCompatOptions): LlmProvider => {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
  if (!fetchImpl) {
    throw new Error('openai-compat provider requires a fetch implementation (Node 18+ or an injected fetchImpl)')
  }
  const temperature = options.temperature ?? 0
  const timeoutMs = options.timeoutMs ?? 60_000
  const endpoint = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`

  return {
    id: 'openai-compat',
    model: options.model,
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (options.apiKey) {
        headers.authorization = `Bearer ${options.apiKey}`
      }

      const body = JSON.stringify({
        model: options.model,
        temperature,
        max_tokens: request.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt(request) },
          { role: 'user', content: request.input },
        ],
      })

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let raw: string
      let status: number
      let ok: boolean
      let statusText: string
      try {
        const response = await fetchImpl(endpoint, { method: 'POST', headers, body, signal: controller.signal })
        ok = response.ok
        status = response.status
        statusText = response.statusText
        raw = await response.text()
      } finally {
        clearTimeout(timer)
      }

      if (!ok) {
        throw new Error(`openai-compat request failed: ${status} ${statusText} ${raw}`.trim())
      }

      let parsed: ChatCompletionResponse
      try {
        parsed = JSON.parse(raw) as ChatCompletionResponse
      } catch (error) {
        throw new Error(`openai-compat response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
      }

      const content = parsed.choices?.[0]?.message?.content
      if (typeof content !== 'string') {
        throw new Error('openai-compat response did not contain a message content string')
      }

      let output: unknown
      try {
        output = JSON.parse(content)
      } catch (error) {
        throw new Error(`openai-compat message content was not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
      }

      return {
        output,
        model: `${options.model}@${parsed.model ?? 'unknown'}`,
        ...(parsed.usage
          ? {
              usage: {
                inputTokens: parsed.usage.prompt_tokens ?? 0,
                outputTokens: parsed.usage.completion_tokens ?? 0,
              },
            }
          : {}),
      }
    },
  }
}
