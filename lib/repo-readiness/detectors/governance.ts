import type { GovernanceEvidence } from '../core/types'

// GitHub recognizes CODEOWNERS at the repo root, .github/, or docs/ (in that
// precedence order, though we only need "does one exist" here).
const CODEOWNERS_PATTERN = /^(?:\.github\/|docs\/)?CODEOWNERS$/i
// A single pull-request-template file at root/.github/docs/, or any file
// inside a .github/PULL_REQUEST_TEMPLATE/ directory of multiple templates.
const PR_TEMPLATE_FILE_PATTERN = /^(?:\.github\/|docs\/)?PULL_REQUEST_TEMPLATE(\.[^./]+)?$/i
const PR_TEMPLATE_DIR_PATTERN = /^\.github\/PULL_REQUEST_TEMPLATE\//i

/**
 * Detects review-routing surfaces: a CODEOWNERS file and a pull-request
 * template, at any path GitHub itself recognizes. Presence-only — this does
 * not infer actual ownership boundaries from git history or CODEOWNERS'
 * path rules.
 */
export const detectGovernance = (filePaths: string[]): GovernanceEvidence => ({
  codeownersPath: filePaths.find(filePath => CODEOWNERS_PATTERN.test(filePath)),
  pullRequestTemplatePath: filePaths.find(
    filePath => PR_TEMPLATE_FILE_PATTERN.test(filePath) || PR_TEMPLATE_DIR_PATTERN.test(filePath),
  ),
})
