# Feature Roadmap

The detailed, prioritized work breakdown lives in
[dev/BACKLOG.md](../../dev/BACKLOG.md). This file holds the milestone view.

Sequencing note: consumption surfaces (package API/exports, schema-driven
config, a first-party GitHub Action, and SARIF) were prioritized ahead of deeper
analysis because they unlock adoption immediately. The next phase shifts from
scanner breadth to product trust: clear positioning, policy packs, sample
reports, and benchmark evidence. Import-graph analysis, hosted viewers, badges,
and dashboards stay deferred. The readiness model, instruction-surface
detection, finding IDs, and worktree `diff` remain custom.

## v0.1: Repository Readiness Scanner — delivered

Goal: produce useful local evidence without requiring a hosted service.

Delivered:

- local CLI entrypoint `agentready scan` (default scan of the current directory)
- instruction-file detector for common agent tools
- repo-shape / file-inventory detector for source, tests, docs, generated, binary, and minified paths
- package-manager detector and a multi-ecosystem command-surface detector (Node, Make, CMake, Bazel, Go, Rust, Python)
- CI workflow detector for GitHub Actions
- context-friction detection for large files and oversized always-on instruction files
- detection of local/private instruction files
- console, JSON, and markdown reporters
- experimental readiness score, plus a per-category (`docs`/`commands`/`ci`/`instructions`/`files`/`safety`)
  dimension-score rollup (`report.dimensions`) using the same severity-penalty model, so console/markdown
  output shows where a repo is weak instead of one opaque number
- `agentready diff` between git refs with a regression gate (worktree-based, never mutates the working tree)
- npm package metadata with a `bin` and a `dist` build for future `npx` usage; the package is not published yet
- capability-surface detector for MCP configs, skills, hooks, plugins, and code-intelligence/LSP config
- safety detector for dangerous package scripts and deploy/publish paths

The v0.1 family is now complete.

## v0.2: Consumable Surface — package, config, action, SARIF

Goal: make the scanner trivial to install as a library, run in CI, and feed
into code scanning. Highest-priority work; see the backlog for task detail.

Features:

- stable library API: declare `main`/`exports` (and schema subpaths) so the
  README's "library" claim is real
- schema-driven config and report contracts (Zod → published JSON Schema),
  replacing the handwritten validators
- CLI ergonomics on Commander + cosmiconfig (data-only JSON/YAML/`package.json`
  config; no executable config from the scanned tree), plus
  `validate-config`, `explain`, and `init` commands
- first-party GitHub Action (thin JS wrapper) with inputs/outputs, job summary,
  and optional PR annotation
- markdown PR report
- SARIF output and code-scanning upload
- file-handling reuse (fast-glob / ignore / picomatch / isbinaryfile / yaml)

## v0.3: Policy, Positioning, And Evidence Calibration

Goal: connect findings to real agent friction and team standards, while making
the product easier to understand before installation.

Features:

- semantic CI-workflow parsing (vs file listing); delegate workflow correctness
  to actionlint / ShellCheck rather than reimplementing — **delivered**: the CI
  detector parses workflow steps and classifies install/lint/type-check/test/
  build commands, with `ci.*.not-run` checks that flag commands the repo exposes
  but CI never runs
- built-in policy packs — **delivered**: `default` (no-op), `enterprise` (four
  severity escalations), `oss` (four escalations on stale command references
  and contribution-onboarding gaps), and `ml-scientific` (two de-escalations
  on large-fixture and unified-lint-command gates) ship as `--policy <name>`
  on `scan`/`diff` and a `policy` Action input; see
  `docs/product/policy-packs.md`. A config-file `policyOptions` shape (tuning
  thresholds without a CLI flag on every invocation) remains a candidate.
- instruction-file overlap and contradiction checks — **delivered (one
  signal)**: `detectInstructionContradictions` flags root-scope,
  always-active instruction files (the ones an agent loads into context
  together) that each exclusively reference a different single package
  manager, as `instructions.contradiction.package-manager` (warning). Broader
  semantic contradiction detection (conflicting prose, not just conflicting
  package-manager commands) stays in the optional LLM analyze layer
  (`lib/analyze/analyzers/contradiction.ts`) rather than the deterministic
  core, matching the deterministic/LLM split documented above.
