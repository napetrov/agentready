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

## Post-dogfood hardening plan

The oneDAL and scikit-learn-intelex dogfood pass changed the next release focus:
the scanner is useful on real Intel repositories, but large scientific/C++ and
hybrid Python/C++ projects expose precision gaps that should be addressed before
calling the release polished.

Review gates for this hardening stream:

1. **Plan review** — review this section for priority, scope, missing risks, and
   whether each release gate has an observable pass/fail criterion.
2. **Detector review** — after each detector PR, run focused code review on
   parsing correctness, false-positive risk, schema compatibility, and tests.
   Passing means targeted unit tests include positive and negative fixtures,
   `npm run type-check`, `npm run lint`, and affected Jest suites pass, and any
   schema/report shape change is covered by `npm run agentready:schemas -- --check`.
3. **Dogfood review** — rescan AgentReady, oneDAL, and scikit-learn-intelex; keep
   raw reports outside the repo and summarize only actionable conclusions.
   Passing means the known false positives below are gone or deliberately
   downgraded, the scanner does not crash, and no new error-severity finding is
   introduced on those repos.
4. **Release review** — before publishing, verify package naming, CI warnings,
   and npm provenance/trusted publishing choices. Passing means there are no
   open release-blocking PRs, CI is green on the exact release SHA, package dry
   run includes the intended files, and install/action examples match the chosen
   package identity.

Known dogfood regression matrix:

| Repo | Observed issue | Expected post-fix behavior | Blocks release? |
|---|---|---|---|
| `oneDAL` | C++ build/test wrappers were only partly understood as generic Make evidence | Build/test surfaces and CI coverage are detected without `commands.test.missing` | Yes |
| `oneDAL` | Large scientific sample data raised generic warning findings | Intentional sample/example data is labeled or downgraded without hiding arbitrary large blobs | No, unless warnings become errors |
| `scikit-learn-intelex` | Python `Copyright` text accidentally implied `pyright` type-check coverage | Tool detection comes only from structured config/known files, not comments/prose | Yes |
| `scikit-learn-intelex` | CI test/build wrapper scripts were under-recognized | Common wrapper scripts are recognized with negative tests for unrelated names/install arguments | Yes |
| both | `docs.architecture.missing` is noisy on mature OSS docs | Standalone architecture finding is removed or folded into broader low-severity docs signal | No |

### P0 — Release blockers / product decisions

- [x] **Pick the npm package identity.** The intended package identity is the scoped
  **`@napetrov/agentready`** (the unscoped `agentready` name is taken). Updated
  `package.json` (name + `publishConfig.access: public`), the product docs, and
  the pack-smoke `require` expectation. The `agentready` bin name is unchanged.
  The package is not published yet; README install instructions must not imply
  npm availability before the first release. _(S, decision)_
- [x] **Keep dogfood outputs out of the repo.** Store real-repo scan outputs as
  CI artifacts, job summaries, scratch files, or release-note drafts. Do not add
  per-run evaluation markdown to the tracked tree; sanitized summaries may keep
  finding IDs, counts, and short conclusions. _(S)_
- [x] **Minimal dogfood harness / recipe.** Add a repeatable local command or
  script that clones a small configured repo set into a temp directory and emits
  reports outside the tracked tree. This can be lightweight for the first
  release, but the dogfood gate must not depend on hand-run commands only. _(M)_

### P1 — Precision fixes from Intel dogfood

- [x] **Broaden C/C++ build-system detection.** Treat CMake, Bazel, and
  Makefile-backed projects as first-class command ecosystems instead of folding
  all C/C++ projects into generic `make`. Detect `CMakeLists.txt`,
  `CMakePresets.json`, `WORKSPACE`/`MODULE.bazel`, `BUILD.bazel`, and common
  `.ci/scripts/{build,test}` wrappers without executing them. _(M)_
