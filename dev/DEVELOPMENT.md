# AgentReady Development Guide

AgentReady is a local-first CLI and library for scanning repository readiness
for AI coding agents. This guide covers the development process, current status,
and roadmap.

## Setup

```bash
npm ci
```

## Verification

Run before concluding any change:

```bash
npm run type-check
npm run lint
npm run test:coverage          # enforces the 80% coverage gate
npm run build
npm run agentready -- scan .
npm run agentready:fixtures
npm run agentready:pack-smoke
npm run agentready:schemas -- --check
npm run agentready:action-smoke
npm run agentready:eval        # offline gold-corpus eval of the LLM layer
```

When a contract or config shape changes, update `lib/repo-readiness/core/schemas.ts`
and regenerate the published JSON Schema with `npm run agentready:schemas`.

## Coding Standards

- TypeScript strict mode; no unsafe `any`. Prefer explicit interfaces and return types on exported functions.
- Add new behavior as a detector (`lib/repo-readiness/detectors/`) and/or a check
  (`lib/repo-readiness/checks/`) rather than expanding a monolith.
- Detectors observe facts only; checks make judgments and own stable finding IDs.
- Keep output machine-readable: when a report shape changes, update the contract
  validators in `lib/repo-readiness/core/contracts.ts` and their tests.
- The scanner must never execute the scanned repository's scripts or make network calls.
- Do not disable ESLint rules; fix root causes. Where a rule must be suppressed
  (e.g. an intentional control-character regex), document why inline.

## Current Status

Implemented (v0.1):

- `scan` and `diff` CLI commands with console, JSON (`--json`/`--compact`), and markdown (`--markdown`) output.
- Layered architecture: detectors → checks → scoring → reporters.
- Detectors: file inventory/classification, multi-ecosystem command surfaces
  (Node, Make, CMake, Bazel, Go, Rust, Python), docs and CI workflows, and instruction surfaces
  across Codex/Claude/Copilot/Cursor/Gemini/Windsurf/Cline/Roo.
- Worktree-based `diff` that never mutates the working tree.
- Config support via `.agentready.json` / `agentready.config.json` / `--config`.
- Contract validation, markdown reporting, fixture repositories, and a CLI smoke runner.
- CI self-scan, fixture smoke, and PR regression gate.
- Build to `dist/` with a published `bin` so the tool installs via `npx`.

## Roadmap

See [docs/product/features.md](../docs/product/features.md) for the milestone
view and [dev/BACKLOG.md](BACKLOG.md) for the prioritized task breakdown.

Near-term (P0/P1) candidates, sequenced for adoption:

- Declare a real library API: `main`/`exports` (+ schema subpaths) and an
  `npm pack` install smoke test.
- Schema-driven config and report contracts (Zod → published JSON Schema),
  plus a `validate-config` command.
- CLI on Commander + cosmiconfig (data-only JSON/YAML/`package.json` config, no
  executable config from the scanned tree); add `explain` and `init`.
- First-party GitHub Action (JS wrapper) with job summary, SARIF upload, and
  optional markdown PR comment.
- SARIF output mapped to stable rule IDs.

Then (P2+): semantic CI-workflow parsing, built-in policy packs and
instruction-file overlap/contradiction checks, capability-surface detector
(MCP configs, skills, hooks, plugins, LSP config), companion-tool ingestion
(actionlint, Gitleaks, OSV-Scanner/Trivy, Scorecard), file-handling reuse
(fast-glob/ignore/picomatch/isbinaryfile/yaml), and broader command/package
detection (Gradle/Maven, .NET, additional Python tooling).

## Agent Progress Log

### 2026-07-18 (ADR 0005 implementation phase 1: calibratable scoring engine)
- **IMPLEMENTED THE CALIBRATABLE SCORING CORE** from ADR 0005. `calculateScore`
  (`lib/repo-readiness/core/scoring.ts`) now takes an optional `ScoreWeights`
  parameter and multiplies each finding's severity penalty by (rule-owned,
  optional) `confidence` and `scope` factors on `ReadinessFinding`
  (`lib/repo-readiness/core/types.ts`). The default `DEFAULT_WEIGHTS` is
  deep-frozen with all-`1` confidence/scope multipliers, so the default score is
  byte-identical to the pre-ADR fixed-penalty model — verified by a regression
  test and the unchanged output snapshots. Fractional (calibrated) weights are
  rounded to an integer so `summary.score` and `dimensions[].score` still satisfy
  their integer schema; injected non-default weights are validated
  (`assertValidWeights`) to reject negative/non-finite/incomplete tables that
  could `NaN` the score or inflate it past a gate. Added optional
  `confidence`/`scope` to `readinessFindingSchema` and regenerated the published
  JSON Schemas.
