# AgentReady Backlog

This backlog turns external evaluation feedback into concrete, prioritized work.
It complements the milestone view in
[docs/product/features.md](../docs/product/features.md). Items are grouped by
priority and tagged with rough effort (S/M/L). Stable finding IDs and the
domain-specific readiness model stay custom; surrounding plumbing should reuse
mature ecosystem tools.

## Guiding decision

An external review recommended resequencing the roadmap so that
**consumption surfaces ship before deeper analysis**: package API/exports,
schema-driven config, a first-party GitHub Action, and SARIF output unlock
adoption immediately, while import-graph analysis, hosted viewers, badges, and
dashboards stay deferred. We accept that resequencing. The core differentiators
(instruction-surface detection, evidence model, finding IDs, worktree `diff`,
deterministic offline scanning) remain custom and must not regress.

## Feedback triage

Verified against the current `main`/branch code before accepting:

| Recommendation | Decision | Notes |
|---|---|---|
| Add `main`/`exports` to package metadata | Accepted (highest) | Confirmed: `package.json` has `bin` only; a real barrel exists at `lib/repo-readiness/index.ts`. |
| Schema-driven config + report contracts (Zod → JSON Schema) | Accepted | Replaces handwritten validators in `core/contracts.ts`; publish versioned schemas. |
| First-party GitHub Action (thin JS wrapper) | Accepted (high) | Already named in the v0.2 roadmap; promote and specify inputs/outputs. |
| SARIF output + code-scanning upload | Accepted (high) | Move ahead of import-graph work. |
| Commander for CLI parsing | Accepted (M) | Replace hand-rolled parser in `bin/agentready.ts`. |
| cosmiconfig for config discovery | Accepted (M) | Support JSON/YAML/JS + `package.json#agentready`. |
| fast-glob / ignore / picomatch / isbinaryfile / yaml | Accepted (M) | Reuse instead of bespoke walkers/matchers; unlocks `.gitignore` parity and real YAML parsing. |
| Semantic CI-workflow parsing (vs file listing) | Accepted | Confirmed gap: `detectCiWorkflows` only lists `.github/workflows/*`. Parse steps; delegate correctness to actionlint/ShellCheck. |
| Companion-tool ingestion (actionlint, Gitleaks, OSV-Scanner, Trivy, Scorecard) | Accepted (later, L) | AgentReady orchestrates/aggregates; do not reimplement these scanners. |
| Raise coverage thresholds above 40% | Accepted | Confirmed: `jest.config.js` global threshold is 40%. Raise incrementally; add product-level smoke/snapshot tests. |
| Package family split (`@agentready/core|cli|action|policy-default|schemas`) | Deferred | Worthwhile once API is stable; defer the monorepo split until exports + schemas land to avoid churn. |
| Changesets + npm provenance/trusted publishing | Deferred | Adopt alongside the first release / package split. |
| Renovate or Dependabot | Accepted (S) | Pick Dependabot for native-GitHub simplicity now; revisit Renovate if/when monorepo. |
| OpenTelemetry instrumentation | Deferred (optional) | Only for large-repo benchmarking/CI diagnostics, never default local scans. |
| Heavyweight LLM framework in core | Rejected | Conflicts with deterministic/offline guarantee. Any `explain`/`fix` LLM mode must live in a separate, optional package. |
| Hosted viewer / dashboard / public badge | Deferred | Stays in "Later"; not the shortest path to CI adoption. |
| Repo About still links `agentready.vercel.app` | Accepted (S, non-code) | Cleanup of GitHub repo metadata; not in-tree. Tracked here so it isn't lost. |

## P0 — Stabilize the consumable surface

- [ ] **Declare a real library API.** Add `main`, `types`, and `exports`
  (including subpath exports for schemas) to `package.json`, pointing at the
  built barrel. Document semver expectations for the public API. _(M)_
- [ ] **`npm pack` install smoke test.** CI step that packs the tarball,
  installs it into a temp project, and asserts both `import` (library) and the
  `agentready` bin work. _(S)_
- [ ] **Schema-driven contracts.** Introduce Zod schemas as the single source of
  truth for config, scan report, and diff report; derive types and emit
  versioned JSON Schema for editors/CI. Replace handwritten validators in
  `core/contracts.ts`. _(M)_
- [ ] **`validate-config` command.** Parse config and print the normalized
  effective config; fail fast with clear messages on invalid input. _(S)_

## P1 — CLI & config ergonomics