- [x] **Use structured Python config parsing.** Replace broad substring matching
  in Python command detection with data-oriented parsing of `pyproject.toml` and
  `setup.cfg` sections/options. Tool names in comments, copyright headers, or
  prose must never imply command availability. Include negative fixtures for
  comments/prose and positive fixtures for common tool sections. _(M)_
- [x] **Classify intentional large data.** Split `files.large` context-friction
  findings into high-risk arbitrary blobs versus common ML/scientific fixtures
  under `examples/**/data`, `tests/**/fixtures`, `benchmarks/**`, and similar
  paths. The downgrade must be evidence-backed by path/type heuristics and
  configurable later; do not blanket-exempt all examples or benchmarks. _(M)_
- [x] **Rework `docs.architecture.missing`.** Folded into a broader
  docs-quality signal: the standalone finding is replaced by `docs.developer.thin`,
  which fires only when a non-trivial repo has no `CONTRIBUTING`, no
  architecture/design/development notes, and no populated `docs/` tree. This
  removes the false positives on mature OSS projects that document through any of
  those channels. _(S)_
- [x] **Tighten CI script classification.** Common wrapper scripts are still
  recognized when executed, but a script *path* led by a non-executing file
  utility (`chmod`/`cat`/`cp`/`mv`/`rm`/…) no longer creates false `test`/`build`
  coverage. Added negative tests for install-only references, non-executing
  script references, and unrelated file names (`latest.sh`, `prebuild.sh`, …). _(S)_
- [x] **Track Action runtime migration.** Done: the Action declares
  `using: 'node24'`, CI runs on Node 24, and the code-scanning upload step is on
  `github/codeql-action/upload-sarif` v4 (pinned to the v4.36.1 SHA). Dependabot
  continues to bump the pinned SHA on its weekly github-actions schedule. _(S)_


### P2 — Product trust and adoption polish

- [ ] **README first-impression pass.** Keep install instructions truthful while
  npm is unpublished, explain AgentReady versus CI/lint/Scorecard/security
  scanners, and link sample reports before the architecture deep dive. _(S)_
- [ ] **Sample reports.** Maintain compact examples for a high-readiness repo and
  an improvement-plan repo under `examples/reports/`; these are product examples,
  not raw dogfood artifacts. _(S)_
- [ ] **v0.3 issue drafts / milestone.** Keep ready-to-open issue drafts in
  `docs/roadmap/v0.3-issue-drafts.md` until they are mirrored into GitHub
  Issues. _(S)_
- [x] **Policy-pack design.** Delivered; see the "Policy packs" bullet under
  "P2 — Semantic CI & policy" below for the shipped shape (`default` +
  `enterprise`, severity adjustment without mutating raw evidence).
- [ ] **Evaluation story.** Publish a small benchmark plan that compares
  AgentReady findings against real coding-agent friction across a mixed repo
  corpus. Keep raw artifacts outside the tracked repo. _(M)_

### P2 — Depth and differentiation

- [ ] **Instruction quality as a first-class release story.** The Intel repos
  already have many instruction files, so the next differentiator is usefulness:
  actionable commands, scoped ownership, contradictions, stale paths, and
  duplicate/overlapping guidance. The optional analyze layer already has a
  starting instruction-quality analyzer; connect its output to docs and dogfood
  examples without making core scanning depend on a model. One deterministic
  slice of "contradictions" (cross-file package-manager mismatch) shipped —
  see "Instruction-file overlap / contradiction checks" below; the rest
  (stale paths, duplicate/overlapping prose guidance) remains open. _(M/L)_
