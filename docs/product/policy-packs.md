# Policy Packs

The deterministic core should stay descriptive and conservative. Policy packs
are the planned layer that turns the same evidence into team- or domain-specific
severity, thresholds, and recommendations.

## Goals

- Keep default scans useful for any repository without assuming one stack,
  organization, or agent.
- Let teams encode stronger expectations without forking checks.
- Make severity changes explicit, reviewable, and machine-readable.
- Support `scan`, `diff`, the GitHub Action, and reports with the same policy
  semantics.

## Proposed CLI shape

```bash
agentready scan . --policy default
agentready scan . --policy oss
agentready scan . --policy enterprise
agentready scan . --policy ml-scientific
agentready diff --base origin/main --head HEAD . --policy enterprise --fail-on-regression
```

Configuration should be data-only and merge with explicit CLI selection:

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

### `enterprise`

Optimized for organization-wide agent rollout and governance.

Possible expectations:

- explicit agent instruction entrypoint for non-trivial repos
- local build/test/lint/type-check surfaces or documented exemption
- CI runs discovered local verification surfaces
- dangerous deploy/publish/install hooks are called out with higher severity
- private/local instruction files do not leak into always-on guidance
- capability surfaces (MCP, hooks, plugins) are visible for approval workflows

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

1. Add a typed `PolicyPack` interface and a built-in `default` pack that is a
   no-op over today's behavior.
2. Add `--policy <name>` to CLI and Action inputs, plus report metadata.
3. Implement one meaningful pack (`enterprise` or `ml-scientific`) with tests
   that show severity adjustments and unchanged raw evidence.
4. Add diff gating on policy-adjusted severity while preserving raw finding IDs.
