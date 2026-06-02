import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  classifyRunCommandKinds,
  classifyUsesCommandKinds,
  detectCiWorkflows,
} from '../lib/repo-readiness/detectors/ci-workflows'
import { scanLocalReadiness } from '../lib/repo-readiness/local-readiness'
import type { CiCommandKind } from '../lib/repo-readiness/core/types'

// Property / fuzz tests. The example-based suites and the gold corpus cover
// known inputs; these complement them by asserting the parsers are *total*
// (never throw) and shape-correct on arbitrary and deliberately malformed
// input. Generation is seeded so failures are reproducible and CI is stable.

// Deterministic PRNG (mulberry32) so the corpus is identical on every run.
const makeRng = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VALID_KINDS: CiCommandKind[] = ['install', 'lint', 'typecheck', 'test', 'build']
const KIND_INDEX = new Map<CiCommandKind, number>(VALID_KINDS.map((kind, index) => [kind, index]))

// A vocabulary biased toward shell-command and manifest fragments so the fuzzer
// explores the patterns the parsers actually branch on, not just random noise.
const TOKENS = [
  'npm', 'ci', 'install', 'run', 'test', 'lint', 'build', 'type-check', 'pnpm', 'yarn', 'bun',
  'pip', 'pytest', 'tox', 'nox', 'ruff', 'black', 'mypy', 'pyright', 'eslint', 'tsc', 'go', 'vet',
  'cargo', 'clippy', 'check', 'make', 'just', 'uv', 'poetry', 'pre-commit', 'chmod', '+x', 'cat',
  'docker', './test.sh', 'build.sh', 'run_test.bat', '&&', '||', ';', '|', '\n', '\\\n', '-g',
  '--frozen-lockfile', '"', "'", '`', '$()', '{}', '..', '/', '\\', '\t', '#', '%', '😀', '\0',
]

const randomToken = (rng: () => number): string => {
  if (rng() < 0.15) {
    // Occasionally emit a few raw random characters to probe edge bytes.
    const length = Math.floor(rng() * 6)
    let out = ''
    for (let i = 0; i < length; i += 1) {
      out += String.fromCharCode(Math.floor(rng() * 128))
    }
    return out
  }
  return TOKENS[Math.floor(rng() * TOKENS.length)]
}

const randomCommand = (rng: () => number): string => {
  const length = Math.floor(rng() * 12)
  const parts: string[] = []
  for (let i = 0; i < length; i += 1) {
    parts.push(randomToken(rng))
  }
  return parts.join(' ')
}

const assertValidKindArray = (kinds: CiCommandKind[]): void => {
  // Every element is a known kind…
  for (const kind of kinds) {
    expect(VALID_KINDS).toContain(kind)
  }
  // …no duplicates…
  expect(new Set(kinds).size).toBe(kinds.length)
  // …and canonical (install < lint < typecheck < test < build) order.
  const indices = kinds.map(kind => KIND_INDEX.get(kind) as number)
  expect(indices).toEqual([...indices].sort((a, b) => a - b))
}

describe('classifyRunCommandKinds (fuzz)', () => {
  it('is total, shape-correct, and deterministic on 1000 random commands', () => {
    const rng = makeRng(0x5eed)
    for (let i = 0; i < 1000; i += 1) {
      const command = randomCommand(rng)
      let kinds: CiCommandKind[] = []
      expect(() => {
        kinds = classifyRunCommandKinds(command)
      }).not.toThrow()
      assertValidKindArray(kinds)
      // Same input always yields the same result.
      expect(classifyRunCommandKinds(command)).toEqual(kinds)
    }
  })

  it('classifies a recognized command chained after arbitrary noise', () => {
    // Metamorphic property: a clearly-recognized command chained after some
    // benign noise still surfaces its kind. The noise is stripped of shell-
    // significant characters (separators, line-continuation backslashes) so it
    // stays a single distinct command — otherwise it would legitimately merge
    // with or swallow the recognized command, which is correct shell behavior,
    // not a parser bug.
    const rng = makeRng(0xc0ffee)
    for (let i = 0; i < 200; i += 1) {
      const noise = randomToken(rng).replace(/[\\\n;&|]/g, '')
      expect(classifyRunCommandKinds(`echo ${noise} && npm test`)).toContain('test')
    }
  })
})

