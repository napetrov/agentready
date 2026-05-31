#!/usr/bin/env node
// AgentReady MCP server entry point. Exposes deterministic scanning and the
// host-delegated analysis flow over MCP (JSON-RPC 2.0 on stdio), so an agent
// host reuses its own model and AgentReady holds no credentials.
import { runStdioServer } from '../lib/mcp'

runStdioServer().catch((error: unknown) => {
  process.stderr.write(`agentready mcp: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