- stale command reference validation — **delivered**: `commands.reference.*`
  checks flag `npm`/`yarn`/`pnpm`/`bun run <script>` (and bare `test`/`start`)
  references in READMEs/instruction files whose script doesn't exist, `make
  <target>` references with no matching Makefile target, and explicit
  package-manager mentions that disagree with the detected lockfile. Stale
  *path* validation (broken links in docs, not command references) remains open.
- companion-tool ingestion (actionlint, Gitleaks, OSV-Scanner/Trivy, Scorecard)
  with AgentReady as the report hub
- import graph and boundary checks
- git churn and risk signals
- language/framework policy packs (Java/.NET, broader Python tooling)
- CODEOWNERS and PR-template analysis — **delivered (presence, plus a narrow
  git-history coverage signal)**: `docs.codeowners.missing` (info,
  non-trivial repos only, >20 source files) and
  `docs.pull-request-template.missing` (info, any repo size) detect whether
  either review-routing surface exists at a GitHub-recognized path.
  `docs.codeowners.coverage-gap` (info) additionally flags top-level
  directories with sustained recent commit activity — from local git history
  only, bounded to the most recent commits, no network calls — that no
  CODEOWNERS pattern appears to cover (`detectCodeownersCoverageGaps` in
  `governance.ts`, approximating CODEOWNERS' gitignore-style patterns via the
  `ignore` package rather than its full path-rule semantics). Full
  per-file/blame-based ownership inference remains open (see "git churn and
  risk signals" above).
- capability-surface risk tiers — **delivered**: `detectCapabilitySurfaces` now
  classifies every MCP/skill/hook/plugin/LSP surface by blast-radius
  (`report.capabilities[].riskTier`, `low`/`medium`/`high`). MCP configs, hook
  scripts, a Claude Code settings file that configures a non-empty `hooks`
  block, and plugin manifests default to `high` (arbitrary commands, or a tool
  set this scanner can't verify statically); LSP/editor config and skills stay
  `low`. `safety.capability.high-risk` (info) flags each `high`-tier surface,
  and the `enterprise` policy pack escalates it to warning — see
  `docs/product/policy-packs.md`.
- local multi-repo/portfolio batch mode — **delivered**: `agentready batch
  [paths...] [--root <dir>]` scans every given path (plus, with `--root`,
  every immediate non-hidden subdirectory of it — the shape of a platform
  team's "clone of every repo" directory) independently via the same
  `scanLocalReadiness` pipeline, so one broken repo never aborts the batch.
  Emits an aggregated `summary`/`json`/`markdown` report
  (`report.summary.averageScore`/`minScore`/`maxScore`, severity totals, and
  per-repo `topFindings`) with no hosted service required, gated by
  `--min-score` and `--fail-on-scan-error`/`--no-fail-on-scan-error`. Schema:
  `schemas/portfolio-report.schema.json`.
- benchmark harness and public summary for comparing score dimensions against
  real agent performance — **delivered (scaffold only)**: `agentready:benchmark`
  (`bin/agentready-evaluate.ts`) scans a fixed, profile-diverse 10-repo corpus
  (`reports/evaluation/corpus.json`) and generates `reports/evaluation/README.md`
  with the corpus table, scan commands, and finding counts by category. Real
  coding-agent runs and human judgment of true/false positives — the actual
  "against real agent performance" comparison — are explicitly out of scope
  for this automated tool; the report marks those sections `TODO`. See
  `docs/product/evaluation.md`.

## v0.3 first-impression polish

Documentation/product work that should ship alongside policy work:

- README positioning that explains AgentReady versus CI, lint, Scorecard, and security scanners
- sample high-readiness and improvement-plan reports under `examples/reports/`
- issue-draft roadmap for the v0.3 milestone
- evaluation plan for real-agent benchmark calibration
- GitHub repository metadata: description, topics, and stale homepage cleanup

## Later

Possible later features:

- hosted report viewer
- organization-wide scan dashboard
- public badge
- trend tracking
- generated starter instruction files
- policy marketplace
- integrations with issue trackers and developer portals

## Non-Goals For The Core

The core scanner should not assume:

- every repo is TypeScript
- every repo uses pnpm
- every repo deploys to Vercel
- one instruction file is universally canonical
- test coverage alone predicts agent success
- executing repository commands is always safe

Also explicitly out of scope, by design rather than by omission:

- **GitHub-org-API-integrated batch scanning** (auto-discovering and cloning
  every repo in an org). `batch` (see the "local multi-repo/portfolio batch
  mode" entry above) stays local-only on purpose: reaching out to the GitHub
  API to enumerate/clone repos would mean AgentReady itself makes network
  calls and holds a GitHub credential, which breaks the no-external-service
  guarantee every other command relies on. The supported path is cloning an
  org's repos with an existing tool (`gh repo list <org> --clone`, a CI job,
  …) and pointing `batch --root` at the resulting directory.
- **Git-history-based ownership inference beyond CODEOWNERS-coverage
  gaps.** `governance.ts`'s `detectCodeownersCoverageGaps` (the
  `docs.codeowners.coverage-gap` finding) covers the narrow, well-scoped case
  — top-level directories with sustained recent commit activity that no
  CODEOWNERS pattern matches, from local git history only. Full ownership
  inference (per-file blame-based ownership, suggesting new CODEOWNERS
  entries, cross-referencing PR review history) remains open under "git churn
  and risk signals" below and needs its own design pass before it's built.