describe('classifyUsesCommandKinds (fuzz)', () => {
  it('is total and shape-correct on random uses strings', () => {
    const rng = makeRng(0xabcd)
    for (let i = 0; i < 500; i += 1) {
      const uses = randomCommand(rng).replace(/\s+/g, '/')
      let kinds: CiCommandKind[] = []
      expect(() => {
        kinds = classifyUsesCommandKinds(uses)
      }).not.toThrow()
      assertValidKindArray(kinds)
    }
  })
})

describe('detectCiWorkflows (fuzz)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-fuzz-ci-'))
    mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('never throws on malformed workflow YAML and always returns a valid evidence shape', () => {
    const rng = makeRng(0x1234)
    for (let i = 0; i < 300; i += 1) {
      // Build pseudo-YAML that is frequently invalid: stray indentation, unclosed
      // brackets, random run blocks, control characters.
      const lines: string[] = ['name: ' + randomToken(rng), 'jobs:']
      const jobCount = Math.floor(rng() * 3)
      for (let j = 0; j < jobCount; j += 1) {
        lines.push(`  job${j}:`)
        lines.push('    steps:')
        lines.push(`      - run: ${randomCommand(rng)}`)
        if (rng() < 0.3) {
          lines.push(`      - uses: ${randomToken(rng)}/${randomToken(rng)}@v${Math.floor(rng() * 9)}`)
        }
      }
      // Occasionally corrupt the document outright.
      if (rng() < 0.4) {
        lines.push('  [unclosed: {bracket')
      }
      writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), lines.join('\n'))

      let evidence: ReturnType<typeof detectCiWorkflows> | undefined
      expect(() => {
        evidence = detectCiWorkflows(root, ['.github/workflows/ci.yml'])
      }).not.toThrow()
      expect(evidence).toBeDefined()
      expect(Array.isArray(evidence?.workflowFiles)).toBe(true)
      expect(typeof evidence?.hasTest).toBe('boolean')
      assertValidKindArray(evidence?.orchestratorKinds ?? [])
    }
  })
})

describe('scanLocalReadiness on malformed manifests (fuzz)', () => {
  let root: string
  // Garbage manifests intentionally trip the "could not parse" warnings; silence
  // them so the expected noise does not flood the test output.
  let consoleError: jest.SpyInstance
  beforeAll(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterAll(() => consoleError.mockRestore())
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'agentready-fuzz-scan-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const manifests = ['package.json', 'pyproject.toml', 'setup.cfg', 'go.mod', 'Cargo.toml', 'Makefile']

  it('never throws and always produces a numeric score on garbage manifests', () => {
    const rng = makeRng(0x900d)
    for (let i = 0; i < 150; i += 1) {
      writeFileSync(path.join(root, 'README.md'), '# Fuzz\n')
      // Fill each well-known manifest with random, frequently-invalid content.
      for (const manifest of manifests) {
        const length = Math.floor(rng() * 200)
        let content = ''
        for (let c = 0; c < length; c += 1) {
          content += String.fromCharCode(Math.floor(rng() * 128))
        }
        // Bias package.json toward broken-but-JSON-ish shapes too.
        if (manifest === 'package.json' && rng() < 0.5) {
          content = `{"scripts": ${randomToken(rng)}, "name": ${rng() < 0.5 ? '123' : '"x"'}`
        }
        writeFileSync(path.join(root, manifest), content)
      }

      let score = NaN
      expect(() => {
        score = scanLocalReadiness(root, { now: new Date('2026-01-01T00:00:00.000Z') }).summary.score
      }).not.toThrow()
      expect(typeof score).toBe('number')
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })
})