- **VERIFICATION**: `npm run lint` clean; `npm run agentready:schemas -- --check`
  reports schemas up to date; `npx jest` 715 pass (10 new in
  `__tests__/scoring.test.ts`; 15 snapshots unchanged); `npm run build` clean;
  `agentready scan .` and `npm run agentready:fixtures` pass with integer scores.
  (`npm run type-check` exits non-zero only on the pre-existing tsconfig
  `moduleResolution`/`baseUrl` deprecation warnings, unrelated to this change.)
- **REMAINING PHASES**: `readinessProfile` axes (Readiness/Risk/Coverage/
  Observability), the `CoverageSurfaceKind` taxonomy, the
  `experimentalFindingFields` opt-in marker and its emission across scan/diff/
  portfolio reports, and reporter changes.

### 2026-07-18 (ADR 0005: calibrated multi-dimensional readiness profile)
- **PROPOSED ADR 0005** (`docs/adr/0005-calibrated-multi-dimensional-readiness-profile.md`,
  indexed in `docs/adr/README.md`): a `Proposed` architecture decision, no
  runtime code change. Rationale: the fixed severity-penalty score
  (`lib/repo-readiness/core/scoring.ts`) has structural problems weight-tuning
  can't fix (finding count substitutes for risk; no applicability denominator;
  confidence/scope/outcome data unused). Records demoting the absolute score to
  a secondary view behind a four-axis Repository Agent Readiness Profile
  (Readiness reusing `autonomyEnvelope`; Risk reusing `CapabilityRiskTier`;
  Coverage with an applicable-surface taxonomy; Observability), plus additive
  confidence/scope finding inputs, a frozen `DEFAULT_WEIGHTS` that keeps default
  scores byte-identical, integer rounding for fractional calibrated weights, and
  an `experimentalFindingFields` opt-in marker carried across scan/diff/portfolio
  report shapes.
- **VERIFICATION**: documentation-only change. Hardened over multiple
  automated-review rounds (Codex + CodeRabbit) against the shipped types —
  `ReadinessFinding`, `AutonomyStatus`, `CapabilityRiskTier`, the strict
  `z.number().int()` dimension schema, the `PolicyPack`/gate contract, MCP
  `riskTier: 'high'`, and finding serialization in diff/portfolio reports — so
  the ADR's illustrative types match `lib/repo-readiness/core/*` rather than
  overclaiming. Adjacent review items (policy plane, MCP assurance, security
  scope, environment dimension, telemetry, enrichers) are mapped to the axis
  each feeds and deferred to their own ADRs.

### 2026-07-15 (oss/ml-scientific policy packs, instruction contradictions, CODEOWNERS coverage gaps)
- **DELIVERED `oss` AND `ml-scientific` POLICY PACKS**: implemented per the
  existing spec in `docs/product/policy-packs.md`, following `enterprise`'s
  escalation model (`lib/repo-readiness/checks/policy-packs.ts`). `oss`
  escalates stale command references and contribution-onboarding gaps;
  `ml-scientific` de-escalates warning-level `files.large` and
  `commands.lint.missing` to `info` (error-level `files.large` stays
  gateable — see `Escalation.from`).
