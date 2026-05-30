import path from 'path'
import { cosmiconfigSync, defaultLoadersSync, type Loader, type Loaders } from 'cosmiconfig'
import type { LocalReadinessConfig, ScanOptions } from './types'
import { localReadinessConfigSchema } from './schemas'
import { normalizeRepoPath } from './util'

export const defaultConfig: LocalReadinessConfig = {
  ignorePaths: [],
  largeFileWarningBytes: 1_000_000,
  largeFileErrorBytes: 5_000_000,
  allowMinifiedFiles: false,
  errorOnWarnings: false,
}

const MODULE_NAME = 'agentready'

// AgentReady must never execute repository code: loading an executable config
// (.js/.ts/.cjs/.mjs) from the scanned tree would run repo code before any
// detector, breaking the never-execute / offline guarantee. So discovery is
// restricted to data-only formats. We both (a) omit executable extensions from
// the search places and (b) override cosmiconfig's default JS/TS loaders with a
// refusing loader — cosmiconfig *merges* custom loaders over its defaults, so
// omitting them is not enough on its own.
const refuseExecutableConfig: Loader = (filepath: string) => {
  throw new Error(
    `AgentReady will not execute config file ${filepath}; use JSON, YAML, or package.json#${MODULE_NAME}.`,
  )
}

const dataLoaders: Loaders = {
  '.json': defaultLoadersSync['.json'],
  '.yaml': defaultLoadersSync['.yaml'],
  '.yml': defaultLoadersSync['.yml'],
  noExt: defaultLoadersSync['.yaml'],
  '.js': refuseExecutableConfig,
  '.cjs': refuseExecutableConfig,
  '.mjs': refuseExecutableConfig,
  '.ts': refuseExecutableConfig,
}

// Data-only search places, in precedence order. The legacy
// `.agentready.json`/`agentready.config.json` names are kept for compatibility;
// `package.json#agentready`, rc files, and YAML variants are added via
// cosmiconfig. No executable (`.js`/`.ts`/...) places are listed.
const SEARCH_PLACES = [
  'package.json',
  '.agentready.json',
  'agentready.config.json',
  '.agentreadyrc',
  '.agentreadyrc.json',
  '.agentreadyrc.yaml',
  '.agentreadyrc.yml',
  'agentready.config.yaml',
  'agentready.config.yml',
]

const createExplorer = (root: string) =>
  cosmiconfigSync(MODULE_NAME, {
    searchPlaces: SEARCH_PLACES,
    loaders: dataLoaders,
    // Restrict discovery to the scanned root; do not walk up into parent
    // directories (which could pull in unrelated, possibly untrusted config).
    stopDir: root,
  })

const coerceConfig = (rawConfig: unknown, source: string): Partial<LocalReadinessConfig> => {
  const result = localReadinessConfigSchema.safeParse(rawConfig)
  if (!result.success) {
    const details = result.error.issues
      .map(issue => `${source}${issue.path.length ? `.${issue.path.join('.')}` : ''} ${issue.message}`)
      .join('; ')
    throw new Error(details)
  }

  const config: Partial<LocalReadinessConfig> = { ...result.data }
  if (config.ignorePaths) {
    config.ignorePaths = config.ignorePaths.map(normalizeRepoPath)
  }

  return config
}

const loadExplicitConfig = (root: string, configPath: string): Partial<LocalReadinessConfig> => {
  const explicit = path.resolve(root, configPath)
  try {
    const result = createExplorer(root).load(explicit)
    return result && !result.isEmpty ? coerceConfig(result.config, result.filepath) : {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      throw new Error(`AgentReady config file not found: ${explicit}`)
    }
    throw error instanceof Error
      ? error
      : new Error(`Could not read AgentReady config ${explicit}: ${String(error)}`)
  }
}

const discoverConfig = (root: string): Partial<LocalReadinessConfig> => {
  let result: ReturnType<ReturnType<typeof createExplorer>['search']>
  try {
    result = createExplorer(root).search(root)
  } catch (error) {
    // Discovery walks data-only candidates (including package.json). A malformed
    // sibling file must not crash the scan — the file-level detectors already
    // tolerate, e.g., a broken package.json. Degrade to "no discovered config"
    // and warn. Explicit --config (loadExplicitConfig) stays strict.
    console.error(
      `AgentReady: ignoring config discovery error: ${error instanceof Error ? error.message : String(error)}`,
    )
    return {}
  }
  // Schema validation errors from coerceConfig are intentionally *not* caught:
  // a structurally valid but semantically invalid config should still fail.
  return result && !result.isEmpty ? coerceConfig(result.config, result.filepath) : {}
}

export const loadConfig = (root: string, options: ScanOptions): LocalReadinessConfig => {
  const loadedConfig = options.configPath
    ? loadExplicitConfig(root, options.configPath)
    : discoverConfig(root)

  const merged = {
    ...defaultConfig,
    ...loadedConfig,
    ...options.config,
  }

  if (merged.largeFileErrorBytes < merged.largeFileWarningBytes) {
    throw new Error('largeFileErrorBytes must be greater than or equal to largeFileWarningBytes')
  }

  return merged
}
