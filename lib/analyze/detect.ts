import type { LlmProvider } from './provider'
import { createOpenAiCompatProvider } from './providers/openai-compat'
import { createGitHubModelsProvider } from './providers/github-models'

/**
 * Environment-based provider auto-detection. The analytics layer is opt-in and
 * provider-agnostic; this resolves which adapter to use from the ambient
 * environment so a host (CI, an agent, or a developer with a local model) does
 * not have to wire one explicitly. Explicit configuration always overrides this.
 *
 * Only the OpenAI-compatible adapter exists in this PR; it already covers hosted
 * OpenAI and any local server (Ollama, vLLM, LM Studio). Additional adapters
 * (Anthropic, GitHub Models, host-delegated) register here in later PRs.
 */
export interface DetectionEnv {
  [key: string]: string | undefined
}

export interface DetectedProvider {
  provider: LlmProvider
  /** How the provider was detected, for logging/provenance. */
  source: string
}

const DEFAULT_OLLAMA_MODEL = 'llama3.1'
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

/**
 * Resolves a provider from the environment, or `undefined` if none is
 * configured (the caller then runs deterministic-only). Detection order favors
 * an explicit local/compatible endpoint, then a hosted OpenAI key.
 *
 *   AGENTREADY_LLM_BASE_URL  → OpenAI-compatible endpoint (local or hosted)
 *   GITHUB_TOKEN (+ opt-in)  → GitHub Models (CI-native; needs models: read)
 *   OLLAMA_HOST              → a local Ollama server
 *   OPENAI_API_KEY           → hosted OpenAI
 *
 * GitHub Models is gated behind an explicit `AGENTREADY_USE_GITHUB_MODELS=1`
 * (or the Action's `analyze` input) so the ambient `GITHUB_TOKEN` present in
 * every workflow never silently enables model calls.
 */
export const detectProvider = (env: DetectionEnv = process.env): DetectedProvider | undefined => {
  const baseUrl = env.AGENTREADY_LLM_BASE_URL
  if (baseUrl) {
    return {
      source: 'AGENTREADY_LLM_BASE_URL',
      provider: createOpenAiCompatProvider({
        baseUrl,
        model: env.AGENTREADY_LLM_MODEL ?? DEFAULT_OPENAI_MODEL,
        // Only an explicitly-scoped key goes to a custom endpoint. We do NOT
        // fall back to OPENAI_API_KEY here: forwarding an OpenAI secret to an
        // arbitrary (possibly local/third-party) base URL would leak it.
        apiKey: env.AGENTREADY_LLM_API_KEY,
      }),
    }
  }

  // GitHub Models: only when explicitly opted in, to avoid the ambient
  // GITHUB_TOKEN silently enabling model calls in every workflow.
  const useGitHubModels = env.AGENTREADY_USE_GITHUB_MODELS === '1' || env.AGENTREADY_USE_GITHUB_MODELS === 'true'
  if (useGitHubModels && env.GITHUB_TOKEN) {
    return {
      source: 'GITHUB_TOKEN',
      provider: createGitHubModelsProvider({
        token: env.GITHUB_TOKEN,
        ...(env.AGENTREADY_LLM_MODEL ? { model: env.AGENTREADY_LLM_MODEL } : {}),
      }),
    }
  }

  if (env.OLLAMA_HOST) {
    const host = env.OLLAMA_HOST.replace(/\/$/, '')
    return {
      source: 'OLLAMA_HOST',
      provider: createOpenAiCompatProvider({
        baseUrl: `${host}/v1`,
        model: env.AGENTREADY_LLM_MODEL ?? DEFAULT_OLLAMA_MODEL,
      }),
    }
  }

  if (env.OPENAI_API_KEY) {
    return {
      source: 'OPENAI_API_KEY',
      provider: createOpenAiCompatProvider({
        baseUrl: env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
        model: env.AGENTREADY_LLM_MODEL ?? DEFAULT_OPENAI_MODEL,
        apiKey: env.OPENAI_API_KEY,
      }),
    }
  }

  return undefined
}
