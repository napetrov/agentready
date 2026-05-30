import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { defaultConfig, loadConfig, scaffoldInit } from '../lib/repo-readiness/local-readiness'

const createTempRepo = (): string => mkdtempSync(path.join(tmpdir(), 'agentready-init-'))

describe('scaffoldInit', () => {
  let root: string

  beforeEach(() => {
    root = createTempRepo()
  })

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('creates a starter config that round-trips through loadConfig', () => {
    const result = scaffoldInit(root)
    expect(result.created).toEqual(['.agentready.json'])
    expect(result.skipped).toEqual([])
    expect(existsSync(path.join(root, '.agentready.json'))).toBe(true)

    // The scaffolded config must be valid and equal to the defaults.
    expect(loadConfig(root, {})).toEqual(defaultConfig)
    expect(JSON.parse(readFileSync(path.join(root, '.agentready.json'), 'utf8'))).toEqual(defaultConfig)
  })

  it('scaffolds AGENTS.md only when requested', () => {
    expect(scaffoldInit(root).created).not.toContain('AGENTS.md')
    expect(existsSync(path.join(root, 'AGENTS.md'))).toBe(false)

    const sub = path.join(root, 'sub')
    mkdirSync(sub, { recursive: true })
    const withAgents = scaffoldInit(sub, { agents: true })
    expect(withAgents.created).toContain('AGENTS.md')
    expect(existsSync(path.join(sub, 'AGENTS.md'))).toBe(true)
  })

  it('skips existing files unless force is set', () => {
    writeFileSync(path.join(root, '.agentready.json'), '{"allowMinifiedFiles": true}')

    const skipped = scaffoldInit(root)
    expect(skipped.created).toEqual([])
    expect(skipped.skipped).toEqual(['.agentready.json'])
    // Untouched.
    expect(JSON.parse(readFileSync(path.join(root, '.agentready.json'), 'utf8'))).toEqual({ allowMinifiedFiles: true })

    const forced = scaffoldInit(root, { force: true })
    expect(forced.created).toEqual(['.agentready.json'])
    expect(loadConfig(root, {})).toEqual(defaultConfig)
  })
})