- [x] **Scientific/ML policy pack** — delivered (partial): `ml-scientific`
  (`lib/repo-readiness/checks/policy-packs.ts`) de-escalates warning-level
  `files.large` findings and `commands.lint.missing` to `info`, covering the
  "intentionally keep sample datasets" and "heavy CI orchestration"
  expectations from `docs/product/policy-packs.md`. An error-level
  `files.large` finding (an unrecognized, non-fixture, non-binary large file
  over `largeFileErrorBytes`) is deliberately left alone -- not the "routine
  sample data" case this pack is about, and still gateable under `--fail-on
  error`. Generated-bindings/vendored-code context boundaries remain open (no
  dedicated deterministic finding to attach a policy adjustment to yet). _(L)_
- [x] **Minimal git-history ownership signal.** `detectCodeownersCoverageGaps`
  (`lib/repo-readiness/detectors/governance.ts`) flags top-level directories
  with sustained recent commit activity (local git history only, bounded to
  the most recent commits, no network calls) that no CODEOWNERS pattern
  appears to cover, as `docs.codeowners.coverage-gap` (info). Deliberately
  narrow: top-level-directory granularity via the `ignore` package's
  gitignore-style matching, not full per-file blame-based ownership
  inference or CODEOWNERS-entry suggestion — those remain open under "git
  churn and risk signals" above and need their own design pass. _(S)_
- **GitHub-org-API-integrated batch scanning: explicitly not planned.**
  `batch`'s "no hosted service required" design (delivered above) is
  deliberate, not an interim state: auto-discovering/cloning an org's repos
  would require AgentReady itself to make network calls and hold a GitHub
  credential, breaking the no-external-service guarantee every other command
  relies on. The supported path is cloning an org's repos with an existing
  tool (`gh repo list` piped into `gh repo clone`, a CI job, …) and pointing
  `batch --root` at the result — see the README's "Batch (portfolio) scans" section and
  `docs/product/features.md`'s "Non-Goals For The Core".

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
- [x] **PR annotation / comment.** `pr-comment` input posts/updates a sticky
  pull-request comment with the markdown report via the GitHub REST API over the
  node20 global `fetch` (no `@actions/github`/`undici`, keeping the bundle small).
  Uses the workflow `github-token` (`pull-requests: write`); fail-open so a
  missing permission or non-PR run warns instead of failing. Orchestration split
  into `lib/action/pr-comment.ts` and unit-tested with an injected API client.
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

- [x] Replaced bespoke traversal/ignore in `detectors/file-inventory.ts` with
  `fast-glob` (walk) + `ignore` (`.gitignore` parity, root and nested with git
  hierarchy semantics and negations). The always-ignored directory set and
  explicit `ignorePaths` still apply on top; `walkFiles` keeps its signature so
  the scan engine is unchanged. Remaining: route the `ignorePaths` glob matcher
  through `picomatch` to retire the hand-rolled `globToRegex` in `core/util.ts`. _(S)_
- [x] Use `isbinaryfile` for binary detection (replacing the bespoke NUL-byte
  sampler, still short-circuiting on known binary extensions). `yaml` parsing
  for workflow files already landed with semantic CI parsing; instruction-file
  frontmatter / `.mdc` rule metadata parsing remains. _(S)_

## P2 — Semantic CI & policy

- [x] **Parse workflow steps** for AgentReady-specific command/verification
  mapping (replacing the file-listing in the old `detectCiWorkflows`).
  `detectors/ci-workflows.ts` parses each workflow's `jobs[].steps[].run` (and a
  small map of known verification actions for `uses:`) with the `yaml` package,
  classifying steps into install/lint/type-check/test/build. The `ci` evidence
  now carries `workflows` (per-job detected command kinds) and aggregate
  `hasInstall/hasLint/hasTypeCheck/hasTest/hasBuild` flags. New checks
  (`ci.test.not-run`, `ci.lint.not-run`, `ci.typecheck.not-run`,
  `ci.build.not-run`) flag commands the repo exposes but CI never runs; they
  stay silent when the parse is low-confidence (a workflow exists but no command
  was recognized) to avoid false positives. Parsing is read-only; workflow
  correctness is still delegated to actionlint/ShellCheck rather than
  reimplemented. _(M)_
- [x] **Policy packs** (`docs/product/policy-packs.md`) — **delivered**: a
  typed `PolicyPack`/`PolicyResult` model (`core/policy.ts`), a no-op `default`
  pack and a real `enterprise` pack (`checks/policy-packs.ts`, four severity
  escalations), `--policy <name>` on `scan`/`diff`, and a `policy` Action input.
  Shipped as first-class TypeScript rather than external OPA/Conftest-style
  ingestion over JSON evidence — matches the design doc, not this bullet's
  original OPA framing. `oss` and `ml-scientific` packs are now delivered too
  (see `docs/product/policy-packs.md`); a config-file `policy`/`policyOptions`
  shape remains open, and `@agentready/policy-default` as a separate package
  still depends on the package-split work below. _(L)_
- [x] **Instruction-file overlap / contradiction checks** — delivered (one
  signal): `detectInstructionContradictions`
  (`lib/repo-readiness/detectors/instruction-contradictions.ts`) flags
  root-scope, always-active instruction files that each exclusively reference
  a different single package manager, as
  `instructions.contradiction.package-manager` (warning). Broader semantic
  contradiction detection stays in the optional LLM analyze layer
  (`lib/analyze/analyzers/contradiction.ts`), matching the
  deterministic-core/LLM-layer split this backlog already commits to. _(M)_
- [x] **Capability-surface risk tiers** — delivered: `CapabilitySurfaceEvidence`
  gained a `riskTier` (`low`/`medium`/`high`) field. MCP configs, hook scripts,
  plugin manifests, and a Claude Code settings file that configures a
  non-empty `hooks` block are `high` (arbitrary commands, or a tool set static
  config can't verify); a settings file with no `hooks` key is `medium`; LSP
  config and skills stay `low`. New `safety.capability.high-risk` (info)
  finding per `high`-tier surface; the `enterprise` policy pack escalates it
  to warning. _(M)_
- [x] **Local multi-repo/portfolio batch mode** — delivered:
  `agentready batch [paths...] [--root <dir>]` (`core/portfolio.ts`) scans
  every target independently through the same `scanLocalReadiness` pipeline —
  one broken repo never aborts the batch, it's just captured as a per-repo
  scan error — and aggregates into `summary`/`json`/`markdown` output
  (`report.summary.averageScore/minScore/maxScore`, severity totals, and
  per-repo `topFindings`), gated by `--min-score` and
  `--fail-on-scan-error`/`--no-fail-on-scan-error`. No hosted service
  required. Schema: `schemas/portfolio-report.schema.json`. _(M)_
- [x] **Empirical validation scaffold** (`docs/product/evaluation.md`) —
  **delivered (scaffold only)**: `npm run agentready:benchmark`
  (`bin/agentready-evaluate.ts`) automates the deterministic half of the
  "Minimal public benchmark" — a fixed 10-repo, profile-diverse corpus
  (`reports/evaluation/corpus.json`, one entry per profile from the doc,
  including AgentReady itself scanned in place, never cloned), scans each
  repo, and generates `reports/evaluation/README.md` with the corpus table,
  scan commands, and finding counts by category. Giving the same bounded task
  to real coding agents and recording their friction is explicitly NOT
  automated — that needs an actual agent run and human judgment, so the
  report marks the friction/decision/true-false-positive sections `TODO`
  rather than inventing data. Completing the milestone for real is future
  work; see `docs/product/evaluation.md`'s Status section. _(M)_

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
- [x] **Evaluation harness for the layer itself.** `bin/agentready-eval.ts`
  (`npm run agentready:eval`) runs the real analyzer pipeline over a labeled
  offline gold corpus (canned model responses) and reports precision/recall/F1,
  the confusion matrix, and confidence calibration. `analyze-corpus.test.ts`
  enforces a floor in CI, catching plumbing regressions (broken hallucination
  guards, dropped score folding, id drift) without calling a model; the same
  harness can score a live model in a one-off recording run. Human-agreement and
  task-friction correlation (via the empirical validation scaffold above) remain
  future work — that scaffold generates the corpus/scan half but not real agent
  runs. _(L)_

## P2 — Companion-tool orchestration (do not reimplement)

- [ ] Optional adapters that ingest output from **actionlint**, **Gitleaks**,
  **OSV-Scanner**/**Trivy**, and **OpenSSF Scorecard**, so AgentReady acts as
  the report hub without duplicating scanner logic. Recommend CodeQL alongside
  SARIF for security. _(L)_

## P3 — Validation & quality

- [x] **Raised the Jest coverage gate to 80%** (statements/branches/functions/
  lines) and brought `bin/agentready.ts` into measurement; CI now runs
  `test:coverage` so the threshold gates the build. Raise further as modules
  harden.
- [x] **Snapshot tests for JSON, Markdown, SARIF, and console output**
  (`output-snapshots.test.ts`), with machine-specific paths/timestamps
  normalized so snapshots are stable.
- [x] **Dirty-worktree `diff` test** (`local-readiness.test.ts`). Cross-platform
  (Windows) path tests are intentionally out of scope: CI targets Linux + a
  single Node version (no native deps, deterministic fs/git usage).
- [x] **Fixture matrix: Node/Python/Go/Rust/Make** under `fixtures/readiness/`,
  scanned end-to-end by `command-surfaces.test.ts`. Java/.NET later.
- [x] **Real-repository evaluation** (`dev/REAL-REPO-EVAL.md`): scanned 16 popular
  OSS projects across 6 ecosystems. No crashes; `instructions.missing` (15/16)
  and `files.large` validated as high-precision. Drove the lockfile exemption,
  the `docs.architecture`/`ci.not-run` info-severity de-risk, and the
  orchestrator-awareness work. Rerun periodically as a precision regression check.
- [x] **Reworked `docs.architecture.missing`** — the lowest-precision rule in the
  real-repo eval (fired on ~11/16 well-documented projects) was folded into the
  broader `docs.developer.thin` docs-quality signal (see the post-dogfood plan
  above). _(S)_
- [x] **Cross-job / matrix CI command attribution** — `ci.*.not-run` is now
  gated on single-job confidence: when recognized commands span more than one job
  (multi-job pipeline or matrix), the not-run findings are suppressed because a
  missing kind may run in an unrecognized job/leg. They still fire when commands
  are concentrated in one job. _(M)_
- [x] **Property/fuzz tests** for the parsers — `__tests__/parser-fuzz.test.ts`
  drives the command/uses classifiers, the YAML workflow parser, and full
  `scanLocalReadiness` over malformed manifests with a seeded, dependency-free
  generator, asserting totality (never throws) and output-shape invariants. _(M)_
- [ ] **Mutation testing** (Stryker) to validate assertion strength now that an
  80% gate is in place. Too slow for per-PR CI; run locally / nightly. _(M)_
- [ ] **Benchmark harness** (from `use-cases.md`): correlate score dimensions
  with real bounded-task agent friction (time, tokens, tool calls, changed-file
  spread, verification success, reviewer intervention). _(L)_

## P3 — Release & maintenance

- [ ] Package family split into `@agentready/core|cli|action|policy-default|schemas`
  using npm workspaces — only after P0 exports + schemas land. _(L)_
- [ ] Changesets for coordinated versioning + npm provenance / trusted
  publishing from Actions. _(M)_
- [x] Dependabot config for dependency updates — `.github/dependabot.yml`,
  weekly grouped npm + github-actions updates.
- [x] Detector expansion: Gradle, Maven, and .NET command ecosystems, with
  matching CI command patterns so the new build/test/lint surfaces don't create
  false `ci.*.not-run` findings. Broader Python tooling remains incremental. _(M)_

## Explicit non-goals (reaffirmed)

- No LLM framework **in the core scanner**; the scan/diff engine, detectors,
  checks, and scoring stay deterministic, offline, and never execute repo
  scripts. LLM/agentic analytics is a planned but **separate, opt-in layer** that
  consumes emitted evidence (see "LLM / agentic analytics layer" above); it never
  runs in the core path or gates a scan.
- No hosted viewer, dashboard, badge, or trend service in core (stays "Later").
- Custom secret/SAST heuristics are out of scope; orchestrate mature tools.
