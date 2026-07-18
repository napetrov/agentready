/**
 * Fixed list of GitHub/platform-level controls a local, non-networked scan
 * cannot observe from repository contents alone — no CODEOWNERS file, branch
 * ruleset, or workflow YAML on disk proves what GitHub actually enforces
 * server-side (a required check can be configured without a matching
 * workflow file present, or a workflow file can exist without being wired
 * into any required-check list). AgentReady's local-first, non-networked
 * scan guarantee (see the README's "Design guarantees" section) means this
 * can only ever be reported as unverified, never inferred from local
 * evidence, so every default report lists it explicitly rather than staying
 * silent — silence here would read as "confirmed fine," not "not checked."
 */
export const NOT_VERIFIED_EXTERNAL_CONTROLS: string[] = [
  'Default-branch protection',
  'Required status checks',
  'Required CODEOWNER review',
  'Environment approval rules',
  'Production secret scopes',
  'Deployment permission boundaries',
]