- **ADDED DETERMINISTIC INSTRUCTION-FILE CONTRADICTION DETECTION**:
  `detectInstructionContradictions` (`lib/repo-readiness/detectors/
  instruction-contradictions.ts`) flags root/legacy always-active
  instruction files that each exclusively reference a different single
  package manager, as `instructions.contradiction.package-manager`
  (warning). Scoped to files sharing an instruction-surface ecosystem (no
  false positive between e.g. `AGENTS.md` and `.claude/CLAUDE.md`, which no
  single agent loads together) and negation-aware (a prohibition like
  "never run npm install" isn't treated as endorsing npm).
- **ADDED CODEOWNERS COVERAGE-GAP DETECTION**: `detectCodeownersCoverageGaps`
  (`lib/repo-readiness/detectors/governance.ts`) flags top-level directories
  with sustained recent commit activity (local git history only, bounded,
  no network calls) that no CODEOWNERS pattern covers, as
  `docs.codeowners.coverage-gap` (info, one finding per directory for diff
  fidelity). Went through many rounds of automated-review hardening on this
  PR: per-commit (not per-file-line) activity counting; per-file (not
  per-directory-placeholder) pattern matching; symlink-safe bounded reads up
  to GitHub's real 3 MiB CODEOWNERS limit (oversized files fall through to
  "no effective rules", matching GitHub's real all-or-nothing load
  behavior); `.github/` > root > `docs/` file precedence (matches GitHub's
  documented search order); ignore-filtered scan-inventory awareness;
  ownerless-line and inline-comment-aware owner-token validation; explicit
  last-match-wins semantics (replacing a single combined `ignore()` matcher,
  which can't correctly model a later ownerless pattern overriding an
  earlier broader owned one — verified against GitHub's own documented
  example) instead of relying on gitignore-style negation, which CODEOWNERS
  doesn't support as input syntax and which has its own re-inclusion
  limitations `ignore()` doesn't work around; skips `[ ]` character-range
  patterns too (unsupported CODEOWNERS syntax GitHub also skips the whole
  line for, but which `ignore()` would otherwise match literally).
- **RESTRICTED THE `commands.lint.missing` DE-ESCALATION TO WARNING-LEVEL
  FINDINGS**: matches the existing `files.large` guard (`Escalation.from`) —
  an `errorOnWarnings`-promoted `commands.lint.missing` finding is now left
  gateable under `--fail-on error` instead of the `ml-scientific` pack
  silently undoing that strict-mode escalation.
