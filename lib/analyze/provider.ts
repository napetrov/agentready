// The LlmProvider port. Everything provider-specific (Anthropic, an
// OpenAI-compatible/local endpoint, GitHub Models, Bedrock/Vertex/Azure, or a
// host-injected client) hides behind this one interface, so the analyzer
// pipeline is provider-blind. This PR defines the port only; adapters land in a
// later PR.

/**
 * A routing key identifying the kind of analysis work, used to map a request to
 * a `(provider, model)` and to own its token budget. Mirrors the routing keys
 * in the design doc (§5.5 / §7).
 */
export type AnalyzerTask = 'triage' | 'contradiction' | 'remediation'

/**
 * A structured request to a provider. `outputSchema` is a JSON Schema the
 * provider is asked to satisfy; the caller still validates the response against
 * the analyzer's Zod schema before trusting it.
 */
export interface LlmRequest {
  /** Routing key + token-budget owner. */
  task: AnalyzerTask
  /** System prompt establishing the judgment task. */
  system: string
  /** The sliced evidence (never the whole repo). */
  input: string
  /** JSON Schema the provider's structured output should match. */
  outputSchema: Record<string, unknown>
  /** Hard cap on output tokens for this call. */
  maxTokens: number
}

/** Token accounting for a single call, when the provider reports it. */
export interface LlmUsage {
  inputTokens: number
  outputTokens: number
}

/**
 * A structured response from a provider. `output` is unknown until the caller
 * validates it against the analyzer's insight schema; `model` is stamped onto
 * every resulting insight as `name@version`.
 */
export interface LlmResponse {
  /** Raw structured output, validated by the caller before use. */
  output: unknown
  /** The model that produced the output, as `name@version`. */
  model: string
  /** Token usage, when the provider reports it. */
  usage?: LlmUsage
}

/**
 * The provider port. Implementations are interchangeable adapters; the pipeline
 * never changes when the token source changes.
 */
export interface LlmProvider {
  /** Stable adapter id, e.g. `anthropic`, `openai-compat`, `github-models`, `host`. */
  readonly id: string
  /**
   * The concrete model the provider is configured to call (e.g. `gpt-4o`,
   * `llama3.1`). Folded into the cache key so switching models is a clean cache
   * miss rather than a false hit. Adapters that cannot know their model ahead of
   * time may omit this.
   */
  readonly model?: string
  /** Run a single structured completion. Implementations should be fail-open at the call site. */
  complete(request: LlmRequest): Promise<LlmResponse>
}
