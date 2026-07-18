import { calculateScore } from '../core/scoring'
import type {
  AgentStage,
  AutonomyStageResult,
  ReadinessDimensionScore,
  ReadinessFinding,
  ReadinessRuleCategory,
  ReadinessSeverity,
} from '../core/types'

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
  category: ReadinessRuleCategory
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
  /** Which points in an agent's workflow this rule affects. Powers `calculateAutonomyEnvelope`. */
  affectedStages: AgentStage[]
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
    affectedStages: ['orient'],
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
    affectedStages: ['orient', 'navigate'],
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
    affectedStages: ['bootstrap', 'verify'],
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
    affectedStages: ['verify'],
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
    affectedStages: ['verify'],
  },
  'commands.reference.npm-script': {
    id: 'commands.reference.npm-script',
    title: 'Instruction/README references an npm/yarn/pnpm/bun script that does not exist',
    category: 'commands',
    defaultSeverity: 'warning',
    rationale:
      'An agent that trusts a documented command (e.g. `npm run buld`) wastes a turn discovering it fails, and may guess the wrong replacement. AgentReady only flags unambiguous `<manager> run <script>` and bare `test`/`start` forms against the detected package.json scripts, to keep false positives low.',
    remediation: [
      'Fix the typo, or add the missing script to package.json.',
      'If the command is intentionally illustrative (not meant to be copy-pasted), say so nearby.',
    ],
    references: [DOCS],
    affectedStages: ['bootstrap', 'verify'],
  },
  'commands.reference.make-target': {
    id: 'commands.reference.make-target',
    title: 'Instruction/README references a make target that does not exist',
    category: 'commands',
    defaultSeverity: 'warning',
    rationale:
      'A documented `make test`/`make lint` that no longer has a matching Makefile target sends an agent down a dead end.',
    remediation: [
      'Fix the typo, or add the missing target to the Makefile.',
      'If the command is intentionally illustrative, say so nearby.',
    ],
    references: [DOCS],
    affectedStages: ['bootstrap', 'verify'],
  },
  'commands.reference.package-manager-mismatch': {
    id: 'commands.reference.package-manager-mismatch',
    title: 'Instruction/README references a different package manager than the lockfile',
    category: 'commands',
    defaultSeverity: 'info',
    rationale:
      'Guidance that says "npm install" in a repo whose lockfile is pnpm-lock.yaml can produce a second, conflicting lockfile if an agent follows it literally. This is a softer text heuristic than the script/target checks — docs can legitimately discuss more than one package manager — so it stays informational.',
    remediation: [
      'Update the instructions to reference the package manager the lockfile implies.',
      'If multiple package managers are genuinely supported, say so explicitly.',
    ],
    references: [DOCS],
    affectedStages: ['bootstrap'],
  },
  'commands.reference.shortcut-script': {
    id: 'commands.reference.shortcut-script',
    title: 'Instruction/README references a package-manager shortcut for a script that does not exist',
    category: 'commands',
    defaultSeverity: 'warning',
    rationale:
      'A code-formatted `<manager> <word>` shortcut (e.g. `pnpm dev`) that is neither a real package-manager built-in nor an existing package.json script sends an agent down the same dead end as `npm run buld` — it just skips the "run" keyword. AgentReady only flags this when the word matches neither a curated per-manager built-in-verb allowlist nor a real script, and the reference is shown as Markdown code (inline `` ` `` span or a fenced block), to keep prose that merely discusses a package manager (e.g. "the pnpm ecosystem") from being misread as a command.',
    remediation: [
      'Add the missing script to package.json, or fix the reference to an existing one.',
      'If the shortcut is intentionally illustrative, say so nearby.',
    ],
    references: [DOCS],
    affectedStages: ['bootstrap', 'verify'],
  },
  'instructions.contradiction.package-manager': {
    id: 'instructions.contradiction.package-manager',
    title: 'Agent instruction files disagree with each other',
    category: 'instructions',
    defaultSeverity: 'warning',
    rationale:
      'Root-scope, always-active instruction files (AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, GEMINI.md, …) are loaded into an agent\'s context together. When two of them each exclusively reference a different package manager, an agent has no way to tell which is authoritative and may install with the wrong one, creating a second, conflicting lockfile.',
    remediation: [
      'Reconcile the instruction files on one canonical package manager, or scope one file to a specific context (e.g. a nested AGENTS.md for a subdirectory that genuinely uses a different tool).',
      'If both package managers are genuinely supported (e.g. a mixed workspace), say so explicitly in both files.',
    ],
    references: [DOCS, AGENTS_MD],
    affectedStages: ['orient', 'bootstrap'],
  },
  'docs.codeowners.missing': {
    id: 'docs.codeowners.missing',
    title: 'No CODEOWNERS file detected',
    category: 'docs',
    defaultSeverity: 'info',
    rationale:
      'Without CODEOWNERS, neither a human nor an agent knows who should review a change, so a PR can sit unassigned. Fires only for non-trivial repos (>20 source files), where more than one likely reviewer makes routing matter.',
    remediation: [
      'Add a CODEOWNERS file at the repo root, .github/, or docs/.',
      'Map at least the main source directories to a reviewer or team.',
    ],
    references: [DOCS, 'https://docs.github.com/articles/about-code-owners'],
    affectedStages: ['review', 'merge'],
  },
  'docs.pull-request-template.missing': {
    id: 'docs.pull-request-template.missing',
    title: 'No pull-request template detected',
    category: 'docs',
    defaultSeverity: 'info',
    rationale:
      'A PR template tells an agent what evidence a reviewer expects — files changed and why, verification commands run, known skipped checks — instead of leaving it to guess.',
    remediation: [
      'Add .github/pull_request_template.md (or docs/, or a root pull_request_template.md).',
      'Include a short checklist: what changed, why, and how it was verified.',
    ],
    references: [DOCS, 'https://docs.github.com/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository'],
    affectedStages: ['review'],
  },
  'docs.codeowners.coverage-gap': {
    id: 'docs.codeowners.coverage-gap',
    title: 'CODEOWNERS does not appear to cover actively-changed directories',
    category: 'docs',
    defaultSeverity: 'info',
    rationale:
      'A CODEOWNERS file that exists but does not match where changes actually happen is nearly as unhelpful as no CODEOWNERS at all: PRs touching those directories still route to no reviewer. Computed from local git history only (the most recent commits touching the scanned root), approximating CODEOWNERS\' gitignore-style patterns against top-level directories rather than its full path-rule semantics — a directory listed here is a hint to double-check coverage, not a guaranteed gap.',
    remediation: [
      'Add a CODEOWNERS pattern covering the listed directories, or confirm an existing broader pattern (e.g. "*") is intentional.',
      'If a directory is intentionally unowned (e.g. generated output, vendored code), consider a comment in CODEOWNERS explaining why.',
    ],
    references: [DOCS, 'https://docs.github.com/articles/about-code-owners'],
    affectedStages: ['review', 'merge'],
  },
  'governance.codeowners.protected-path-gap': {
    id: 'governance.codeowners.protected-path-gap',
    title: 'CODEOWNERS does not cover a structurally high-risk path',
    category: 'docs',
    defaultSeverity: 'info',
    rationale:
      'Some paths (agent/CI configuration, auth, migrations, deploy/infra, prompts, recorded-interaction fixtures) are risky by nature, not just by how often they change — a rarely touched deploy script can matter more than a frequently-edited README. `docs.codeowners.coverage-gap` only flags directories with sustained recent commit activity, which can miss exactly these paths. This check compares a fixed set of protected-path globs against CODEOWNERS instead, independent of activity.',
    remediation: [
      'Add a CODEOWNERS pattern covering the listed path.',
      'If a path is intentionally unowned, consider a comment in CODEOWNERS explaining why.',
    ],
    references: [DOCS, 'https://docs.github.com/articles/about-code-owners'],
    affectedStages: ['review', 'merge'],
  },
  'governance.codeowners.single-owner-risk': {
    id: 'governance.codeowners.single-owner-risk',
    title: 'CODEOWNERS routes a high-risk path to a single individual with no backup',
    category: 'docs',
    defaultSeverity: 'info',
    rationale:
      'A high-risk path (agent/CI configuration, auth, migrations, deploy/infra, ...) owned by exactly one named individual, rather than a team or multiple owners, means review of that path depends entirely on one person\'s availability. AgentReady cannot verify actual team membership locally, so a team owner (@org/team) is always treated as adequately covered.',
    remediation: [
      'Add a team or a second individual as an additional owner for the listed path.',
      'If a single named owner is intentional (e.g. a dedicated maintainer), document why.',
    ],
    references: [DOCS, 'https://docs.github.com/articles/about-code-owners'],
    affectedStages: ['review', 'merge'],
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
    affectedStages: ['verify', 'merge'],
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
    affectedStages: ['verify'],
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
    affectedStages: ['verify'],
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
    affectedStages: ['verify'],
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
    affectedStages: ['verify'],
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
    affectedStages: ['orient', 'navigate'],
  },
  'instructions.portable-entrypoint.missing': {
    id: 'instructions.portable-entrypoint.missing',
    title: 'Agent instructions are not exposed through a portable entrypoint',
    category: 'instructions',
    defaultSeverity: 'info',
    rationale:
      'Any recognized instruction surface satisfies `instructions.missing` — AgentReady deliberately does not assume one filename is universally canonical, so this stays informational by default. A repository that centers exclusively on a vendor-specific surface (e.g. only CLAUDE.md, no AGENTS.md) works fine for a single coding agent, but becomes a real portability gap once more than one agent tool is expected to work in the repository.',
    remediation: [
      'Add AGENTS.md (https://agents.md/) alongside any tool-specific instruction file.',
      'Keep tool-specific files as thin pointers to AGENTS.md where practical, so conventions live in one place.',
    ],
    references: [DOCS, AGENTS_MD],
    affectedStages: ['orient'],
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
    affectedStages: ['orient'],
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
    affectedStages: ['navigate', 'edit'],
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
    affectedStages: ['navigate', 'edit'],
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
    affectedStages: ['bootstrap'],
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
    affectedStages: ['edit', 'verify'],
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
    affectedStages: ['bootstrap', 'edit'],
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
    affectedStages: ['deploy'],
  },
  'safety.agent-hook.executes-repository-code': {
    id: 'safety.agent-hook.executes-repository-code',
    title: 'Agent session hook automatically executes a dependency-install command',
    category: 'safety',
    defaultSeverity: 'warning',
    rationale:
      'Neither an install-lifecycle package script nor "a hook surface exists" names the specific chained risk: an agent-tool hook event that fires automatically (no explicit user action -- e.g. Claude Code\'s SessionStart) whose command runs a package-manager install. An agent that checks out an untrusted branch and starts a session on it can trigger that branch\'s own install-time lifecycle scripts (preinstall/postinstall/prepare) before anyone reviews them.',
    remediation: [
      'Move the install step behind an explicit, reviewed action instead of an automatic session hook.',
      'If the hook must stay automatic, document that it executes whatever install-time scripts the checked-out branch defines, and restrict which branches/sessions can trigger it.',
    ],
    references: [DOCS],
    affectedStages: ['bootstrap'],
  },
  'safety.capability.high-risk': {
    id: 'safety.capability.high-risk',
    title: 'High blast-radius agent capability surface detected',
    category: 'safety',
    defaultSeverity: 'info',
    rationale:
      'An MCP server config, hook script, configured hooks block, or plugin manifest can run arbitrary commands or grant an agent tools whose scope this scanner cannot verify statically (an MCP server\'s actual tool set is only visible over the protocol at runtime, not in its launch config). Listing every capability surface as equally "present" hides which ones actually widen what an agent can do.',
    remediation: [
      'Review what the MCP server, hook, or plugin actually grants access to before approving it for agent use.',
      'Route high-risk capability surfaces through an approval workflow (e.g. the enterprise policy pack) rather than trusting presence alone.',
    ],
    references: [DOCS, 'https://modelcontextprotocol.io/'],
    affectedStages: ['edit', 'merge'],
  },
}

