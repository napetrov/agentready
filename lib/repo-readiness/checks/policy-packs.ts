import type { PolicyName, PolicyPack } from '../core/policy'
import type { ReadinessSeverity } from '../core/types'
import { ruleKeyFor } from './catalog'

interface Escalation {
  ruleKey: string
  to: ReadinessSeverity
  reason: string
}

const buildEscalationPack = (name: PolicyName, description: string, escalations: Escalation[]): PolicyPack => {
  const byRuleKey = new Map(escalations.map(escalation => [escalation.ruleKey, escalation]))
  return {
    name,
    description,
    adjust: finding => {
      const escalation = byRuleKey.get(ruleKeyFor(finding.id))
      return escalation ? { to: escalation.to, reason: escalation.reason } : undefined
    },
  }
}

/** Broad, descriptive, low-surprise behavior — a no-op over the deterministic findings. */
export const DEFAULT_POLICY: PolicyPack = {
  name: 'default',
  description: 'Deterministic findings, unmodified. Suitable for first scans and local preflight.',
  adjust: () => undefined,
}

// Candidate rule families from docs/product/policy-packs.md's `enterprise`
// section: an explicit instruction entrypoint, dangerous install/deploy
// scripts, and high-risk capability surfaces (MCP servers, hooks, plugins),
// all called out with higher severity for approval workflows. Chosen as the
// first slice because each already has precise, low-false-positive
// deterministic findings to escalate.
const ENTERPRISE_ESCALATIONS: Escalation[] = [
  {
    ruleKey: 'instructions.missing',
    to: 'error',
    reason: 'Enterprise rollout requires an explicit agent instruction entrypoint, not an optional one.',
  },
  {
    ruleKey: 'safety.install-hook',
    to: 'warning',
    reason: 'Enterprise governance requires install-time hooks to be visible enough to gate on, not just informational.',
  },
  {
    ruleKey: 'safety.deploy',
    to: 'warning',
    reason: 'Enterprise governance requires deploy/publish scripts to be visible enough to gate on, not just informational.',
  },
  {
    ruleKey: 'safety.capability.high-risk',
    to: 'warning',
    reason: 'Enterprise governance requires high blast-radius capability surfaces (MCP servers, hooks, plugins) to be visible enough to gate on, not just informational.',
  },
]

/** Optimized for organization-wide agent rollout and governance. */
export const ENTERPRISE_POLICY: PolicyPack = buildEscalationPack(
  'enterprise',
  'Stricter gates for explicit agent instructions, dangerous install/deploy scripts, and high-risk capability surfaces, for organization-wide rollout governance.',
  ENTERPRISE_ESCALATIONS,
)

// Candidate rule families from docs/product/policy-packs.md's `oss` section:
// external contributors have no teammate to ask when a documented command is
// stale, so the two unambiguous command-reference mismatches escalate to
// error; contribution docs and a PR template matter more when contributors
// are not already embedded in the team's own conventions.
const OSS_ESCALATIONS: Escalation[] = [
  {
    ruleKey: 'docs.developer.thin',
    to: 'warning',
    reason: 'External contributors have no teammate to ask about module boundaries or conventions, so contribution/architecture docs matter more than for an internal-only repo.',
  },
  {
    ruleKey: 'commands.reference.npm-script',
    to: 'error',
    reason: 'A stale documented script wastes an external contributor\'s turn with no teammate nearby to correct it.',
  },
  {
    ruleKey: 'commands.reference.make-target',
    to: 'error',
    reason: 'A stale documented make target wastes an external contributor\'s turn with no teammate nearby to correct it.',
  },
  {
    ruleKey: 'docs.pull-request-template.missing',
    to: 'warning',
    reason: 'External contributors need to be told what evidence a PR description should include; they cannot infer unwritten team conventions.',
  },
]

/** Optimized for public repositories and external contributors. */
export const OSS_POLICY: PolicyPack = buildEscalationPack(
  'oss',
  'Stricter gates on stale documented commands and contribution-onboarding surfaces, for repositories that rely on external contributors rather than an embedded team.',
  OSS_ESCALATIONS,
)

// Candidate rule families from docs/product/policy-packs.md's `ml-scientific`
// section. Unlike the other packs, both adjustments here are de-escalations:
// `PolicyPack.adjust` maps a finding to whatever severity a domain considers
// correct, not only upward. Large sample data/fixtures outside the paths the
// core scanner already recognizes as intentional, and a single unified lint
// command across a hybrid Python/C++ toolchain, are both routine rather than
// a sign of neglect in this domain.
const ML_SCIENTIFIC_DEESCALATIONS: Escalation[] = [
  {
    ruleKey: 'files.large',
    to: 'info',
    reason: 'Research/scientific repositories routinely check in sample datasets and fixtures outside the paths the core scanner already recognizes as intentional; treating every large file as equally risky is noisy for this domain.',
  },
  {
    ruleKey: 'commands.lint.missing',
    to: 'info',
    reason: 'A single unified lint command is uncommon across hybrid Python/C++/notebook toolchains, where linting is typically per-language and orchestrated through CI rather than one local command.',
  },
]

/** Optimized for research, data, scientific-computing, and hybrid Python/C++ repos. */
export const ML_SCIENTIFIC_POLICY: PolicyPack = buildEscalationPack(
  'ml-scientific',
  'Relaxed gates on large sample data and unified local lint commands, for research/scientific-computing repositories where both are routine rather than neglect.',
  ML_SCIENTIFIC_DEESCALATIONS,
)

export const POLICY_PACKS: Record<PolicyName, PolicyPack> = {
  default: DEFAULT_POLICY,
  enterprise: ENTERPRISE_POLICY,
  oss: OSS_POLICY,
  'ml-scientific': ML_SCIENTIFIC_POLICY,
}

/** Resolves a policy pack by name, or `undefined` for an unrecognized name. */
export const resolvePolicyPack = (name: string): PolicyPack | undefined =>
  Object.prototype.hasOwnProperty.call(POLICY_PACKS, name) ? POLICY_PACKS[name as PolicyName] : undefined
