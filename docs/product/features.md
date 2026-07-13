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
- built-in policy packs — **delivered (partial)**: `default` (no-op) and
  `enterprise` (four severity escalations) ship as `--policy <name>` on
  `scan`/`diff` and a `policy` Action input; see `docs/product/policy-packs.md`.
  `oss`/`ml-scientific` and a config-file `policyOptions` shape remain candidates.
- instruction-file overlap and contradiction checks
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
- CODEOWNERS and PR-template analysis — **delivered (presence-only)**:
  `docs.codeowners.missing` (info, non-trivial repos only, >20 source files)
  and `docs.pull-request-template.missing` (info, any repo size) detect
  whether either review-routing surface exists at a GitHub-recognized path.
  Inferring actual ownership boundaries from git history/blame remains open
  (see "git churn and risk signals" above).
- capability-surface risk tiers — **delivered**: `detectCapabilitySurfaces` now
  classifies every MCP/skill/hook/plugin/LSP surface by blast-radius
  (`report.capabilities[].riskTier`, `low`/`medium`/`high`). MCP configs, hook
  scripts, a Claude Code settings file that configures a non-empty `hooks`
  block, and plugin manifests default to `high` (arbitrary commands, or a tool
  set this scanner can't verify statically); LSP/editor config and skills stay
  `low`. `safety.capability.high-risk` (info) flags each `high`-tier surface,
  and the `enterprise` policy pack escalates it to warning — see
  `docs/product/policy-packs.md`.
- benchmark harness and public summary for comparing score dimensions against real agent performance

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
- local multi-repo/portfolio batch mode: scan N repositories in one CLI
  invocation and emit an aggregated JSON/Markdown summary, without requiring a
  hosted service — the natural entry point for platform teams rolling agents
  out across many repos
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
