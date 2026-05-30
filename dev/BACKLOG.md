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
| cosmiconfig for config discovery | Accepted (M), data-only | Restrict discovery to non-evaluating formats (`json`/`yaml`/`package.json`). Do **not** load JS/TS config from the scanned tree — `require`-ing it would execute repo code before any detector runs, breaking the never-execute guarantee. |
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

- [x] **Declare a real library API.** Added `main`, `types`, and `exports`
  (with `./schemas/*` and `./package.json` subpaths) to `package.json`, pointing
  at the built barrel `dist/lib/repo-readiness/index.js`. Semver expectations for
  the public API still to be documented.
- [x] **`npm pack` install smoke test.** `bin/agentready-pack-smoke.ts` packs
  the tarball, installs it into a temp project, and asserts both the library
  `require` and the `agentready` bin work; wired into CI and backed by a
  `package-entrypoints` unit test.
- [x] **Schema-driven contracts.** `core/schemas.ts` holds Zod schemas as the
  single source of truth for config, scan report, and diff report, with
  compile-time drift guards against the `types.ts` interfaces.
  `core/contracts.ts` now validates against them, and
  `bin/agentready-emit-schemas.ts` derives versioned JSON Schema into
  `schemas/*.json` (published via the `./schemas/*` export, CI drift-checked).
- [x] **`validate-config` command.** `agentready validate-config [path]`
  validates discovered/explicit config and prints the normalized effective
  config (`--json` supported); fails fast with readable messages.

## P1 — CLI & config ergonomics

- [~] **Normalized CLI flags.** Added `--format summary|json|markdown|sarif` and
  `--output <file>` to `bin/agentready.ts` (legacy `--json`/`--markdown`/`--sarif`
  still accepted). Still to do: swap the hand-rolled parser for Commander and add
  `--policy`/`--fail-on <severity>`/`--min-score` to the CLI (they exist on the
  Action today). _(M)_
- [ ] **Adopt cosmiconfig** for config discovery, restricted to **data-only**
  formats — JSON, YAML, and `package.json#agentready` — in addition to the
  current explicit `--config`. Disable cosmiconfig's JS/TS loaders: loading
  executable config from the scanned tree would run repo code before any
  detector, breaking the never-execute-scripts / offline guarantee. If
  executable config is ever wanted, it must be gated behind an explicit,
  trusted, non-default path. _(S)_
- [ ] **`explain <finding-id>`** — print rule description, rationale, references,
  and remediation examples. Non-failing. _(S)_
- [ ] **`init`** — scaffold starter config, a policy-pack template, and an
  optional `AGENTS.md`. Non-failing unless opting into overwrite. _(M)_

## P1 — First-party GitHub Action

- [x] **JS action wrapper.** `action.yml` + `lib/action/` bundled with `ncc` to
  `action/dist/index.js`. Inputs: `path`, `mode`, `base-ref`, `head-ref`,
  `config`, `fail-on-severity`, `fail-on-regression`, `min-score`, `job-summary`,
  `upload-sarif`, `output-dir`, `tool-version`. Outputs: `score`,
  `findings-count`, `regressions-count`, `json-report-path`,
  `markdown-report-path`, `sarif-report-path`. The Actions runtime contract is
  reimplemented in `lib/action/runtime.ts` to avoid pulling `@actions/http-client`
  /`undici` into the bundle (keeps it small and audit-clean).
- [x] **Job summary.** The markdown report is written to `$GITHUB_STEP_SUMMARY`.
- [ ] **PR annotation / comment.** Optional diff-scoped comments via reviewdog or
  the GitHub API (needs a token + `@actions/github`); deferred. _(M)_
- [x] **Action e2e test.** `bin/agentready-action-smoke.ts` drives the bundled
  action via `INPUT_*` / `GITHUB_OUTPUT` / `GITHUB_STEP_SUMMARY` and asserts
  outputs, summary, SARIF artifact, and exit codes; `__tests__/action.test.ts`
  unit-tests the gate logic. Both run in CI, plus a bundle-freshness gate.
- [ ] **`policy` input.** Wire policy-pack selection once policy packs exist (P2). _(S)_

## P1 — SARIF & code scanning

- [x] **SARIF reporter.** `reporters/sarif.ts` (`formatScanSarif`) emits SARIF
  2.1.0, collapsing `rule:instance` finding ids into stable rules with per-result
  levels and file locations. Exposed as `--format sarif` and via the Action.
- [ ] **Code-scanning upload path.** The Action writes the SARIF file and outputs
  its path; document/recommend `github/codeql-action/upload-sarif` in the
  consuming workflow. _(S)_

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
