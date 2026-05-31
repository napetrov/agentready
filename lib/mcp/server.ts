import {
  buildHostRequests,
  ingestHostResponses,
  validateAugmentedReportContract,
  type HostAnalysisResponse,
} from '../analyze'
import { scanLocalReadiness } from '../repo-readiness/local-readiness'

// A minimal Model Context Protocol server exposing AgentReady to an agent host.
// MCP is JSON-RPC 2.0 over stdio; we implement the handful of methods a host
// needs without a heavyweight SDK, keeping the package dependency-free and
// offline. The host-delegated flow lets the host's *own* model do the LLM work,
// so AgentReady holds no credentials (design §6.2):
//
//   1. agentready_scan                 → deterministic scan report (no model)
//   2. agentready_analyze_prepare      → self-contained analysis requests for
//                                        the host's model to answer
//   3. agentready_analyze_finalize     → fold the host's answers into an
//                                        augmented report
//
// This module is the pure request handler; `index.ts` wires it to stdio so it is
// unit-testable without a process or pipes.

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_INFO = { name: 'agentready', version: '0.1.0' }

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

const TOOLS = [
  {
    name: 'agentready_scan',
    description:
      'Run a deterministic, offline AgentReady readiness scan of a repository path. Never executes repository code or calls a model.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Repository path to scan (default ".").' } },
    },
  },
  {
    name: 'agentready_analyze_prepare',
    description:
      'Scan a repository and return self-contained LLM analysis requests (prompt + already-sliced evidence) for the host model to answer. Use the host model to answer each request, then call agentready_analyze_finalize.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Repository path to analyze (default ".").' } },
    },
  },
  {
    name: 'agentready_analyze_finalize',
    description:
      'Fold host-model answers (from agentready_analyze_prepare) into an augmented readiness report. The deterministic score is never mutated; a separate augmented score is returned.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Repository path (must match the prepare call).' },
        responses: {
          type: 'array',
          description: 'One entry per analysis request: { analyzerId, output, model }.',
          items: { type: 'object' },
        },
      },
      required: ['path', 'responses'],
    },
  },
]

const ok = (id: JsonRpcResponse['id'], result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result })
const err = (id: JsonRpcResponse['id'], code: number, message: string): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
})

/** Wraps a JSON payload as an MCP tool-call result (text content). */
const toolResult = (payload: unknown): unknown => ({
  content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
})

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {})

const handleToolCall = (id: JsonRpcResponse['id'], params: unknown): JsonRpcResponse => {
  const { name, arguments: args } = asRecord(params)
  const toolArgs = asRecord(args)
  const repoPath = typeof toolArgs.path === 'string' ? toolArgs.path : '.'

  switch (name) {
    case 'agentready_scan':
      return ok(id, toolResult(scanLocalReadiness(repoPath)))

    case 'agentready_analyze_prepare': {
      const report = scanLocalReadiness(repoPath)
      const requests = buildHostRequests(repoPath, report)
      return ok(id, toolResult({ path: repoPath, requests }))
    }

    case 'agentready_analyze_finalize': {
      const report = scanLocalReadiness(repoPath)
      const responses = Array.isArray(toolArgs.responses) ? (toolArgs.responses as HostAnalysisResponse[]) : []
      const augmented = ingestHostResponses(report, responses)
      const validation = validateAugmentedReportContract(augmented)
      if (!validation.valid) {
        return err(id, -32603, `augmented report contract validation failed: ${validation.errors.join('; ')}`)
      }
      return ok(id, toolResult(augmented))
    }

    default:
      return err(id, -32602, `unknown tool: ${String(name)}`)
  }
}

/**
 * Handles one JSON-RPC request and returns the response, or `undefined` for
 * notifications (requests without an id) which take no reply. Pure and
 * synchronous — no model calls happen here; the host's model does the inference
 * between `prepare` and `finalize`.
 */
export const handleRequest = (request: JsonRpcRequest): JsonRpcResponse | undefined => {
  const id = request.id ?? null
  const isNotification = request.id === undefined || request.id === null

  switch (request.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })
    case 'notifications/initialized':
    case 'initialized':
      return undefined
    case 'tools/list':
      return ok(id, { tools: TOOLS })
    case 'tools/call':
      try {
        return handleToolCall(id, request.params)
      } catch (error) {
        return err(id, -32603, error instanceof Error ? error.message : String(error))
      }
    case 'ping':
      return ok(id, {})
    default:
      // Notifications get no response; unknown method calls get an error.
      return isNotification ? undefined : err(id, -32601, `method not found: ${request.method}`)
  }
}

export { TOOLS as mcpTools }
