import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { loadConfig } from '../lib/repo-readiness/local-readiness'

const createTempRepo = (): string => mkdtempSync(path.join(tmpdir(), 'agentready-cfg-'))

const write = (root: string, repoPath: string, content: string): void => {
  const absolute = path.join(root, repoPath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

describe('config discovery (data-only, cosmiconfig)', () => {
  let root: string
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    root = createTempRepo()
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    errorSpy.mockRestore()
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('falls back to defaults when no config is present', () => {
    const config = loadConfig(root, {})
    expect(config.ignorePaths).toEqual([])
    expect(config.allowMinifiedFiles).toBe(false)
  })

  it('discovers .agentready.json (legacy name)', () => {
    write(root, '.agentready.json', JSON.stringify({ allowMinifiedFiles: true }))
    expect(loadConfig(root, {}).allowMinifiedFiles).toBe(true)
  })

  it('discovers YAML config (agentready.config.yaml)', () => {
    write(root, 'agentready.config.yaml', 'ignorePaths:\n  - dist/**\nerrorOnWarnings: true\n')
    const config = loadConfig(root, {})
    expect(config.ignorePaths).toEqual(['dist/**'])
    expect(config.errorOnWarnings).toBe(true)
  })

  it('discovers an .agentreadyrc (no extension, parsed as YAML/JSON)', () => {
    write(root, '.agentreadyrc', '{ "allowMinifiedFiles": true }')
    expect(loadConfig(root, {}).allowMinifiedFiles).toBe(true)
  })

  it('discovers config from package.json#agentready', () => {
    write(root, 'package.json', JSON.stringify({ name: 'demo', agentready: { largeFileWarningBytes: 42 } }))
    expect(loadConfig(root, {}).largeFileWarningBytes).toBe(42)
  })

  it('does not walk up into parent directories', () => {
    write(root, '.agentready.json', JSON.stringify({ allowMinifiedFiles: true }))
    const nested = path.join(root, 'packages', 'app')
    mkdirSync(nested, { recursive: true })
    // Discovery is rooted at the scanned directory, so the parent config is not found.
    expect(loadConfig(nested, {}).allowMinifiedFiles).toBe(false)
  })

  it('refuses to execute a .js config passed explicitly', () => {
    write(root, 'agentready.config.js', 'module.exports = { allowMinifiedFiles: true }')
    expect(() => loadConfig(root, { configPath: 'agentready.config.js' })).toThrow(/will not execute config file/)
  })

  it('skips a malformed package.json and still discovers a valid sibling config', () => {
    write(root, 'package.json', '{ not json')
    write(root, '.agentready.json', JSON.stringify({ allowMinifiedFiles: true }))
    // package.json is the first search place; a parse error there must not abort
    // discovery or shadow the valid .agentready.json sibling.
    const config = loadConfig(root, {})
    expect(config.allowMinifiedFiles).toBe(true)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('falls back to defaults (without crashing) when only a malformed config exists', () => {
    write(root, 'package.json', '{ not json')
    const config = loadConfig(root, {})
    expect(config.allowMinifiedFiles).toBe(false)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('still validates discovered config against the schema', () => {
    write(root, '.agentready.json', JSON.stringify({ ignorePaths: 'not-an-array' }))
    expect(() => loadConfig(root, {})).toThrow(/ignorePaths must be an array of strings/)
  })
})
