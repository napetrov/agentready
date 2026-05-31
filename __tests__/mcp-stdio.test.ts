import { Readable, Writable } from 'stream'
import path from 'path'
import { runStdioServer } from '../lib/mcp'

// Exercises the stdio transport wrapper (lib/mcp/index.ts): it must parse
// newline-delimited JSON-RPC from stdin, write one response line per request to
// stdout, skip blank/unparsable lines without crashing, and emit no reply for
// notifications. The pure handler is covered separately in analyze-host.test.ts.

const goodFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo')

/** Runs the stdio loop over `lines` and returns the parsed response objects. */
const driveStdio = async (lines: string[]): Promise<Array<Record<string, unknown>>> => {
  const input = Readable.from(`${lines.join('\n')}\n`)
  const written: string[] = []
  const output = new Writable({
    write(chunk, _enc, cb) {
      written.push(chunk.toString())
      cb()
    },
  })
  await runStdioServer(input, output)
  return written
    .join('')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>)
}

describe('runStdioServer', () => {
  it('answers requests, skips notifications, and emits one response per request', async () => {
    const responses = await driveStdio([
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), // notification: no reply
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    ])

    expect(responses).toHaveLength(2)
    expect(responses[0]).toMatchObject({ id: 1, result: { serverInfo: { name: 'agentready' } } })
    const tools = (responses[1].result as { tools: Array<{ name: string }> }).tools.map(t => t.name)
    expect(tools).toContain('agentready_scan')
  })

  it('runs a scan tool call end-to-end through the transport', async () => {
    const responses = await driveStdio([
      JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'agentready_scan', arguments: { path: goodFixture } } }),
    ])
    expect(responses).toHaveLength(1)
    const text = (responses[0].result as { content: Array<{ text: string }> }).content[0].text
    const report = JSON.parse(text)
    expect(report.summary.score).toBe(100)
  })

  it('skips blank and unparsable lines without producing a response', async () => {
    const stderr: string[] = []
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      stderr.push(chunk.toString())
      return true
    }) as typeof process.stderr.write)
    try {
      const responses = await driveStdio([
        '   ', // blank-ish line: trimmed away, no reply
        '{ not valid json', // unparsable: reported to stderr, skipped
        JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping' }),
      ])
      expect(responses).toHaveLength(1)
      expect(responses[0]).toMatchObject({ id: 9, result: {} })
    } finally {
      spy.mockRestore()
    }
    expect(stderr.join('')).toMatch(/unparsable line/)
  })
})
