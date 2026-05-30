import { existsSync, readFileSync } from 'fs'
import path from 'path'
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