- [ ] **Adopt Commander** for `bin/agentready.ts`; keep `scan`/`diff` behavior,
  add normalized flags (`--format summary|json|markdown|sarif`, `--output`,
  `--policy`, `--config`, `--fail-on <severity>`, `--min-score`). _(M)_
- [ ] **Adopt cosmiconfig** for config discovery: JSON, YAML, JS/TS, and
  `package.json#agentready`, in addition to the current explicit `--config`. _(S)_
- [ ] **`explain <finding-id>`** — print rule description, rationale, references,
  and remediation examples. Non-failing. _(S)_
- [ ] **`init`** — scaffold starter config, a policy-pack template, and an
  optional `AGENTS.md`. Non-failing unless opting into overwrite. _(M)_

## P1 — First-party GitHub Action

- [ ] **JS action wrapper** built on `@actions/toolkit`, bundled with `ncc`.
  `action.yml` inputs: `path`, `mode`, `base-ref`, `head-ref`, `config`,
  `policy`, `fail-on-severity`, `fail-on-regression`, `min-score`, `comment-pr`,
  `job-summary`, `upload-sarif`. Outputs: `score`, `findings-count`,
  `regressions-count`, `json-report-path`, `markdown-report-path`,
  `sarif-report-path`. _(M)_
- [ ] **Job summary + optional PR annotation.** Write the markdown report to
  `$GITHUB_STEP_SUMMARY`; optional diff-scoped comments via reviewdog or the
  GitHub API. _(M)_
- [ ] **Action e2e test** against a small sacrificial fixture repo. _(M)_

## P1 — SARIF & code scanning

- [ ] **SARIF reporter** mapping findings to stable rule IDs and file locations
  where available; validate against GitHub-supported SARIF 2.1.0. _(M)_
- [ ] **Code-scanning upload path** wired through the Action. _(S)_

## P2 — File-handling reuse

- [ ] Replace bespoke traversal/ignore/glob in `detectors/file-inventory.ts`
  with `fast-glob` + `ignore` + `picomatch` for `.gitignore` parity. _(M)_
- [ ] Use `isbinaryfile` for binary detection and `yaml` for parsing workflow
  files and instruction-file frontmatter / `.mdc` rule metadata. _(M)_

## P2 — Semantic CI & policy

- [ ] **Parse workflow steps** for AgentReady-specific command/verification
  mapping (replacing the current file-listing in `detectCiWorkflows`); delegate
  workflow correctness to actionlint and shell steps to ShellCheck rather than
  reimplementing. _(M)_
- [ ] **Policy packs.** Keep built-in rules in TypeScript; add optional
  policy-pack ingestion over the AgentReady JSON evidence (OPA/Conftest-style).
  Add `@agentready/policy-default` once the package split happens. _(L)_
- [ ] **Instruction-file overlap / contradiction checks.** _(M)_

## P2 — Companion-tool orchestration (do not reimplement)

- [ ] Optional adapters that ingest output from **actionlint**, **Gitleaks**,
  **OSV-Scanner**/**Trivy**, and **OpenSSF Scorecard**, so AgentReady acts as
  the report hub without duplicating scanner logic. Recommend CodeQL alongside
  SARIF for security. _(L)_

## P3 — Validation & quality

- [ ] Raise Jest coverage thresholds above 40% incrementally as modules harden.
- [ ] Snapshot tests for JSON, Markdown, and SARIF output.
- [ ] Cross-platform path tests; dirty-worktree `diff` tests.
- [ ] Fixture matrix: Node/Python/Go/Rust now; Java/.NET later.
- [ ] **Benchmark harness** (from `use-cases.md`): correlate score dimensions
  with real bounded-task agent friction (time, tokens, tool calls, changed-file
  spread, verification success, reviewer intervention). _(L)_

## P3 — Release & maintenance

- [ ] Package family split into `@agentready/core|cli|action|policy-default|schemas`
  using npm workspaces — only after P0 exports + schemas land. _(L)_
- [ ] Changesets for coordinated versioning + npm provenance / trusted
  publishing from Actions. _(M)_
- [ ] Dependabot config for dependency updates. _(S)_
- [ ] Detector expansion: Gradle/Maven, .NET, broader Python tooling. _(M)_

## Explicit non-goals (reaffirmed)

- No LLM framework in the core scanner; scans stay deterministic, offline, and
  never execute repo scripts. Any `explain`/`fix` LLM mode is a separate package.
- No hosted viewer, dashboard, badge, or trend service in core (stays "Later").
- Custom secret/SAST heuristics are out of scope; orchestrate mature tools.
