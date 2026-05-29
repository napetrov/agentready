import type { LocalReadinessReport } from '../core/types'

/**
 * Detects the documentation entrypoints agents look for first: README,
 * CONTRIBUTING, architecture/development notes, and environment templates.
 */
export const detectDocs = (filePaths: string[]): LocalReadinessReport['docs'] => ({
  readme: filePaths.filter(filePath => /(^|\/)README(\.[^.]+)?$/i.test(filePath)).sort(),
  contributing: filePaths.filter(filePath => /(^|\/)CONTRIBUTING(\.[^.]+)?$/i.test(filePath)).sort(),
  architecture: filePaths.filter(filePath => /(^|\/)(ARCHITECTURE|DEVELOPMENT)(\.[^.]+)?$/i.test(filePath)).sort(),
  environment: filePaths.filter(filePath => /(^|\/)(\.env\.example|\.env\.sample|env\.example)$/i.test(filePath)).sort(),
})

/** Detects GitHub Actions workflow files. */
export const detectCiWorkflows = (filePaths: string[]): LocalReadinessReport['ci'] => ({
  workflowFiles: filePaths.filter(filePath => filePath.startsWith('.github/workflows/')).sort(),
})