/** Every dimension axis, in the order reports should display them. */
export const RULE_CATEGORIES: ReadinessRuleCategory[] = ['docs', 'commands', 'ci', 'instructions', 'files', 'safety']

/** Resolves a rule key from a rule id or an instance finding id (`rule:instance`). */
export const ruleKeyFor = (findingOrRuleId: string): string => findingOrRuleId.split(':')[0]

/** Looks up rule documentation by rule id or full finding id. */
export const getRuleDoc = (findingOrRuleId: string): RuleDoc | undefined =>
  RULE_CATALOG[ruleKeyFor(findingOrRuleId)]

/**
 * Splits findings by the catalog category their rule is filed under and scores
 * each group with the same penalty model as the overall score, so e.g. a
 * repo with unsafe scripts but strong CI doesn't average out to look the same
 * as one with the opposite profile.
 */
export const calculateDimensionScores = (findings: ReadinessFinding[]): ReadinessDimensionScore[] =>
  RULE_CATEGORIES.map(category => {
    const categoryFindings = findings.filter(finding => getRuleDoc(finding.id)?.category === category)
    const bySeverity: Record<ReadinessSeverity, number> = { info: 0, warning: 0, error: 0 }
    for (const finding of categoryFindings) {
      bySeverity[finding.severity] += 1
    }
    return {
      category,
      score: calculateScore(categoryFindings),
      findingCount: categoryFindings.length,
      bySeverity,
    }
  })

