import type { LocalReadinessReport } from '../core/types'

// Conventional top-level names for architecture/design/development notes.
const ARCHITECTURE_ROOT_NAMES = /(^|\/)(ARCHITECTURE|DESIGN|DEVELOPMENT|INTERNALS|HACKING)(\.[^.]+)?$/i
// Architecture/design/development docs living inside a docs/ tree, e.g.
// `docs/design.rst`, `docs/architecture/overview.md`, `doc/development.md`.
const ARCHITECTURE_DOC_TREE = /(^|\/)docs?\/.*\b(architecture|design|internals|development)\b/i

/**
 * Detects the documentation entrypoints agents look for first: README,
 * CONTRIBUTING, architecture/development notes, and environment templates.
 */
export const detectDocs = (filePaths: string[]): LocalReadinessReport['docs'] => ({
  readme: filePaths.filter(filePath => /(^|\/)README(\.[^.]+)?$/i.test(filePath)).sort(),
  contributing: filePaths.filter(filePath => /(^|\/)CONTRIBUTING(\.[^.]+)?$/i.test(filePath)).sort(),
  architecture: filePaths
    .filter(filePath => ARCHITECTURE_ROOT_NAMES.test(filePath) || ARCHITECTURE_DOC_TREE.test(filePath))
    .sort(),
  environment: filePaths.filter(filePath => /(^|\/)(\.env\.example|\.env\.sample|env\.example)$/i.test(filePath)).sort(),
})
