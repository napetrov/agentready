# Policy Packs

The deterministic core should stay descriptive and conservative. Policy packs
are the planned layer that turns the same evidence into team- or domain-specific
severity, thresholds, and recommendations.

## Status

**Delivered:** the `PolicyPack`/`PolicyResult` model (`lib/repo-readiness/core/policy.ts`)
and all four built-in packs (`lib/repo-readiness/checks/policy-packs.ts`) —
a no-op `default`, `enterprise`, `oss`, and `ml-scientific` — `--policy <name>`
on `agentready scan`/`diff` (gating + a printed adjustment summary for
human-readable formats), and a `policy` input on the GitHub Action
(`policy-adjustments-count`/`policy-effective-score` outputs). Raw findings and
`summary.score` are never mutated by a policy — see `PolicyResult.effectiveScore`
and `severityAdjustments` below, which is exactly what shipped.

**Not yet delivered:** the `policyOptions`/config-file shape (thresholds are
currently fixed per pack, not configurable), and folding `PolicyResult` into
the JSON/SARIF report contract (it's CLI/Action-surfaced only today, not part
of `scan --format json`'s output, to keep that format's schema
policy-independent).

## Goals

- Keep default scans useful for any repository without assuming one stack,
  organization, or agent.
- Let teams encode stronger expectations without forking checks.
- Make severity changes explicit, reviewable, and machine-readable.
- Support `scan`, `diff`, the GitHub Action, and reports with the same policy
  semantics.

## CLI shape

All four built-in packs are real today (see "Built-in packs" below).

```bash
agentready scan . --policy default        # delivered — no-op
agentready scan . --policy enterprise     # delivered
agentready scan . --policy oss            # delivered
agentready scan . --policy ml-scientific  # delivered
agentready diff --base origin/main --head HEAD . --policy enterprise --fail-on-regression  # delivered
```

Proposed (not yet implemented): configuration should be data-only and merge
with explicit CLI selection, so a policy can be set once per repo instead of
on every invocation:

```json
{
  "policy": "enterprise",
  "policyOptions": {
    "minScore": 85,
    "requireInstructionEntrypoint": true,
    "allowIntentionalFixtureData": false
  }
}
```

## Built-in packs

### `default`

Broad, descriptive, low-surprise behavior. Suitable for first scans and local
preflight. Missing surfaces generally become warnings or info unless they create
clear agent safety risk.

### `oss` — delivered

Optimized for public repositories and external contributors.

Delivered escalations (`lib/repo-readiness/checks/policy-packs.ts`):

- `docs.developer.thin` (info → warning): external contributors have no
  teammate to ask about module boundaries or conventions, so contribution/
  architecture docs matter more than for an internal-only repo.
- `commands.reference.npm-script` (warning → error) and
  `commands.reference.make-target` (warning → error): a stale documented
  command wastes an external contributor's turn with no teammate nearby to
  correct it.
- `docs.pull-request-template.missing` (info → warning): external
  contributors need to be told what evidence a PR description should include;
  they cannot infer unwritten team conventions.

Remaining candidate expectations (not yet implemented as escalations, mostly
because the deterministic core has no dedicated finding for them yet):

- generated/vendor paths are obvious
- large fixtures are tolerated when they are clearly intentional (already
  handled by the core file-inventory fixture-path heuristics, not policy)

### `enterprise` — delivered (partial)

Optimized for organization-wide agent rollout and governance.

Delivered escalations (`lib/repo-readiness/checks/policy-packs.ts`):

- `instructions.missing` (warning → error): explicit agent instruction entrypoint
  is required, not optional.
- `safety.install-hook` (info → warning): install-time hooks must be visible
  enough to gate on.
- `safety.deploy` (info → warning): deploy/publish scripts must be visible
  enough to gate on.
- `safety.capability.high-risk` (info → warning): capability surfaces the
  risk-tier classifier scored `high` blast radius (MCP server configs, hook
  scripts, configured hooks blocks, plugin manifests) must be visible enough
  to gate on, not just listed.

Remaining candidate expectations (not yet implemented):

- local build/test/lint/type-check surfaces or documented exemption
- CI runs discovered local verification surfaces
- private/local instruction files do not leak into always-on guidance

### `ml-scientific` — delivered (partial)

Optimized for research, data, scientific-computing, and hybrid Python/C++ repos.

Delivered de-escalations (`lib/repo-readiness/checks/policy-packs.ts`) — the
only pack whose adjustments run downward, since `PolicyPack.adjust` maps to
whatever severity a domain considers correct, not only upward:

- `files.large` (warning → info): research/scientific repositories routinely
  check in sample datasets and fixtures outside the paths the core scanner
  already recognizes as intentional (`isLikelyIntentionalDataFixture` in
  `checks/built-in.ts`); treating every large file as equally risky is noisy
  for this domain.
- `commands.lint.missing` (warning → info): a single unified lint command is
  uncommon across hybrid Python/C++/notebook toolchains, where linting is
  typically per-language and orchestrated through CI rather than one local
  command.

Remaining candidate expectations (not yet implemented, mostly because the
deterministic core has no dedicated finding for them yet):

- generated bindings and vendored third-party code are understood as context
  boundaries
- heavy CI orchestration maps to wrapper scripts without requiring local
  execution (the core CI detector already tolerates general-purpose
  orchestrators like `tox`/`make`/`uv run` — see `CiEvidence.orchestratorKinds`
  — so this is largely covered outside the policy layer)
- build/test evidence supports CMake, Bazel, Make, Python, notebooks, and mixed
  language roots (already covered by the core command-surface detectors, not
  policy)

## Report model

Reports should preserve raw findings and add policy interpretation instead of
mutating evidence:

```ts
type PolicyResult = {
  policy: string;
  effectiveThresholds: Record<string, unknown>;
  severityAdjustments: Array<{
    findingId: string;
    from: "info" | "warning" | "error";
    to: "info" | "warning" | "error";
    reason: string;
  }>;
  adjustedFindings: unknown[]; // findings with policy-adjusted severities
  effectiveScore: number; // calculateScore() re-run over adjustedFindings
};
```

This keeps baseline scans comparable while making policy gates auditable.

## First implementation slice

1. [x] Add a typed `PolicyPack` interface and a built-in `default` pack that is a
   no-op over today's behavior.
2. [x] Add `--policy <name>` to CLI and Action inputs. (Report *metadata* — folding
   `PolicyResult` into the JSON/SARIF contract — remains open; see Status above.)
3. [x] Implement meaningful packs (`enterprise`, `oss`, `ml-scientific`) with
   tests that show severity adjustments and unchanged raw evidence.
4. [x] Add diff gating on policy-adjusted severity while preserving raw finding IDs.