/** Every agent-workflow stage, in the order a repository is normally worked through. */
export const AGENT_STAGES: AgentStage[] = ['orient', 'bootstrap', 'navigate', 'edit', 'verify', 'review', 'merge', 'deploy']

/**
 * Derives per-stage autonomy readiness from findings and each rule's
 * `RuleDoc.affectedStages` — a single aggregate score cannot communicate that
 * a repository is ready for an agent to understand/edit/verify while still
 * unready for autonomous merge or deploy, but a per-stage view can. A stage
 * is `blocked` when an error-severity finding affects it, `not_yet_ready`
 * when only warning-severity findings do, and `ready` otherwise (info-only
 * or no affecting findings). Purely a view over `findings`, like
 * `calculateDimensionScores`; it never changes gating or `summary.score`.
 */
export const calculateAutonomyEnvelope = (findings: ReadinessFinding[]): AutonomyStageResult[] =>
  AGENT_STAGES.map(stage => {
    const stageFindings = findings.filter(finding => getRuleDoc(finding.id)?.affectedStages.includes(stage))
    const blocking = stageFindings.filter(finding => finding.severity === 'error')
    const cautionary = stageFindings.filter(finding => finding.severity === 'warning')
    if (blocking.length > 0) {
      return { stage, status: 'blocked' as const, findingIds: blocking.map(finding => finding.id) }
    }
    if (cautionary.length > 0) {
      return { stage, status: 'not_yet_ready' as const, findingIds: cautionary.map(finding => finding.id) }
    }
    return { stage, status: 'ready' as const, findingIds: [] }
  })

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
