# Policy Packs

The deterministic core should stay descriptive and conservative. Policy packs
are the planned layer that turns the same evidence into team- or domain-specific
severity, thresholds, and recommendations.

## Status

**Delivered:** the `PolicyPack`/`PolicyResult` model (`lib/repo-readiness/core/policy.ts`),
a no-op `default` pack and a real `enterprise` pack (`lib/repo-readiness/checks/policy-packs.ts`),
`--policy <name>` on `agentready scan`/`diff` (gating + a printed adjustment
summary for human-readable formats), and a `policy` input on the GitHub Action
(`policy-adjustments-count`/`policy-effective-score` outputs). Raw findings and
`summary.score` are never mutated by a policy — see `PolicyResult.effectiveScore`
and `severityAdjustments` below, which is exactly what shipped.

**Not yet delivered:** `oss` and `ml-scientific` packs (still candidates, see
below), the `policyOptions`/config-file shape (thresholds are currently fixed
per pack, not configurable), and folding `PolicyResult` into the JSON/SARIF
report contract (it's CLI/Action-surfaced only today, not part of `scan
--format json`'s output, to keep that format's schema policy-independent).

## Goals

- Keep default scans useful for any repository without assuming one stack,
  organization, or agent.
- Let teams encode stronger expectations without forking checks.
- Make severity changes explicit, reviewable, and machine-readable.
- Support `scan`, `diff`, the GitHub Action, and reports with the same policy
  semantics.

## CLI shape

`default` and `enterprise` are real today; `oss` and `ml-scientific` remain
proposed (see "Candidate built-in packs" below).

```bash
agentready scan . --policy default        # delivered — no-op
agentready scan . --policy enterprise     # delivered
agentready scan . --policy oss            # proposed
agentready scan . --policy ml-scientific  # proposed
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

## Candidate built-in packs

### `default`

Broad, descriptive, low-surprise behavior. Suitable for first scans and local
preflight. Missing surfaces generally become warnings or info unless they create
clear agent safety risk.

### `oss`

Optimized for public repositories and external contributors.

Possible expectations:

- root onboarding entrypoint exists (`README`, `CONTRIBUTING`, or agent file)
- local verification commands are documented or discoverable
- generated/vendor paths are obvious
- PR review evidence is easy to include in comments/job summaries
- large fixtures are tolerated when they are clearly intentional

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

### `ml-scientific`

Optimized for research, data, scientific-computing, and hybrid Python/C++ repos.

Possible expectations:

- sample data and notebooks are classified separately from arbitrary blobs
- generated bindings and vendored third-party code are understood as context
  boundaries
- heavy CI orchestration can map to wrapper scripts without requiring local
  execution
- build/test evidence supports CMake, Bazel, Make, Python, notebooks, and mixed
  language roots

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
};
```

This keeps baseline scans comparable while making policy gates auditable.

## First implementation slice

1. [x] Add a typed `PolicyPack` interface and a built-in `default` pack that is a
   no-op over today's behavior.
2. [x] Add `--policy <name>` to CLI and Action inputs. (Report *metadata* — folding
   `PolicyResult` into the JSON/SARIF contract — remains open; see Status above.)
3. [x] Implement one meaningful pack (`enterprise`) with tests that show severity
   adjustments and unchanged raw evidence. `ml-scientific` remains a candidate.
4. [x] Add diff gating on policy-adjusted severity while preserving raw finding IDs.
