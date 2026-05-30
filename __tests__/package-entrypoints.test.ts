import fs from 'fs'
import path from 'path'

// Guards the published consumption surface. The runtime behavior of the
// packaged tarball is exercised by bin/agentready-pack-smoke.ts; this test
// keeps the package.json metadata internally consistent so the library and
// CLI entry points cannot silently regress.
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
) as {
  main?: string
  types?: string
  bin?: Record<string, string>
  exports?: Record<string, { types?: string; default?: string } | string>
}

describe('package entry points', () => {
  it('declares main, types, and a default export', () => {
    expect(packageJson.main).toBeDefined()
    expect(packageJson.types).toBeDefined()
    expect(packageJson.exports?.['.']).toBeDefined()
  })

  it('keeps main/types consistent with the "." export', () => {
    const rootExport = packageJson.exports?.['.'] as { types?: string; default?: string }
    expect(`./${packageJson.main}`).toBe(rootExport.default)
    expect(`./${packageJson.types}`).toBe(rootExport.types)
  })

  it('points every entry point into the built dist directory', () => {
    const rootExport = packageJson.exports?.['.'] as { types?: string; default?: string }
    const entries = [
      packageJson.main,
      packageJson.types,
      packageJson.bin?.agentready,
      rootExport.default,
      rootExport.types,
    ]

    for (const entry of entries) {
      expect(entry).toBeDefined()
      expect(entry).toMatch(/(^|\/)dist\//)
    }
  })

  it('exposes package.json via a subpath export', () => {
    expect(packageJson.exports?.['./package.json']).toBe('./package.json')
  })

  it('exposes the analyze contracts via a subpath export pointing into dist', () => {
    const analyzeExport = packageJson.exports?.['./analyze'] as { types?: string; default?: string } | undefined
    expect(analyzeExport).toBeDefined()
    expect(analyzeExport?.types).toMatch(/(^|\/)dist\//)
    expect(analyzeExport?.default).toMatch(/(^|\/)dist\//)
  })
})
