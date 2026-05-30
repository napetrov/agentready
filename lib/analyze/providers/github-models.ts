import type { LlmProvider } from '../provider'
import { createOpenAiCompatProvider, type FetchLike } from './openai-compat'

// GitHub Models adapter. GitHub Models exposes an OpenAI-compatible chat
// completions API authenticated with the workflow's built-in GITHUB_TOKEN (plus
// `permissions: models: read`), so no separate secret is needed in CI. This is
// the natural CI default from the design doc (§6.1); it is a thin wrapper over
// the OpenAI-compatible adapter pointed at the GitHub Models inference endpoint.

const DEFAULT_GITHUB_MODELS_BASE_URL = 'https://models.github.ai/inference'
const DEFAULT_GITHUB_MODEL = 'openai/gpt-4o-mini'

export interface GitHubModelsOptions {
  /** A token with `models: read` — typically the Actions `GITHUB_TOKEN`. */
  token: string
  /** Model id; defaults to a small, fast model suitable for triage. */
  model?: string
  /** Override the inference base URL (e.g. for GitHub Enterprise). */
  baseUrl?: string
  /** Injected fetch for testing. */
  fetchImpl?: FetchLike
}

/**
 * Builds a provider backed by GitHub Models. The adapter id is
 * `github-models`, but it speaks the OpenAI-compatible protocol underneath.
 */
export const createGitHubModelsProvider = (options: GitHubModelsOptions): LlmProvider => {
  const inner = createOpenAiCompatProvider({
    baseUrl: options.baseUrl ?? DEFAULT_GITHUB_MODELS_BASE_URL,
    model: options.model ?? DEFAULT_GITHUB_MODEL,
    apiKey: options.token,
    fetchImpl: options.fetchImpl,
  })
  // Re-id so provenance and logs name the actual token source.
  return {
    id: 'github-models',
    complete: request => inner.complete(request),
  }
}
