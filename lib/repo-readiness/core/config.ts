import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { LocalReadinessConfig, ScanOptions } from './types'
import { isObject, isStringArray, normalizeRepoPath } from './util'

export const defaultConfig: LocalReadinessConfig = {
  ignorePaths: [],
  largeFileWarningBytes: 1_000_000,
  largeFileErrorBytes: 5_000_000,
  allowMinifiedFiles: false,
  errorOnWarnings: false,
}

const coerceConfig = (rawConfig: unknown, source: string): Partial<LocalReadinessConfig> => {
  if (!isObject(rawConfig)) {
    throw new Error(`${source} must be a JSON object`)
  }

  const config: Partial<LocalReadinessConfig> = {}

  if ('ignorePaths' in rawConfig) {
    if (!isStringArray(rawConfig.ignorePaths)) {
      throw new Error(`${source}.ignorePaths must be an array of strings`)
    }
    config.ignorePaths = rawConfig.ignorePaths.map(normalizeRepoPath)
  }

  for (const key of ['largeFileWarningBytes', 'largeFileErrorBytes'] as const) {
    if (key in rawConfig) {
      const value = rawConfig[key]
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new Error(`${source}.${key} must be a non-negative integer`)
      }
      config[key] = value
    }
  }

  for (const key of ['allowMinifiedFiles', 'errorOnWarnings'] as const) {
    if (key in rawConfig) {
      const value = rawConfig[key]
      if (typeof value !== 'boolean') {
        throw new Error(`${source}.${key} must be a boolean`)
      }
      config[key] = value
    }
  }

  return config
}

const readConfigFile = (configPath: string): Partial<LocalReadinessConfig> => {
  let rawConfig: unknown
  try {
    rawConfig = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read AgentReady config ${configPath}: ${error instanceof Error ? error.message : String(error)}`)
  }

  return coerceConfig(rawConfig, configPath)
}

export const loadConfig = (root: string, options: ScanOptions): LocalReadinessConfig => {
  const configCandidates = options.configPath
    ? [path.resolve(root, options.configPath)]
    : ['.agentready.json', 'agentready.config.json'].map(candidate => path.join(root, candidate))

  const fileConfig = configCandidates.find(candidate => existsSync(candidate))
  if (options.configPath && !fileConfig) {
    throw new Error(`AgentReady config file not found: ${path.resolve(root, options.configPath)}`)
  }

  const loadedConfig = fileConfig ? readConfigFile(fileConfig) : {}
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
