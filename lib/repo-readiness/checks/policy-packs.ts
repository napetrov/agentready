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

export const POLICY_PACKS: Record<PolicyName, PolicyPack> = {
  default: DEFAULT_POLICY,
  enterprise: ENTERPRISE_POLICY,
}

/** Resolves a policy pack by name, or `undefined` for an unrecognized name. */
export const resolvePolicyPack = (name: string): PolicyPack | undefined =>
  Object.prototype.hasOwnProperty.call(POLICY_PACKS, name) ? POLICY_PACKS[name as PolicyName] : undefined