- **FIXED TWO MORE CODEOWNERS/INSTRUCTION-CONTRADICTION EDGE CASES**: a
  CODEOWNERS line with an invalid placeholder owner (e.g. `/src/ TODO`) is
  now distinguished from a truly ownerless line (zero tokens after the
  pattern) — GitHub skips the invalid line entirely rather than treating it
  as an intentional override, so a broader owned pattern above it stays in
  effect. The package-manager negation-cue regex in
  `instruction-contradictions.ts` also now catches bare "not" (e.g. "Use
  pnpm, not npm install"), not just "do/does/should/will not".
- **DOCUMENTED THE GITHUB-ORG-API BATCH SCANNING NON-GOAL**: `batch --root`
  stays local-only by design (README, `docs/product/features.md`'s
  Non-Goals section, `dev/BACKLOG.md`) — auto-discovering/cloning an org's
  repos would require AgentReady itself to hold a GitHub credential and make
  network calls, breaking the no-external-service guarantee every other
  command relies on.
- **README DISCOVERABILITY PASS**: added a "Design guarantees" section and
  expanded "Evaluation / benchmarks" so four already-shipped trust
  properties (MCP host-delegated analyze, versioned JSON Schema contracts,
  worktree-isolated `diff`, the offline LLM-layer eval harness) are easy to
  find.
- **ENFORCED CASE-SENSITIVE CODEOWNERS MATCHING**: GitHub's file lookup and
  pattern evaluation are backed by git (case-sensitive), but both
  `CODEOWNERS_PATTERNS_BY_PRECEDENCE` (used `/i`) and the per-pattern
  `ignore()` matcher (defaults to `ignorecase: true`) were case-insensitive —
  a `codeowners`/`CodeOwners` filename or a `/Src/` pattern would wrongly be
  recognized/match. Fixed both (`governance.ts`); also required *every*
  trailing token on a CODEOWNERS line to be a plausible owner, not just one
  (`/src/ @team TODO` is invalid syntax GitHub skips as a whole, same as
  `/src/ TODO`).
- **FILTERED DIRECTORY ACTIVITY THROUGH THE SCAN INVENTORY PER FILE**:
  `detectCodeownersCoverageGaps` previously filtered ignored/deleted paths
  out only at the top-level-directory granularity; a directory with scanned
  files elsewhere but whose only *recent commits* touched ignored files could
  still be wrongly flagged. Now filtered per file before counting activity or
  testing coverage.
- **CAUGHT TWO MORE PACKAGE-MANAGER CONTRAST PHRASES**: the
  `instruction-contradictions.ts` negation-cue regex now also recognizes
  "instead of" and "rather than" (e.g. "Use pnpm instead of npm install"),
  not just "not"/"never"/etc.
- **FIXED THE INVALID `gh repo list <org> --clone` EXAMPLE**: that flag
  doesn't exist; replaced with `gh repo list` piped into `gh repo clone`
  across README, CHANGELOG, `dev/BACKLOG.md`, and
  `docs/product/features.md`.
- **Verification** (re-run after every fix round in this entry):
  `npm run type-check`, `npm run lint`, `npm run test:coverage` (all suites
  green, 80% coverage gate met — 628 tests as of the last round), `npm run
  build`, `npm run agentready:schemas -- --check`, `npm run build:action`,
  `npm run agentready:action-smoke` (passed). `npm run agentready:eval` was
  not re-run since no change in this entry touches the LLM analyze layer.

### 2026-06-08 (fuzz corpus fixture false positive)
- **DOWNGRADED FUZZ CORPUS SEED FILES**: Extensionless files under test corpus
  directories, such as Envoy compressor fuzz seeds, are treated as intentional
  fixture data at `info` severity instead of warning-level context friction.
  Verification: local readiness tests, CI smoke gates, and the PR regression
  diff.

### 2026-06-06 (generated fixture large files)
- **SUPPRESSED GENERATED TEST FIXTURES**: Large files in generated/test fixture
  locations, including baseline and snapshot-style generated artifacts, are
  suppressed as intentional generated data while ordinary large source/text
  files remain score-gating. Verification: `npm run agentready:action-smoke`
  and `npm run ci`.

### 2026-06-06 (generated minified vendor assets)
- **IGNORED GENERATED MINIFIED FINDINGS**: Minified files already classified as
  generated or vendored are kept in file inventory evidence but no longer
  produce minified-file readiness warnings. The bundled GitHub Action was
  rebuilt so the first-party action uses the same predicate. Verification:
  `npm run build:action`, `npm run agentready:action-smoke`, and `npm run ci`.

### 2026-06-06 (text snapshot fixture false positive)
- **DOWNGRADED BENCHMARK SNAPSHOT TEXT FIXTURES**: Large text snapshot/golden
  fixture files, such as Ruff benchmark snapshots under
  `scripts/ty_benchmark/snapshots/`, are treated as intentional fixture data at
  `info` severity while generic large text files still warn. Verification:
  `npm test -- --runTestsByPath __tests__/local-readiness.test.ts --runInBand`
  and `npm run ci`.

### 2026-06-06 (README symlink inventory)
- **KEPT README SYMLINKS SAFE**: Documentation symlinks remain visible for
  README detection, but non-documentation symlinks such as `package.json` or
  workflow files are excluded from the downstream `filePaths` reader surface so
  detectors cannot follow targets outside the repository. Verification:
  `npm test -- --runTestsByPath __tests__/local-readiness.test.ts --runInBand`,
  `npm run agentready:action-smoke`, and `npm run ci`.

### 2026-05-30 (action + sarif)
- **ADDED SARIF OUTPUT**: `reporters/sarif.ts` emits SARIF 2.1.0, collapsing
  `rule:instance` finding ids into stable rules with per-result levels and file
  locations. Exposed via a new `--format summary|json|markdown|sarif` flag and
  `--output <file>` on the CLI (legacy `--json`/`--markdown`/`--sarif` still
  accepted).
- **SHIPPED A FIRST-PARTY GITHUB ACTION**: `action.yml` + `lib/action/` bundled
  with `ncc` to `action/dist/index.js`. The gate logic (`lib/action/run.ts`) is
  dependency-free and unit-tested; the Actions runtime contract is reimplemented
  in `lib/action/runtime.ts` to avoid bundling `@actions/http-client`/`undici`
  (keeps the bundle ~420 kB and audit-clean). `bin/agentready-action-smoke.ts`
  drives the bundled action end-to-end in CI, with a bundle-freshness gate.
- Build the action bundle with `npm run build:action` after changing
  `lib/action/`; CI fails if the committed bundle is stale.

### 2026-06-03 (real-world cron)
- **ADDED RECURRING REAL-WORLD VALIDATION**: `bin/agentready-realworld-cron.ts`
  (`npm run agentready:realworld-cron`) rotates through
  `reports/agentready-realworld-cron/repo-pool.json`, shallow-clones real
  repositories into ignored scratch space, runs the deterministic scanner, saves
  ignored JSON/Markdown artifacts, appends tracked monthly ledger entries, and
  writes issue-candidate markdown for suspected scanner false positives or
  repo-selection blockers. The scanner remains no-network/no-execute; the cron
  harness performs external `git clone` setup around it.

### 2026-05-30 (schemas)
- **MADE ZOD THE CONTRACT SOURCE OF TRUTH**: Added `core/schemas.ts` with Zod
  schemas for the config, scan report, and diff report, guarded by compile-time
  checks against the `types.ts` interfaces. Rewrote `core/contracts.ts` and
  `core/config.ts` to validate against them, replacing the handwritten
  validators while keeping the public API and readable error messages.
- **PUBLISHED VERSIONED JSON SCHEMA**: `bin/agentready-emit-schemas.ts`
  (`npm run agentready:schemas`) derives `schemas/*.json` from the Zod schemas;
  the files are published via a `./schemas/*` export and CI fails on drift
  (`--check`).
- **ADDED `validate-config`**: New CLI command validates discovered/explicit
  config and prints the normalized effective config (`--json` supported).

### 2026-05-30 (later)
- **DECLARED A REAL LIBRARY API**: Added `main`, `types`, and `exports` (with a
  `./package.json` subpath) to `package.json`, pointing at the built barrel at
  `dist/lib/repo-readiness/index.js`. The README's "command-line tool and
  library" claim is now backed by package metadata.
- **ADDED A PACK/INSTALL SMOKE TEST**: `bin/agentready-pack-smoke.ts`
  (`npm run agentready:pack-smoke`) packs the tarball, installs it into a
  throwaway project, and asserts both the library import and the `agentready`
  bin work. Wired it into CI and added a `package-entrypoints` unit test that
  keeps the entry-point metadata internally consistent.

### 2026-05-30
- **TRIAGED EXTERNAL EVALUATION INTO THE BACKLOG**: Added [dev/BACKLOG.md](BACKLOG.md)
  with a prioritized, effort-tagged task breakdown and an accept/defer/reject
  triage of the review's recommendations.
- **RESEQUENCED THE ROADMAP**: Pulled package API/`exports`, schema-driven
  config, the GitHub Action, and SARIF ahead of deeper analysis in
  `docs/product/features.md`; kept hosted viewer/dashboard/badge deferred and
  reaffirmed the no-LLM-in-core, offline, never-execute-scripts guarantees.
- **VERIFIED THE FEEDBACK** against code before accepting: `package.json` has a
  `bin` but no `main`/`exports`; `detectCiWorkflows` only lists workflow file
  paths (no semantic parsing); Jest global coverage threshold is 40%.

### 2026-05-29
- **REMOVED THE LEGACY WEB APP**: Deleted the Next.js UI, API routes, OpenAI-based
  assessment engines, website/business-type analysis, PDF reporting, and their tests.
  AgentReady is now a pure local-first CLI/library.
- **MODULARIZED THE SCANNER**: Split the monolithic `local-readiness.ts` into
  `core/`, `detectors/`, `checks/`, and `reporters/`, matching the product architecture.
  The public API is preserved via a barrel module.
- **HARDENED `diff`**: Replaced in-place `git checkout` with isolated `git worktree`
  checkouts, so `diff` no longer mutates the working tree and works on a dirty tree.
- **BROADENED LANGUAGE SUPPORT**: Command-surface detection now spans Node, Make,
  Go, Rust, and Python instead of Node-only; command findings are gated on a
  recognized ecosystem.
- **REPO HYGIENE & PACKAGING**: Removed debris, renamed the package to `agentready`,
  added a `bin` and a `dist` build, and switched tooling to standalone ESLint + ts-jest.

### 2026-05-24
- Added the local-first `scan`/`diff` foundation, JSON contract validation,
  `--markdown` output, and the CI self-scan path.
