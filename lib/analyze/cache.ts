import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

// Content-hash cache for analyzer results (design §5.3, §8). The biggest cost
// lever: in CI most evidence is unchanged run-to-run, so a hit avoids the model
// call entirely. The key folds in everything that could change the answer —
// model, prompt version, schema version, and the sliced input — so a bump to any
// of them is a clean miss rather than a stale hit.

export interface CacheKeyParts {
  model: string
  promptVersion: string
  schemaVersion: string
  input: string
}

/** Deterministic cache key over everything that affects the result. */
export const cacheKey = (parts: CacheKeyParts): string => {
  const hash = createHash('sha256')
  hash.update(parts.model)
  hash.update('\0')
  hash.update(parts.promptVersion)
  hash.update('\0')
  hash.update(parts.schemaVersion)
  hash.update('\0')
  hash.update(parts.input)
  return hash.digest('hex')
}

/** A cache stores and retrieves a previously computed analyzer payload by key. */
export interface AnalyzeCache {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
}

/** A no-op cache: every lookup misses. Used when caching is disabled. */
export const nullCache: AnalyzeCache = {
  get: () => undefined,
  set: () => undefined,
}

/** An in-memory cache, handy for a single run and for tests. */
export const createMemoryCache = (): AnalyzeCache => {
  const store = new Map<string, unknown>()
  return {
    get: key => store.get(key),
    set: (key, value) => {
      store.set(key, value)
    },
  }
}

/**
 * A filesystem cache writing one JSON file per key under `dir`. Reads tolerate
 * missing/corrupt files by returning a miss, so a damaged cache degrades to
 * recomputation rather than failing the run.
 *
 * The key folds in the model, prompt version, and schema version, so bumping any
 * of them changes the key: old entries become unreachable (never a stale hit)
 * but are not pruned. The cache is therefore safe to leave in place across
 * upgrades; delete the directory (or pass `--no-cache`) to reclaim space.
 */
export const createFileCache = (dir: string): AnalyzeCache => {
  const fileFor = (key: string): string => path.join(dir, `${key}.json`)
  return {
    get(key) {
      const file = fileFor(key)
      if (!existsSync(file)) return undefined
      try {
        return JSON.parse(readFileSync(file, 'utf8'))
      } catch {
        return undefined
      }
    },
    set(key, value) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(fileFor(key), `${JSON.stringify(value, null, 2)}\n`)
    },
  }
}
