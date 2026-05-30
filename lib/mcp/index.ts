import { createInterface } from 'readline'
import { handleRequest, type JsonRpcRequest } from './server'

// Stdio transport for the MCP server: reads newline-delimited JSON-RPC requests
// from stdin and writes responses to stdout. Kept separate from server.ts so the
// request handler stays pure and unit-testable. Diagnostics go to stderr so they
// never corrupt the protocol stream on stdout.

export { handleRequest, mcpTools } from './server'
export type { JsonRpcRequest, JsonRpcResponse } from './server'

/** Starts the stdio MCP loop. Resolves when stdin closes. */
export const runStdioServer = (
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<void> =>
  new Promise(resolve => {
    const rl = createInterface({ input, crlfDelay: Infinity })
    rl.on('line', line => {
      const trimmed = line.trim()
      if (!trimmed) return
      let request: JsonRpcRequest
      try {
        request = JSON.parse(trimmed) as JsonRpcRequest
      } catch {
        // A line we can't parse has no id to answer to; report and skip.
        process.stderr.write(`agentready mcp: ignoring unparsable line\n`)
        return
      }
      const response = handleRequest(request)
      if (response !== undefined) {
        output.write(`${JSON.stringify(response)}\n`)
      }
    })
    rl.on('close', () => resolve())
  })
