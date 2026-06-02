import type { ReadinessSeverity } from '../core/types'

/**
 * Human-facing documentation for a single readiness rule. The deterministic
 * detectors in `built-in.ts` emit findings whose ids start with a stable rule
 * key (the portion before any `:instance` suffix); this catalog is keyed by
 * that rule key and powers the `explain` command. Keeping it separate from the
 * detectors lets us document rationale/references without bloating the hot path.
 */
export interface RuleDoc {
  /** Stable rule key (the prefix of a finding id before any `:instance`). */
  id: string
  /** Short title, matching the finding title the detector emits. */
  title: string
  /** Grouping used for display and filtering. */
  category: 'docs' | 'commands' | 'ci' | 'instructions' | 'files' | 'safety'
  /**
   * Default severity. Some `warning` rules escalate to `error` when
   * `errorOnWarnings` is set; `safety.*` severities vary by category.
   */
  defaultSeverity: ReadinessSeverity
  /** Why this matters specifically for AI coding agents. */
  rationale: string
  /** Concrete remediation steps / examples. */
  remediation: string[]
  /** Supporting references (specs, docs). */
  references: string[]
}

const DOCS = 'docs/product/features.md'
const AGENTS_MD = 'https://agents.md/'

export const RULE_CATALOG: Record<string, RuleDoc> = {
  'docs.readme.missing': {
    id: 'docs.readme.missing',
    title: 'Repository has no README',
    category: 'docs',
    defaultSeverity: 'error',
    rationale:
      'A README is the first thing an agent reads to orient itself. Without it, an agent must infer purpose, setup, and validation commands from raw source, which wastes context budget and leads to wrong assumptions.',
    remediation: [
      'Add a root README.md.',
      'Cover: what the project does, how to install/build, how to run tests, and the common entrypoints an agent should touch.',
    ],
    references: [DOCS],
  },
  'docs.developer.thin': {
    id: 'docs.developer.thin',
    title: 'Non-trivial repository has thin developer documentation',
    category: 'docs',
    defaultSeverity: 'info',
    rationale:
      'In a non-trivial codebase (>20 source files) an agent needs more than a README to make changes in the right place: a map of module boundaries and data flow, plus contribution conventions. This fires only when the whole developer-facing doc surface is thin — no CONTRIBUTING, no architecture/design/development notes, and no populated docs/ tree — so a project documented through any of those channels stays silent.',
    remediation: [
      'Add at least one developer-facing doc: a CONTRIBUTING guide, an ARCHITECTURE.md/DESIGN.md, or a docs/ section.',
      'Describe module boundaries, data flow, and where changes usually belong, and link it from the README.',
    ],
    references: [DOCS],
  },
  'commands.test.missing': {
    id: 'commands.test.missing',
    title: 'No test command detected',
    category: 'commands',
    defaultSeverity: 'error',
    rationale:
      'Agents rely on a stable, discoverable test command to verify their own changes. Without one, an agent cannot close the loop and reviewers inherit unverified work.',
    remediation: [
      'Expose a test command in package scripts (e.g. "test") or documented project tooling (Makefile target, go test, cargo test, pytest).',
      'Make it runnable from a clean checkout.',
    ],
    references: [DOCS],
  },
  'commands.lint.missing': {
    id: 'commands.lint.missing',
    title: 'No lint command detected',
    category: 'commands',
    defaultSeverity: 'warning',
    rationale:
      'A lint command lets an agent catch style and static-analysis regressions before review, reducing back-and-forth and keeping diffs consistent with project conventions.',
    remediation: [
      'Expose a lint command (e.g. "lint" script, golangci-lint, ruff, clippy).',
      'Run it in CI so the signal is enforced.',
    ],
    references: [DOCS],
  },
  'commands.typecheck.missing': {
    id: 'commands.typecheck.missing',
    title: 'TypeScript repository has no type-check command',
    category: 'commands',
    defaultSeverity: 'warning',
    rationale:
      'TypeScript repositories without a type-check command leave type errors to surface only at build or runtime, which an agent cannot see while editing.',
    remediation: [
      'Add a type-check command (e.g. "type-check": "tsc --noEmit").',
      'Run it in CI.',
    ],
    references: [DOCS],
  },
  'ci.workflow.missing': {
    id: 'ci.workflow.missing',
    title: 'No CI workflow detected',
    category: 'ci',
    defaultSeverity: 'warning',
    rationale:
      'CI is the objective verification surface for agent changes. Without it, "passes locally" is the only signal and regressions reach the default branch unchecked.',
    remediation: [
      'Add a CI workflow that runs install, lint, type-check, tests, and build where applicable.',
      'For GitHub, add a workflow under .github/workflows/.',
    ],
    references: [DOCS, 'https://docs.github.com/actions'],
  },
  'ci.test.not-run': {
    id: 'ci.test.not-run',
    title: 'Tests are available but CI does not run them',
    category: 'ci',
    defaultSeverity: 'info',
    rationale:
      'A test command an agent can run locally is only half the loop; if CI never runs it, regressions still reach the default branch and "verified locally" is the only signal. AgentReady parses the workflow steps and found no test invocation.',
    remediation: [
      'Add a step that runs the test command to a CI workflow under .github/workflows/.',
      'If CI runs tests through a composite or marketplace action AgentReady does not recognize, this may be a false positive — file the action so it can be classified.',
    ],
    references: [DOCS, 'https://docs.github.com/actions'],
  },
  'ci.lint.not-run': {
    id: 'ci.lint.not-run',
    title: 'A lint command is available but CI does not run it',
    category: 'ci',
    defaultSeverity: 'info',
    rationale:
      'Lint enforced only locally drifts: an agent cannot rely on it as an objective gate, and style/static-analysis regressions land unchecked. AgentReady parsed the workflow steps and found no lint invocation.',
    remediation: [
      'Add a step that runs the lint command to a CI workflow.',
      'If CI lints through an action AgentReady does not recognize, this may be a false positive.',
    ],
    references: [DOCS, 'https://docs.github.com/actions'],
  },
  'ci.typecheck.not-run': {
    id: 'ci.typecheck.not-run',
    title: 'A type-check command is available but CI does not run it',
    category: 'ci',
    defaultSeverity: 'info',
    rationale:
      'Type errors that surface only on a developer machine are invisible to reviewers and to the next agent. Running the type-check in CI makes it an enforced gate. AgentReady parsed the workflow steps and found no type-check invocation.',
    remediation: [
      'Add a step that runs the type-check command (e.g. tsc --noEmit, mypy) to a CI workflow.',
      'If CI type-checks through an action AgentReady does not recognize, this may be a false positive.',
    ],
    references: [DOCS, 'https://docs.github.com/actions'],
  },
  'ci.build.not-run': {
    id: 'ci.build.not-run',
    title: 'A build command is available but CI does not run it',
    category: 'ci',
    defaultSeverity: 'info',
    rationale:
      'A build that runs only locally lets broken builds reach the default branch. Running it in CI catches that earlier. This is informational because some projects build only at publish time.',
    remediation: [
      'Consider adding a build step to a CI workflow.',
      'If CI builds through an action AgentReady does not recognize, this may be a false positive.',
    ],
    references: [DOCS, 'https://docs.github.com/actions'],
  },
  'instructions.missing': {
    id: 'instructions.missing',
    title: 'No agent instruction surface detected',
    category: 'instructions',
    defaultSeverity: 'warning',
    rationale:
      'Instruction files (AGENTS.md and tool-specific equivalents) are where a repository tells an agent its conventions, validation commands, and do-not-touch areas. Their absence forces every agent to rediscover them.',
    remediation: [
      'Add an AGENTS.md (or the relevant agent-specific instruction file) at the repo root.',
      'Include repo conventions, the canonical validation commands, and any constraints.',
    ],
    references: [DOCS, AGENTS_MD],
  },
  'instructions.local-private': {
    id: 'instructions.local-private',
    title: 'Local/private agent instruction file is present',
    category: 'instructions',
    defaultSeverity: 'warning',
    rationale:
      'Local/private instruction files (e.g. *.local.md) checked into shared history can leak machine-specific or personal guidance into everyone\'s agent context, which is usually unintended.',
    remediation: [
      'Keep local-private instruction files out of shared history (gitignore them) unless sharing is intentional.',
      'If intentional, document why in the file itself.',
    ],
    references: [AGENTS_MD],
  },
  'files.large': {
    id: 'files.large',
    title: 'Large checked-in file can create agent context friction',
    category: 'files',
    defaultSeverity: 'warning',
    rationale:
      'Large checked-in files (above the configured threshold) bloat an agent\'s context when scanned and slow clones/builds. Above the error threshold they are almost never source an agent should read.',
    remediation: [
      'Move large assets/data out of the main source tree (artifact storage, Git LFS, or a data package).',
      'If intentional, add the path to AgentReady ignorePaths so it is not penalized.',
    ],
    references: [DOCS],
  },
  'files.minified': {
    id: 'files.minified',
    title: 'Minified file is checked into the repository',
    category: 'files',
    defaultSeverity: 'warning',
    rationale:
      'Minified files are build output, not source. An agent that tries to read or edit them wastes context and may "fix" generated artifacts instead of their source.',
    remediation: [
      'Prefer generating build output outside source control.',
      'If the minified file must be committed, set allowMinifiedFiles or ignore it in AgentReady policy.',
    ],
    references: [DOCS],
  },
  'safety.install-hook': {
    id: 'safety.install-hook',
    title: 'Install lifecycle script runs automatically',
    category: 'safety',
    defaultSeverity: 'info',
    rationale:
      'Install-time lifecycle scripts (preinstall/postinstall, etc.) run automatically on dependency install. An agent should know they exist so it does not run install blindly in an untrusted repo.',
    remediation: [
      'Document what the install hook does and whether it is safe for an agent to run.',
      'Prefer explicit, reviewable build steps over implicit install hooks where possible.',
    ],
    references: ['https://docs.npmjs.com/cli/using-npm/scripts'],
  },
  'safety.destructive': {
    id: 'safety.destructive',
    title: 'Package script runs a destructive command',
    category: 'safety',
    defaultSeverity: 'warning',
    rationale:
      'Scripts that run destructive commands (e.g. rm -rf) are unsafe for an agent to invoke without understanding scope, and can cause data loss if run in the wrong directory.',
    remediation: [
      'Document whether agents may run the script, and scope destructive commands narrowly.',
      'Gate genuinely destructive operations behind explicit, reviewed steps.',
    ],
    references: [DOCS],
  },
  'safety.network-exec': {
    id: 'safety.network-exec',
    title: 'Package script pipes a network download into a shell',
    category: 'safety',
    defaultSeverity: 'warning',
    rationale:
      'Piping a network download straight into a shell (curl ... | sh) executes unreviewed remote code. An agent running such a script trusts an external endpoint implicitly.',
    remediation: [
      'Pin and vendor the downloaded artifact, or verify a checksum before executing.',
      'Document whether agents may run the script.',
    ],
    references: [DOCS],
  },
  'safety.deploy': {
    id: 'safety.deploy',
    title: 'Package script deploys or publishes',
    category: 'safety',
    defaultSeverity: 'info',
    rationale:
      'Deploy/publish scripts have outward-facing side effects (releasing packages, deploying infra). An agent should recognize them so it never triggers a release as a side effect of "running the build".',
    remediation: [
      'Document deploy/publish scripts and gate them behind explicit human approval.',
      'Keep them out of default verification commands an agent might run.',
    ],
    references: [DOCS],
  },
}

/** Resolves a rule key from a rule id or an instance finding id (`rule:instance`). */
export const ruleKeyFor = (findingOrRuleId: string): string => findingOrRuleId.split(':')[0]

/** Looks up rule documentation by rule id or full finding id. */
export const getRuleDoc = (findingOrRuleId: string): RuleDoc | undefined =>
  RULE_CATALOG[ruleKeyFor(findingOrRuleId)]

/** Sorted list of documented rule ids. */
export const listRuleIds = (): string[] => Object.keys(RULE_CATALOG).sort()

/** Renders a rule's documentation as human-readable text for the CLI. */
export const formatRuleDoc = (doc: RuleDoc): string => {
  const lines = [
    `${doc.id}  [${doc.category}, default severity: ${doc.defaultSeverity}]`,
    doc.title,
    '',
    'Why it matters:',
    `  ${doc.rationale}`,
    '',
    'How to fix:',
    ...doc.remediation.map(step => `  - ${step}`),
  ]
  if (doc.references.length > 0) {
    lines.push('', 'References:', ...doc.references.map(ref => `  - ${ref}`))
  }
  return lines.join('\n')
}
