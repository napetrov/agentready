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
| Package family split (`@agentready/core`, `cli`, `action`, `policy-default`, `schemas`) | Deferred | Worthwhile once API is stable; defer the monorepo split until exports + schemas land to avoid churn. |
| Changesets + npm provenance/trusted publishing | Deferred | Adopt alongside the first release / package split. |
| Renovate or Dependabot | Accepted (S) | Pick Dependabot for native-GitHub simplicity now; revisit Renovate if/when monorepo. |
| OpenTelemetry instrumentation | Deferred (optional) | Only for large-repo benchmarking/CI diagnostics, never default local scans. |
| LLM / agentic analytics layer | Accepted as an optional, opt-in layer | Reverses the earlier "rejected in core" stance: the layer is **not** part of the deterministic core scan. It runs as a separate, opt-in stage/package that reasons over the emitted JSON evidence to validate, triage, and enrich findings at defined steps. The core scan stays offline, deterministic, and never-execute; the LLM layer is off by default and clearly separated. Evaluation/design details to be worked out in a follow-up PR. |
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

- [x] **Normalized CLI flags.** Added `--format summary|json|markdown|sarif` and
  `--output <file>` to `bin/agentready.ts` (legacy `--json`/`--markdown`/`--sarif`
  still accepted). Added `--fail-on <severity>` and `--min-score <n>` to `scan`
  and `diff`, sharing the Action's gate semantics via a new `core/gate.ts`
  (`evaluateScanGate`/`evaluateDiffGate`); `diff` now also gates on new
  error-severity findings by default, matching the Action. The hand-rolled parser
  was replaced with **Commander**, adding per-command `--help`, validated option
  choices, and clearer parse errors. `--policy` is deferred until policy packs
  exist (P2). _(M)_
- [x] **Adopt cosmiconfig** for config discovery, restricted to **data-only**
  formats — JSON, YAML, and `package.json#agentready` — in addition to the
  explicit `--config`. cosmiconfig's JS/TS loaders are disabled two ways: the
  executable extensions are omitted from the search places, and the default
  JS/TS loaders are overridden with a refusing loader (cosmiconfig *merges*
  custom loaders over defaults, so omission alone is insufficient). Discovery is
  rooted at the scanned dir (no walking up). A malformed `package.json` degrades
  discovery gracefully instead of crashing the scan; schema validation still
  fails on semantically invalid config. The Action build marks `typescript`
  external so cosmiconfig's unreachable TS loader does not bloat the bundle
  (back to ~520kB). _(S)_
- [x] **`explain <finding-id>`** — `agentready explain <finding-id|rule-id>`
  prints the rule's title, rationale, remediation, and references from the new
  `checks/catalog.ts` rule catalog (`--list` enumerates rules, `--json` emits
  structured output). Non-failing. A drift test asserts every finding the
  detectors emit has a catalog entry. _(S)_
- [x] **`init`** — `agentready init [path] [--agents] [--force]` scaffolds a
  starter `.agentready.json` and, with `--agents`, a starter `AGENTS.md`. Skips
  existing files unless `--force`; non-failing. The policy-pack template is
  deferred until policy packs exist (P2). _(M)_

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
- [x] **Code-scanning upload path.** The Action writes the SARIF file and outputs
  its path (`sarif-report-path`); the README workflow example recommends wiring
  `github/codeql-action/upload-sarif@v3` to that output with the
  `security-events: write` permission. _(S)_

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

## P2 — LLM / agentic analytics layer (optional, opt-in)

This is a planned part of the design, not a rejected idea. The goal is to use
LLM/agentic reasoning at defined steps to perform validation and enrichment that
deterministic detectors cannot do well on their own (e.g. judging whether an
`AGENTS.md` is actually useful, reconciling contradictory instruction files,
explaining a finding in repo-specific terms, proposing remediations). The hard
constraint is separation of concerns:

- **Core stays deterministic.** The scan/diff engine, detectors, checks, scoring,
  and the JSON/SARIF contracts remain offline, deterministic, and never-execute.
  The LLM layer consumes the *already-produced* evidence; it never gates the core
  scan and is never required to produce a report.
- **Opt-in and isolated.** Lives in a separate package/stage (e.g.
  `@agentready/analyze` or an `agentready analyze` subcommand) behind explicit
  flags and credentials. Off by default; absence changes nothing about core
  output. No network calls happen in the core path.
- **Auditable I/O.** Inputs/outputs are the versioned evidence schemas plus a
  typed "insight" schema, so LLM output is structured, attributable to finding
  IDs, and diffable. Determinism knobs (model, temperature, seed where
  available) and a record/replay fixture mode for tests.

Proposed steps where the layer can plug in (to be refined in the next PR):

- [ ] **Evidence validation / false-positive triage.** Have the layer review
  deterministic findings against file evidence and flag likely false
  positives/negatives, emitting confidence + rationale rather than mutating
  scores. _(L)_
- [ ] **Instruction-surface quality judgment.** Assess whether instruction files
  (`AGENTS.md`, `.cursorrules`, etc.) are actually actionable for an agent, not
  just present. Pairs with the deterministic overlap/contradiction checks. _(M)_
- [ ] **Finding explanation / remediation.** Power a richer `explain`/`fix` mode
  with repo-specific rationale and patch suggestions, gated behind the opt-in
  layer. _(M)_
- [ ] **Evaluation harness for the layer itself.** Define how we measure the
  layer's usefulness (agreement with human review, false-positive reduction,
  task-friction correlation from the benchmark harness) before trusting it.
  **Design + metrics to be agreed in the follow-up PR.** _(L)_

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

- No LLM framework **in the core scanner**; the scan/diff engine, detectors,
  checks, and scoring stay deterministic, offline, and never execute repo
  scripts. LLM/agentic analytics is a planned but **separate, opt-in layer** that
  consumes emitted evidence (see "LLM / agentic analytics layer" above); it never
  runs in the core path or gates a scan.
- No hosted viewer, dashboard, badge, or trend service in core (stays "Later").
- Custom secret/SAST heuristics are out of scope; orchestrate mature tools.
