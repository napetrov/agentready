# Changelog

All notable changes to AgentReady will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Portfolio results now advertise nested finding-experimental keys (ADR 0005
  compliance fix)**: `PortfolioRepoResult` (`ok: true`) gains an optional
  `experimentalFindingFields`, computed from `topFindings` the same way the
  scan report's `reportContract` is computed from `findings`. Previously a
  `batch --format json` result could have silently emitted `topFindings[].confidence`/
  `scope` with no adjacent marker once a rule opted into non-default values —
  harmless today (no built-in rule sets them yet) but a latent violation of the
  ADR's "never emitted unadvertised" invariant. The shared computation is
  extracted to `lib/repo-readiness/core/experimental-finding-fields.ts` and used
  by both the scan report and the portfolio path. The diff report already
  satisfied this via its embedded `baseReport`/`headReport` contracts; that is
  now documented on `ReadinessDiffReport` and locked in by a test.

### Changed
- **Reports lead with the readiness profile (ADR 0005 implementation, phase 3)**:
  the console and markdown scan reports now open with a **Repository Agent
  Readiness Profile** block (capability risk, scanner coverage, calibration
  confidence; per-stage readiness via the existing autonomy-envelope section),
  and the single 0–100 score is demoted to a clearly labeled secondary line —
  delivering the ADR's core "the profile is the product, the score is a
  secondary view" decision in the human-facing output. JSON output is unchanged
  (the profile has been present since phase 2); the profile block is omitted for
  reports without a `readinessProfile`.

### Added
- **Repository Agent Readiness Profile (ADR 0005 implementation, phase 2)**: every
  scan report now carries a `readinessProfile`
  (`lib/repo-readiness/core/readiness-profile.ts`) — the multi-axis view that
  demotes the single score to a secondary signal. It separates **readiness**
  (per-stage, reusing the existing autonomy envelope verbatim), **risk**
  (aggregate capability-risk verdict — worst tier present, so one `high` surface
  is never diluted by many `low` ones; `low` with empty refs when no surfaces
  exist; an MCP config stays `high`), **coverage** (a fixed `CoverageSurfaceKind`
  taxonomy counted by kind, not by file, so a legible monorepo isn't penalized
  for size), and **observability** (verified-locally / not-found /
  not-observable-locally, the last reusing the external-controls list).
  `calibrationConfidence` is `low` until real agent-outcome data exists.
  Registered as the `readinessProfile` experimental field. Also adds an
  `experimentalFindingFields` marker to `reportContract` that advertises nested
  `findings[].confidence`/`scope` keys whenever a rule emits them (omitted
  otherwise), so consumers can detect/strip the unstable keys. JSON Schemas
  regenerated; action bundle rebuilt.
- **Calibratable scoring engine (ADR 0005 implementation, phase 1)**: `calculateScore`
  now accepts an optional `ScoreWeights` table and reads optional, rule-owned
  `confidence`/`scope` inputs on findings (`lib/repo-readiness/core/scoring.ts`,
  `lib/repo-readiness/core/types.ts`). Weights default to a deep-frozen
  `DEFAULT_WEIGHTS` whose all-`1` confidence/scope multipliers reproduce the
  historical fixed-penalty score byte-for-byte, so `summary.score`, per-category
  `dimensions[].score`, and all gates are unchanged by default. Injected
  (non-default) weights are validated (`assertValidWeights`: finite,
  non-negative, complete) before use, and the score is rounded to an integer so
  fractional calibrated weights still satisfy the integer score contract. The
  finding schema gains optional `confidence`/`scope` keys (JSON Schema
  regenerated). The report-profile axes, coverage taxonomy, and
  `experimentalFindingFields` marker built on this foundation are described in the
  phase-2 and phase-3 entries above.
- Proposed **ADR 0005: Calibrated Multi-Dimensional Readiness Profile**
  ([docs/adr/0005-calibrated-multi-dimensional-readiness-profile.md](docs/adr/0005-calibrated-multi-dimensional-readiness-profile.md),
  indexed in [docs/adr/README.md](docs/adr/README.md)): records the decision to
  demote the experimental absolute score to a secondary view and make a
  four-axis Repository Agent Readiness Profile (Readiness / Risk / Coverage /
  Observability) the primary output. Specifies additive, confidence/scope-aware
  scoring inputs with a frozen `DEFAULT_WEIGHTS` that reproduces today's score
  byte-for-byte, an `experimentalFindingFields` opt-in marker for the new
  nested finding keys, and a coverage-surface taxonomy — all as a `Proposed`
  ADR with no runtime code change.
- Implemented the full v0.4 backlog from the AIReady calibration record (see
  [docs/roadmap/v0.4-issue-drafts.md](docs/roadmap/v0.4-issue-drafts.md) for
  per-issue detail and deliberate scope deviations):
  - `commands.reference.shortcut-script`: flags a code-formatted bare
    `<manager> <word>` shortcut (e.g. `` `pnpm dev` ``) that matches neither a
    curated per-manager built-in-verb allowlist nor an existing package.json
    script (`lib/repo-readiness/detectors/command-references.ts`). Gated on
    the reference appearing inside a Markdown code span (inline or fenced)
    instead of a two-tier confidence split, to keep prose that merely
    discusses a package manager from being misread as a command. `oss`
    policy escalates it to `error` alongside the other stale
    command-reference kinds.
  - `safety.agent-hook.executes-repository-code`: the composite risk neither
    `safety.install-hook` nor `safety.capability.high-risk` names on its own
    — an agent-tool hook that fires automatically (`SessionStart`,
    `SessionEnd`, `PreCompact`, `Notification`, not events tied to explicit
    user/tool activity) whose command invokes a package-manager install
    command (`detectHookExecutionRisks` in
    `lib/repo-readiness/detectors/safety-signals.ts`). Default `warning`;
    `enterprise` policy escalates to `error`.
  - `governance.codeowners.protected-path-gap` and
    `governance.codeowners.single-owner-risk`
    (`detectProtectedPathCoverage` in
    `lib/repo-readiness/detectors/governance.ts`): checks a fixed set of
    structurally high-risk paths (`.github/**`, `.claude/**`, `AGENTS.md`,
    `CLAUDE.md`, `**/auth/**`, `**/migrations/**`, `**/deploy/**`, ...)
    against CODEOWNERS independent of recent commit activity, and flags a
    path owned by exactly one individual with no team/second owner. `info`
    by default; `enterprise` policy escalates both to `warning`.
  - `instructions.portable-entrypoint.missing`: fires when a repository has
    some recognized agent instruction surface but none of them is a portable
    entrypoint (`AGENTS.md`) — `instructions.missing` correctly stays silent
    in this case, since AgentReady still does not assume one filename is
    universally canonical. `info` by default; `enterprise` policy escalates
    to `warning`.
  - Autonomy envelope: every rule in `checks/catalog.ts` is tagged with
    `affectedStages` (new `AgentStage` type:
    `orient`/`bootstrap`/`navigate`/`edit`/`verify`/`review`/`merge`/`deploy`).
    `calculateAutonomyEnvelope` derives `report.autonomyEnvelope` — a
    per-stage `ready`/`not_yet_ready`/`blocked` status from findings, added
    to `reportContract.experimentalFields` — so a report can say "ready to
    edit and open a PR, not yet ready to merge or deploy autonomously"
    instead of only a single aggregate score. Rendered as an "Autonomy
    envelope" section in `formatScanMarkdown` and a compact
    not-ready/blocked-only line in `formatScanSummary`.
  - "Not verified from repository contents": every default scan's
    markdown/console output now lists a fixed set of platform-level controls
    (`NOT_VERIFIED_EXTERNAL_CONTROLS` in
    `lib/repo-readiness/reporters/not-verified.ts`: branch protection,
    required status checks, required CODEOWNER review, environment approval
    rules, production secret scopes, deployment permission boundaries) that a
    local, non-networked scan cannot observe from repository contents alone.
- Calibration feedback schema (`reports/evaluation/calibration/calibration-feedback.schema.json`)
  and the first calibration record
  (`reports/evaluation/calibration/napetrov-AIReady.json`), the "human/agent
  judgment" half of the evaluation loop in
  [docs/product/evaluation.md](docs/product/evaluation.md#feedback-classification):
  every reviewed finding is classified as `true_positive`, `false_positive`,
  `false_negative`, `severity_mismatch`, `policy_mismatch`, or
  `not_observable_locally`, tagged
  with the agent-workflow stage(s) it affects, and marked with whether an
  AgentReady maintainer independently re-verified it. AIReady is a
  high-readiness repository (extensive agent instructions, sophisticated CI, a
  passing AgentReady Action gate at a configured minimum score of 80) whose
  manual review still surfaced several `false_negative`/`severity_mismatch`
  findings — see
  [docs/roadmap/v0.4-issue-drafts.md](docs/roadmap/v0.4-issue-drafts.md) for
  the resulting backlog (package-manager-aware shortcut-script command
  validation, a composite automatic-hook-executes-repository-code safety
  check, autonomy-stage metadata, protected-path CODEOWNERS coverage, and the
  `policyOptions.requirePortableInstructionEntrypoint` policy option).
- `oss` and `ml-scientific` policy packs (`lib/repo-readiness/checks/policy-packs.ts`),
  joining `default` and `enterprise` as the four built-in `--policy <name>`
  choices on `scan`/`diff` and the GitHub Action's `policy` input. `oss`
  escalates stale command references (`commands.reference.npm-script`/
  `make-target`: warning→error) and contribution-onboarding gaps
  (`docs.developer.thin`, `docs.pull-request-template.missing`: info→warning).
  `ml-scientific` de-escalates warning-level `files.large` and
  `commands.lint.missing` to info (an error-level instance of either finding,
  including one promoted by `errorOnWarnings`, stays gateable under
  `--fail-on error`). See
  [docs/product/policy-packs.md](docs/product/policy-packs.md).
- Deterministic instruction-file contradiction detection: `detectInstructionContradictions`
  (`lib/repo-readiness/detectors/instruction-contradictions.ts`) flags
  root-scope or legacy always-active instruction files (the ones an agent
  loads into context together — `AGENTS.md`, `CLAUDE.md`,
  `.github/copilot-instructions.md`, `GEMINI.md`, `.cursorrules`, …) that
  each exclusively reference a different single package manager, as
  `instructions.contradiction.package-manager` (warning). Compares only
  files sharing an instruction-surface ecosystem and ignores negated
  mentions (e.g. "never run npm install").
- CODEOWNERS coverage-gap detection: `detectCodeownersCoverageGaps`
  (`lib/repo-readiness/detectors/governance.ts`) flags top-level directories
  with sustained recent commit activity (local git history only, bounded to
  the most recent commits, no network calls) that no CODEOWNERS pattern
  covers, as `docs.codeowners.coverage-gap` (info, one finding per directory).
  `GovernanceEvidence` gained `uncoveredActiveDirectories`, and
  `codeownersPath` now resolves GitHub's actual `.github/` > root > `docs/`
  file precedence.
- README "Design guarantees" section and an expanded "Evaluation /
  benchmarks" section, surfacing four already-shipped trust properties
  (MCP host-delegated `analyze`, versioned JSON Schema contracts,
  worktree-isolated `diff`, the offline LLM-layer eval harness).

### Changed
- `LocalReadinessReport` gained a new required `instructionContradictions`
  field, listed in `reportContract.experimentalFields` alongside
  `repositoryEvidence`/`designState`/`dimensions` (schema version stays
  `local-readiness/v2`; consumers that validate against a pinned older copy
  of the JSON Schema should expect this field).
- `LocalReadinessReport` gained two more required fields, both also listed in
  `reportContract.experimentalFields` (schema version still
  `local-readiness/v2`): `hookExecutionRisks` (see
  `safety.agent-hook.executes-repository-code` above) and `autonomyEnvelope`
  (see "Autonomy envelope" above). `GovernanceEvidence` gained an optional
  `protectedPathCoverage` field (see `governance.codeowners.protected-path-gap`/
  `single-owner-risk` above). `CommandReferenceKind` gained `shortcut-script`.
- Documented that GitHub-org-API-integrated batch scanning (auto-discovering
  and cloning every repo in an org) is intentionally out of scope: it would
  require AgentReady itself to hold a GitHub credential and make network
  calls, breaking the no-external-service guarantee every other command
  relies on. Local `batch --root` plus an existing clone tool (e.g.
  `gh repo list` piped into `gh repo clone`) is the supported path.

## [0.3.0] - 2026-07-13

### Added
- Dimension-score rollup: every scan report now includes `dimensions`, a
  per-category (`docs`/`commands`/`ci`/`instructions`/`files`/`safety`) score
  computed with the same severity-penalty model as the overall `summary.score`.
  A repo with unsafe scripts but strong CI no longer looks identical to one with
  the opposite profile under a single number. Exposed as
  `calculateDimensionScores`/`RULE_CATEGORIES` from `checks/catalog.ts`, listed
  in `reportContract.experimentalFields`, and rendered in the console (`Dimensions: ...`
  line, with severity counts) and markdown (`### Dimension scores`) reporters.
  The schema requires exactly one entry per category (rejecting an empty or
  duplicated `dimensions` array) and constrains `score` to 0-100 and the
  finding counts to non-negative integers. The uniqueness constraint is
  enforced in the published JSON Schemas too, not just the runtime Zod
  validator: draft-7 has no `minContains`/`maxContains`, so
  `bin/agentready-emit-schemas.ts` uses a `contains`-per-category `allOf`
  which, combined with the array's fixed length, forces each category to
  appear exactly once by pigeonhole — so schema-based CI/editor validation
  rejects the same malformed reports the scanner's own runtime check does.
- Command reference validation: a new `commandReferences` detector scans
  READMEs and instruction files for command references that don't match the
  repository's actual command surfaces — `npm`/`yarn`/`pnpm`/`bun run
  <script>` (and bare `test`/`start`) mentions whose script isn't in
  `package.json`, `make <target>` mentions with no matching Makefile target,
  and package-manager mentions that disagree with the detected lockfile.
  Emits `commands.reference.npm-script`/`commands.reference.make-target`
  (warning) and `commands.reference.package-manager-mismatch` (info,
  since docs can legitimately discuss more than one package manager).
  `CommandEvidence` also gained `makeTargets` (the Makefile target names,
  already parsed internally but not previously exposed). Multi-target Makefile
  rules (`build test: setup`) are now parsed correctly, make-option tokens
  (`make -j test`, `make -C dir test`) are no longer misread as targets, bare
  `npm start` is not flagged when a root `server.js` provides npm's documented
  fallback, bare `bun test` is never flagged since Bun's test runner needs no
  script, `docs.contributing` is scanned alongside READMEs, and repeated
  identical references in one document are deduped to one finding.
- Policy packs: a typed `PolicyPack`/`PolicyResult` model
  (`lib/repo-readiness/core/policy.ts`) applies team-specific severity
  adjustments to gating without ever mutating raw findings or `summary.score`.
  Ships with a no-op `default` pack and a real `enterprise` pack (three
  escalations: `instructions.missing` warning→error,
  `safety.install-hook`/`safety.deploy` info→warning) in
  `lib/repo-readiness/checks/policy-packs.ts`. `--policy <name>` on `agentready
  scan`/`diff` applies it to `--fail-on`/`--min-score` gating and prints the
  adjustments (with reasons) for human-readable output formats; a `policy`
  input on the GitHub Action does the same, with new `policy-adjustments-count`
  and `policy-effective-score` outputs. See
  [docs/product/policy-packs.md](docs/product/policy-packs.md) for the full
  design and what's still open (`oss`/`ml-scientific` packs, a config-file
  shape, folding `PolicyResult` into the JSON/SARIF report contract).
- Governance surface detection: a new `governance` detector reports whether a
  CODEOWNERS file and a pull-request template exist at a GitHub-recognized
  path (repo root, `.github/`, or `docs/`; presence-only — it does not infer
  ownership boundaries from git history/blame). Emits
  `docs.pull-request-template.missing` (info, any repo size — a PR template
  benefits every repo, however small) and `docs.codeowners.missing` (info,
  only for non-trivial repos with more than 20 source files, where routing a
  review actually matters). Report field: `report.governance` (`{
  codeownersPath?, pullRequestTemplatePath? }`).
- Capability-surface risk tiers: `CapabilitySurfaceEvidence` gained a
  `riskTier` (`low`/`medium`/`high`) field, so `report.capabilities` no longer
  treats an MCP config, a hook, a plugin, and a static LSP file as equally
  "present." MCP server configs, hook scripts, plugin manifests, and a Claude
  Code settings file that configures a non-empty `hooks` block are `high`
  (arbitrary commands, or — for MCP — a tool set static config can't verify);
  a settings file with no `hooks` key is `medium`; LSP/editor config and
  skills stay `low`. New `safety.capability.high-risk` (info) finding per
  `high`-tier surface; the `enterprise` policy pack escalates it to warning
  (four escalations now, was three). Console/markdown reporters call out the
  high-risk count in the capabilities line.
- Local multi-repo/portfolio batch mode: `agentready batch [paths...]
  [--root <dir>]` scans every target independently (`core/portfolio.ts`,
  reusing `scanLocalReadiness`) and aggregates into one portfolio report — a
  repo that fails to scan is captured per-repo, never aborting the batch.
  `--root <dir>` scans every immediate non-hidden subdirectory of `dir`, the
  shape of a "clone of every repo" platform-team directory. `summary`/`json`/
  `markdown` output; `--min-score`/`--fail-on-scan-error` (default on;
  `--no-fail-on-scan-error` to disable) gate the batch. New schema:
  `schemas/portfolio-report.schema.json`. No hosted service required.
- Empirical validation scaffold (scaffold only): `npm run agentready:benchmark`
  (`bin/agentready-evaluate.ts`) automates the deterministic half of
  `docs/product/evaluation.md`'s "Minimal public benchmark" — a fixed,
  profile-diverse 10-repo corpus (`reports/evaluation/corpus.json`, including
  AgentReady itself scanned in place), a scan of each repo, and a generated
  `reports/evaluation/README.md` with the corpus table, scan commands, and
  finding counts by category. Giving the same bounded task to real coding
  agents and recording their friction is explicitly not automated — the
  report marks those sections `TODO` rather than inventing data.

### Fixed
- `agentready scan`/`diff --output <file>` now writes a non-default policy's
  summary (`--policy enterprise`, etc.) into the same file as the report
  instead of always printing it to stdout — a saved markdown/summary report
  now carries the policy context that explains why the policy gate may have
  failed.
- `commands.reference.npm-script` no longer flags workspace-qualified
  references (`npm run dev --workspace packages/app`, `-w`, `--workspaces`):
  the script may exist only in the workspace package, not the root
  `package.json` this detector checks against.
- `agentready diff --fail-on-regression` now recomputes regressions against
  policy-adjusted severities when `--policy` is set, instead of only applying
  the policy to the separate `--fail-on` new-findings check. Previously a
  policy that escalates a *new* finding's severity (e.g. `enterprise` raising
  `safety.install-hook`/`safety.deploy` from info to warning) was invisible to
  `report.regressions`, which is always built from raw severities — so
  `--fail-on-regression` alone could pass a PR the policy was meant to gate.
- Command-reference validation now checks root-*scope* instruction files
  (e.g. `.claude/CLAUDE.md`, `.github/copilot-instructions.md` — always
  loaded, per `detectInstructionSurfaces`'s own `scope: 'root'`
  classification) and `.github/CONTRIBUTING.md`, instead of only slashless
  paths. Previously these always-loaded, repo-level files were skipped
  because their path contains a `/`, so a stale `npm run <script>` reference
  in the primary agent instruction file could go unflagged. Genuinely
  nested/package-scoped docs (`packages/foo/CLAUDE.md`,
  `packages/foo/README.md`) are still excluded.
- The GitHub Action's `markdown-report-path` artifact now includes the policy
  summary and augmented-analysis section, matching the job summary/PR
  comment. Previously `report.md` was written before those sections were
  appended to `summaryMarkdown`, so a run with `policy: enterprise` (or
  `analyze: true`) left the saved markdown file looking like a plain
  deterministic report — misleading for anyone who uploads or inspects that
  artifact directly, and giving no clue why a policy gate failed.
- Command-reference document reads (`README`/instruction files) are now
  capped at 200KB at the I/O layer via `openSync`/`readSync`, instead of
  reading (and UTF-8 decoding) the whole file before truncating the decoded
  string. A mislabeled huge file (e.g. a binary asset with a `.md` extension)
  no longer forces a full read into memory just to scan for command
  references.
- `commands.reference.make-target` no longer misreads a variable override
  (`make PREFIX=/usr/local install`, `make CFLAGS=-O2 test`) as a missing
  target — GNU make treats any `=`-containing argument as a variable
  assignment, not a target.
- `docs.pull-request-template.missing` no longer fires for a
  `PULL_REQUEST_TEMPLATE/` directory at the repo root or under `docs/`
  (GitHub recognizes both, alongside `.github/`); only the `.github/` case
  was previously matched.
- Capability-surface risk classification no longer treats an empty
  matcher-group array (`{ hooks: { PreToolUse: [] } }`) as a configured hook
  — it's as inert as an empty `hooks` object, so it's `medium` risk, not
  `high`.
- `agentready batch --format markdown` now escapes `|` in repo paths/error
  messages before interpolating them into table cells, so a path or error
  containing a pipe can no longer corrupt the rendered table.
- The GitHub Action's diff-mode policy summary text and `policyAdjustmentsCount`
  output could previously diverge: the rendered adjustment list covered the
  whole head report while the count covered only new findings. Both are now
  derived from the same finding set.
- `portfolioRepoResultSchema.score` and `portfolioSummarySchema`'s
  `averageScore`/`minScore`/`maxScore` are now bounded to `0-100` integers in
  both the runtime Zod schema and the generated JSON Schema, matching the
  same contract already enforced on dimension scores.
- The `.github/`-is-root-equivalent carve-out for command-reference checks
  was too broad: it matched any path starting with `.github/`, including a
  genuinely nested component under it (e.g. a local composite action at
  `.github/actions/foo/README.md` with its own `package.json` scripts). Now
  only a doc directly under `.github/` (one path segment) counts as
  root-equivalent; deeper paths are treated the same as any other
  package-scoped doc and excluded.
- Command-reference checks never read through a symlinked doc (e.g. a root
  `README.md` symlinked to `packages/app/README.md`). Previously such a
  symlink was still visible as a slashless, root-scope path, but reading it
  followed the link and checked the *target's* content (which can document a
  different package's own scripts) against the *root's* command surface — a
  false positive. Matches the "classify a symlink by path, never dereference
  it" invariant the file-inventory walker already applies elsewhere.
- `commands.reference.make-target` now recognizes path-like targets
  (`make docs/html`) instead of truncating the capture at the `/` and
  reporting a false missing-target warning; matches how the command-surface
  Makefile parser already preserves slash-containing target names.
- `agentready batch --config <path>` now resolves a relative config path
  once, against the caller's working directory, instead of passing it
  through unchanged to every target repo (where it would be re-resolved
  against each different repo root and typically not found).

## [0.2.0] - 2026-06-08

### Changed
- Action runtime migration: the first-party GitHub Action now declares `using: 'node24'` (was `node20`), ahead of GitHub retiring the Node 20 action runtime in 2026. CI runs on Node 24 too, so the bundled Action is exercised on its target runtime, and the code-scanning upload step is bumped to `github/codeql-action/upload-sarif` **v4** (pinned to the v4.36.1 commit SHA `87557b9c84dde89fdd9b10e88954ac2f4248e463`), which also runs on Node 24. The README workflow example and CI docs are updated to Node 24.
- The package is published under the scoped name **`@napetrov/agentready`** (the unscoped `agentready` name is already taken on npm). The `agentready`/`agentready-mcp` command names are unchanged; only the package identity moves, so `npx @napetrov/agentready scan .` and `require('@napetrov/agentready')` are the published entry points. `publishConfig.access` is set to `public` so the scoped package publishes publicly. README, the pack smoke test, and the product docs are updated to match.

### Added
- LLM analytics layer: a **remediation analyzer** (opt-in, `analysis.remediation:*`
  insights) turns each deterministic finding's generic recommendation into
  repo-specific, actionable steps using the detected stack and layout. It is
  advisory — the steps are carried in the insight's `remediation` field and never
  adjust the score — and rejects hallucinated finding ids. Added to the default
  analyzer set and exported as `remediationAnalyzer`; the augmented summary and
  markdown reporters now surface the remediation text (a "Suggested remediation"
  section), powering a richer `explain`/`fix` experience. Like the rest of the
  layer it is fail-open and host-delegating (works over the MCP flow), and the
  deterministic core never depends on it.
- Dogfood harness `--analyze` flag: `npm run agentready:dogfood -- --analyze`
  runs the optional LLM layer over the cloned repositories **only when a provider
  is configured in the environment** (`AGENTREADY_LLM_BASE_URL`/`OLLAMA_HOST`/
  `OPENAI_API_KEY`), writing `*.augmented.{json,md}` alongside the deterministic
  reports. The deterministic dogfood path is unchanged and model-free; this makes
  the instruction-quality, false-positive-triage, and remediation analyzers a real
  release story. The two-tier instruction-quality story (deterministic presence
  /structure in core; semantic actionability judgment in the opt-in layer) is
  documented in `docs/product/llm-analytics-design.md`.
- .NET/C# and Autotools are now recognized command ecosystems, and a bare
  `requirements.txt` (or a `requirements/` directory / `requirements-*.txt`)
  counts as a Python project. Found scanning 100+ real repositories
  (uxlfoundation, IntelPython, oneapi-src, IntelLabs, intel): a C# solution
  (`*.sln`/`*.csproj`, e.g. `intel/acat` with 927 source files), an Autotools
  project (`configure.ac`/`Makefile.am`, e.g. `intel/QAT_Engine`), and
  research repos with only a `requirements.txt` were previously detected as
  having no ecosystem and were silently exempt from the test/lint/build
  expectations. .NET maps to `dotnet build`/`test`/`format` (full
  capabilities); Autotools maps to `./configure && make` with `make check`
  inferred from `TESTS`/`check_PROGRAMS` in `Makefile.am`.
- The GitHub Action's PR comment is now quiet on clean runs by default. A new
  `pr-comment-condition` input (`on-findings` default, or `always`) gates the
  sticky comment: `on-findings` posts only when a run has new findings or
  regressions, so a clean PR keeps its thread free of empty "all clear" noise —
  the verdict still appears in the job summary. A comment left by an earlier run
  with findings is updated to its resolved state once those findings clear,
  rather than lingering with stale content. The diff job summary/markdown now
  leads with a one-line ✅/⚠️ verdict so the status reads at a glance.
- **Gradle** and **Maven** are now recognized command ecosystems. Gradle
  (`build.gradle[.kts]`/`settings.gradle[.kts]`/`gradlew`) and Maven (`pom.xml`)
  surface build + test always (the compiler type-checks as part of the build, so
  no separate type-check command is claimed) and lint only when a known
  static-analysis plugin is configured (checkstyle/pmd/spotbugs/spotless/ktlint/
  detekt). The CI workflow parser learns the matching commands — `./gradlew
  build`/`check`, `mvn`/`./mvnw package`/`verify`, and (for .NET) `dotnet
  build`/`test`/`format` — so a JVM/.NET repo whose CI runs them is not falsely
  flagged with `ci.*.not-run`. The `CommandEcosystem` schema/type and the
  published JSON Schemas are updated accordingly.
- Property/fuzz tests for the parsers (`__tests__/parser-fuzz.test.ts`): a seeded, dependency-free generator drives `classifyRunCommandKinds`/`classifyUsesCommandKinds`, the YAML workflow parser, and full `scanLocalReadiness` over malformed manifests, asserting the parsers are *total* (never throw) and shape-correct (valid, de-duplicated, canonically-ordered command kinds; clamped scores) on arbitrary and deliberately-broken input. Seeded so failures reproduce deterministically.
- Recurring real-world validation harness for AgentReady:
  `npm run agentready:realworld-cron -- --batch-size <n>` rotates through a
  tracked pool of public repositories, clones them into
  `reports/agentready-realworld-cron/work/`, writes ignored per-run scan
  artifacts, appends tracked ledger entries, and creates issue-candidate notes
  for suspected scanner false positives or repo-selection blockers.
- Dogfood release harness: `npm run agentready:dogfood -- --out <scratch-dir>`
  clones the configured real-repository set into a scratch directory and writes
  JSON/markdown reports there, keeping scan artifacts out of the tracked repo.
- CMake and Bazel are now first-class command ecosystems in scan reports,
  alongside Node, Make, Go, Rust, and Python.
- AgentReady now dogfoods its own GitHub Action in CI (`.github/workflows/ci.yml`): a `readiness` job runs the bundled Action (`uses: ./`) — diff mode with a sticky PR comment on pull requests, full scan on push — and uploads the SARIF report to the code-scanning dashboard (skipped for fork PRs where the token is read-only). The CodeQL upload action is pinned to a commit SHA.
- CI command-coverage is now orchestrator-aware: the `ci` evidence carries an `orchestratorKinds` set so the `ci.*.not-run` checks stay silent, per command kind, when a workflow dispatches that command through a task runner the parser cannot decompose. General runners (`tox`, `nox`, `make`, `uv/poetry run`, `just`, `turbo`, `nx`, …) cover every kind; `pre-commit` covers only lint/type-check. Installing a runner (`pip install tox`) is distinguished from executing it, and install arguments are no longer misread as having run the tool — including arguments wrapped onto a continuation line (`pip install \` ⏎ `  pytest`), which are joined before the step is split into commands.
- The `ci.test.not-run`, `ci.lint.not-run`, and `ci.typecheck.not-run` checks are now emitted at **info** severity (previously warnings), matching `ci.build.not-run`. Command-coverage inference is heuristic, so these surface a likely gap for a human to confirm and never gate the score.
- CI command-coverage `ci.*.not-run` checks are now gated on single-job confidence: when recognized verification commands are spread across more than one job (a multi-job pipeline or an OS/toolchain matrix that splits lint/test/build), a missing kind may run in another job through a marketplace action, matrix leg, or wrapper script the parser cannot classify — so the not-run findings are suppressed rather than risk a false positive (seen on repos like ripgrep/gin). They still fire when recognized verification commands are concentrated in a single job. Only jobs with a *concrete* verification kind count toward the spread: a dedicated dependency-install job (`npm ci`) does not, and a job that covers a kind only through an orchestrator does not either — tracked per job via a new `orchestratorKinds` field on each `ci.workflows[].jobs[]` entry (schemas updated), so a concrete `npm run lint` job still counts even when a separate `pre-commit/action` job globally covers lint.
- CI command-coverage no longer counts a verification script *path* that is only read or manipulated, not executed. A segment led by a non-executing file utility (`chmod`, `cat`, `cp`, `mv`, `rm`, `ls`, …) is skipped, so `chmod +x test.sh` or `cat build.sh` no longer create false `test`/`build` coverage — only the actual execution (`./test.sh`, `bash run_test.sh`, Windows `call run_test.bat`) counts. Unrelated file names that merely contain `test`/`build` as a substring (e.g. `latest.sh`, `prebuild.sh`) were already excluded by the path-boundary anchors; this is now locked in by negative tests.
- The low-precision `docs.architecture.missing` rule is replaced by a broader, higher-precision **`docs.developer.thin`** signal (info). The old rule fired on a non-trivial repo whenever a specific architecture/design doc was absent, tripping on most well-documented OSS projects. The new rule fires only when the *entire* developer-facing doc surface is thin — no `CONTRIBUTING`, no architecture/design/development notes (`ARCHITECTURE`/`DESIGN`/`DEVELOPMENT`/`INTERNALS`/`HACKING` at the root or `architecture`/`design`/`development`/`internals` docs under a `docs/` tree), and no populated `docs/` tree — so a project documented through any of those channels stays silent.
- Lockfiles across ecosystems (`uv.lock`, `poetry.lock`, `Pipfile.lock`, `pdm.lock`, `Cargo.lock`, `go.sum`, `composer.lock`, `Gemfile.lock`, `gradle.lockfile`, `npm-shrinkwrap.json`, plus the existing npm/yarn/pnpm/bun lockfiles) are treated as generated, so a large committed lockfile no longer trips `files.large`. Found while assessing real repositories (fastapi's 1.1 MB `uv.lock`).
- Semantic CI parsing: the CI detector (`detectors/ci-workflows.ts`) now parses each GitHub Actions workflow's steps with the `yaml` package — classifying `run:` commands (and a small map of known verification actions for `uses:`) into install/lint/type-check/test/build — instead of only listing workflow files. The `ci` evidence gains `workflows` (per-job detected command kinds) and aggregate `hasInstall`/`hasLint`/`hasTypeCheck`/`hasTest`/`hasBuild` flags (schemas and the public types are updated accordingly). New checks flag commands the repository exposes but CI never runs: `ci.test.not-run`, `ci.lint.not-run`, and `ci.typecheck.not-run` (warnings) and `ci.build.not-run` (info). To avoid false positives, these stay silent when the parse is low-confidence — a workflow exists but no command was recognized (e.g. CI runs entirely through composite/marketplace actions). Parsing is read-only and a malformed workflow degrades gracefully; workflow correctness is still delegated to actionlint/ShellCheck rather than reimplemented. The console and markdown reports gain a one-line "CI verification coverage" summary. The bundled Action now includes the `yaml` parser (~520kB → ~692kB).
- GitHub Action pull-request comment: a new `pr-comment` input posts the markdown report as a single sticky pull-request comment, updating it in place on each run (matched via a hidden marker) instead of stacking new comments. It uses the workflow `github-token` (new `github-token` input, defaults to `${{ github.token }}`) and needs `permissions: pull-requests: write`. Fail-open — a missing permission, missing token, or non-pull-request run logs a notice/warning and never fails the action. The orchestration lives in `lib/action/pr-comment.ts` (GitHub-agnostic, with an injectable REST client) over the node20 global `fetch`, so the bundle stays free of `@actions/github`/`undici`.
- Dependabot configuration (`.github/dependabot.yml`): weekly, grouped minor/patch updates for the npm and github-actions ecosystems (security updates still raised individually).
- Substantially expanded the test strategy and **raised the coverage gate from 40% to 80%** (statements/branches/functions/lines), now enforced in CI by running `test:coverage`. The CLI (`bin/agentready.ts`) is refactored to export `buildProgram()` (auto-run guarded behind `require.main === module`) so a new `cli.test.ts` drives every subcommand (`scan`, `diff`, `validate-config`, `analyze`, `init`, `explain`) in-process — asserting output routing, gating, and exit codes — and the CLI is now measured by coverage. Added: an ecosystem **fixture matrix** (`go-repo`, `rust-repo`, `python-repo`, `make-repo`) plus `command-surfaces.test.ts` covering the multi-language detector branches (Makefile target aliases, package-manager lockfiles, Python config variants, file-read/JSON-parse error paths); direct `run()` orchestration tests for all three analyzers via a stub `Runner` (`analyze-analyzers.test.ts`); JSON/Markdown/SARIF/console **snapshot tests** (`output-snapshots.test.ts`) with paths/timestamps normalized; a stdio MCP transport test (`mcp-stdio.test.ts`); and reporter branch tests. Test count rose from 164 to 232.
- Offline evaluation harness with a **CI floor** for the optional LLM analytics layer: `bin/agentready-eval.ts` (`npm run agentready:eval`) runs the real analyzer pipeline over a labeled gold corpus of fixtures paired with canned model responses (no model calls), reporting precision/recall/F1, the confusion matrix, and confidence calibration, and exiting non-zero below the floor. `analyze-corpus.test.ts` enforces the floor in CI, catching plumbing regressions — broken hallucination guards, dropped score folding, insight-id drift — without a live model; the same harness can score a real model in a one-off recording run.
- False-positive triage analyzer and an evaluation harness for the LLM layer. The triage analyzer reviews path-bearing deterministic findings against the evidence and flags likely false positives (e.g. an intentional fixture flagged as a large file), emitting `analysis.false-positive:*` insights with a small positive score impact rather than silently suppressing anything. The evaluation harness (`lib/analyze/evaluation.ts`) scores analyzer output against a labeled gold set — confusion matrix, precision/recall/F1, and confidence calibration (mean stated confidence vs. observed accuracy per bucket) — as pure, deterministic math fed by the record/replay harness, so we can measure and calibrate the layer before trusting it.
- Cross-surface contradiction analyzer and task→model routing for the LLM layer: a new analyzer flags genuine conflicts between two or more agent instruction surfaces (e.g. one file says "use npm", another "use yarn"), emitting `analysis.contradiction:*` insights; and a routing table (`ProviderRouting`) lets each analyzer task (`triage`, `contradiction`, `remediation`) use a different model, with a default fallback, so a run can pair a cheap triage model with a stronger model for contradictions. The contradiction analyzer is host-delegating, so it also works over the MCP flow.
- Host integration for the LLM layer, so agents reuse their own model and AgentReady holds no credentials: an injected-client library API (`analyzeWithProvider`) and a host-delegated flow (`buildHostRequests` + `ingestHostResponses`) where AgentReady emits prompts plus already-sliced evidence for the host's model to answer and folds the validated answers back into an augmented report. Ships a dependency-free MCP (Model Context Protocol) stdio server — the `agentready-mcp` bin and `./mcp` package export — exposing `agentready_scan`, `agentready_analyze_prepare`, and `agentready_analyze_finalize`. Analyzers gained an optional host-delegation capability so the same request/insight logic powers both the provider pipeline and the host path.
- GitHub-native LLM augmentation in the Action: a GitHub Models provider (`createGitHubModelsProvider`) usable in CI with the workflow's built-in `GITHUB_TOKEN` + `permissions: models: read` (no secret to manage), gated behind an explicit `AGENTREADY_USE_GITHUB_MODELS=1` opt-in so the ambient token never silently enables model calls. The Action gains `analyze` and `analyze-min-score` inputs and `augmented-score`/`augmented-report-path` outputs; when enabled it appends the augmented analysis to the job summary and can gate on the augmented score. The deterministic gates run first and are unaffected; without a provider the run is deterministic-only.
- `analyze` CLI command and the first end-to-end LLM augmentation: `agentready analyze [path]` runs a deterministic scan and then the optional analytics layer, producing an *augmented report* (`--format summary|json|markdown`, `--output`, `--min-score`, on-disk cache via `--cache-dir`/`--no-cache`). A provider is auto-detected from the environment; without one it runs deterministic-only. The deterministic score is never mutated — a separate, clearly-labeled `augmentedScore` with itemized, confidence-weighted adjustments is reported alongside it. Includes the first Tier-2 analyzer (instruction-quality: judges whether an instruction file is actually actionable, not merely present), `computeAugmentedScore`, the fail-open `analyzeReport` orchestrator, and summary/markdown reporters. The deterministic `scan`/`diff` commands never call a model.
- LLM analytics efficiency spine (`lib/analyze/`, `./analyze` subpath): byte-budgeted evidence slicing (`sliceFiles`, `summarizeEvidence`) so a model only ever sees relevant files plus a tree summary; a content-hash result cache (`createFileCache`/`createMemoryCache`, key folds model + prompt version + schema version + input) so unchanged evidence avoids re-calling a model; per-task/per-run token budgets (`createBudgetTracker`); a fail-open runner (`createRunner`) composing cache → budget → provider that never throws (errors, timeouts, and budget exhaustion drop the insight, never the run); and a record/replay provider (`createReplayProvider`/`createRecordingProvider`) so AgentReady's own tests never call a live model.
- LLM analytics provider abstraction (`lib/analyze/`, `./analyze` subpath): an OpenAI-compatible adapter (`createOpenAiCompatProvider`) that covers hosted OpenAI and local servers (Ollama, vLLM, LM Studio) through a single base URL, with an injectable `fetch` so it is unit-tested without network access; and environment-based auto-detection (`detectProvider`) resolving a provider from `AGENTREADY_LLM_BASE_URL`, `OLLAMA_HOST`, or `OPENAI_API_KEY` (none set ⇒ deterministic-only). Requests pin temperature 0 and JSON output; transport/parse errors throw so the calling pipeline can apply fail-open.
- LLM analytics layer contracts (`lib/analyze/`, exported via the `./analyze` package subpath): Zod schemas for `LlmInsight` and the `AugmentedReport` (deterministic report + insights + a clearly-labeled `augmentedScore`), with compile-time drift guards; the `LlmProvider` port and `LlmRequest`/`LlmResponse` types (interface only, no implementation); contract validators; and published JSON Schema (`schemas/llm-insight.schema.json`, `schemas/augmented-report.schema.json`). The optional analytics layer consumes the deterministic core's emitted evidence; the core never imports it. See `docs/product/llm-analytics-design.md`.
- `init` CLI command: scaffolds a starter `.agentready.json` (equal to the documented defaults) and, with `--agents`, a starter `AGENTS.md` instruction file. Existing files are skipped unless `--force` is passed; the command is non-failing and reports exactly what it created vs. skipped. Backed by an exported `scaffoldInit` helper with tests.
- Config discovery via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig), restricted to **data-only** formats: `package.json#agentready`, `.agentready.json`, `agentready.config.json`, `.agentreadyrc[.json|.yaml|.yml]`, and `agentready.config.yaml`/`.yml` (YAML support is new). Discovery is rooted at the scanned directory and does not walk up into parent directories. Executable config (`.js`/`.ts`/`.cjs`/`.mjs`) is refused — cosmiconfig's JS/TS loaders are overridden with a refusing loader and excluded from the search places — preserving the never-execute/offline guarantee. Explicit `--config` accepts JSON or YAML and stays strict; during discovery an unparsable candidate (e.g. a malformed `package.json`, the first search place) is skipped with a warning so it neither crashes the scan nor shadows a valid sibling config. `init` bootstraps a non-existent target directory. The bundled Action keeps `typescript` external from `ncc` so the unreachable TS loader does not bloat the bundle.
- `explain <finding-id>` CLI command: prints a readiness rule's rationale, remediation steps, and references (accepts a full finding id like `files.large:blob.bin` or a bare rule id; `--list` shows all documented rules, `--json` emits structured output). Backed by a new `checks/catalog.ts` rule catalog exported from the public API (`RULE_CATALOG`, `getRuleDoc`, `listRuleIds`, `formatRuleDoc`, `ruleKeyFor`), with a test that guards against detector/catalog drift.
- `--fail-on <off|info|warning|error>` and `--min-score <0-100>` gating flags on the `scan` and `diff` CLI commands, bringing the CLI to parity with the GitHub Action's gates. The gate logic now lives in a single shared `core/gate.ts` module (`evaluateScanGate`/`evaluateDiffGate`) used by both the CLI and the Action, and is exported from the public API. When a gate trips, the CLI prints the reasons to stderr and exits non-zero.
- Capability-surface detector for agent capability config: Model Context Protocol servers (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`), Claude Code skills, hooks/settings, plugin manifests (`.claude-plugin/*.json`), and code-intelligence/LSP config (`.vscode/settings.json`, `.vscode/extensions.json`, `.editorconfig`). Surfaced as typed `capabilities` evidence in the report.
- Safety-signal detector for package scripts: install-time lifecycle hooks, destructive shell commands, network-download-piped-to-shell commands, and deploy/publish paths. Surfaced as typed `safetySignals` evidence with corresponding `safety.*` findings (destructive and network-exec are warnings; install hooks and deploy/publish are informational).

### Fixed
- Extensionless fuzz-corpus seed files under test corpus directories are treated
  as intentional fixture data, keeping large checked-in fuzz payloads from
  surfacing as warning-level context-friction findings.
- Large generated/test fixture artifacts, including baseline and generated
  snapshot-style files, are suppressed as intentional generated data when they
  are in explicit generated or test fixture locations.
- Generated or vendored minified files are no longer emitted as minified-file
  readiness warnings; they remain visible in inventory counts without
  score-gating repos for intentional bundled assets.
- Large text snapshot/golden/fixture artifacts in benchmark-style snapshot
  directories are now downgraded to informational fixture data findings instead
  of warning/error `files.large` readiness blockers, while generic large text
  files remain score-gating.
- README/documentation symlinks can satisfy documentation detection without
  exposing symlinked manifests, workflows, or other detector-read files to
  downstream readers that would follow targets outside the repository.
- The CI bare-`tsc` build matcher no longer matches `vue-tsc` (a type-checker):
  a left `(?<![\w-])` boundary excludes the hyphenated suffix, so a CI step that
  runs only `vue-tsc` is no longer credited with build coverage.
- The CI `npm run` lint/type-check matchers now mirror the command-surface
  script-name conventions and their `:`/`-`/`_` separators (`check:lint`,
  `check-lint`, `check_lint`, `lint:js`, `check:type`, `check-type`,
  `check_type`, `typings`, …). A CI step of `npm run check-lint`/`check:type`
  whose script body is an opaque shell wrapper is now recognized by name, so
  `ci.lint.not-run` / `ci.typecheck.not-run` are not falsely emitted.
- CI command-coverage spread gate now tracks each job's **concrete** verification
  kinds separately, so a job that runs a command directly (e.g. `npm run lint`)
  still counts toward the multi-job spread even when another step in the same job
  is an opaque orchestrator (`pre-commit/action`, `tox`, `make ci`) that also
  covers that kind. Previously such a job was discarded — treated as
  orchestrator-only — which could revive a false `ci.*.not-run` finding on a
  genuinely multi-job pipeline.
- Gradle lint detection now recognizes every *applied* plugins-DSL form, not just
  quoted `id("…tool…")`: a bare plugin accessor (`checkstyle`) and a version-catalog
  alias (`alias(libs.plugins.spotless)`) inside a `plugins { … }` block now surface
  the lint surface, while a static-analysis tool that appears only as a dependency
  coordinate in `dependencies { … }` (e.g. `spotbugs-annotations`) still does not.
- Large **binary** assets (images, video, PDF, archives, model weights,
  installers) are now surfaced at `info` instead of `warning`/`error`. An agent
  never loads a binary into its text context, so a binary blob is not the
  "context friction" the `files.large` check targets — only large *text/source*
  files still escalate. Found scanning 100+ real repositories, where binary
  assets dragged otherwise-healthy projects to near-zero scores (e.g.
  `intel/acat` 68→0, a presentations repo, ML repos full of checked-in
  weights). Large text/source files are unchanged.
- `diff` now treats a persistent finding whose severity **worsens** at the same
  `id`+`path` as a regression. Previously regressions were only newly-appearing
  findings, so replacing a large binary asset (info) with a same-path large
  text/source file (warning) — which shares the `files.large:<path>` id — would
  slip past `--fail-on-regression`.
- Test files in non-JS/TS ecosystems are now classified as tests instead of
  source. Go (`*_test.go`), Python (`test_*.py`/`*_test.py`), JVM/C#
  (`*Test`/`*Tests`/`*Spec`/`*IT`), Ruby/Elixir (`*_test`/`*_spec`), C/C++
  gtest (`*_test.cc`), and Swift (`*Tests.swift`) conventions are recognized
  even when the file lives outside a `tests/` directory. Found dogfooding
  cobra, which reported 17 test files as `0 tests` and inflated its source count.
- Node lint/type-check detection now inspects script **bodies** and
  non-canonical script **names**, not just a script literally named
  `lint`/`type-check`. A linter or type-checker run inside an aggregate script
  (e.g. `"test": "xo && tsc --noEmit && ava"`) or under a name like
  `check:lint`/`check:type` is recognized, eliminating false
  `commands.lint.missing` / `commands.typecheck.missing` findings (found on
  `sindresorhus/got` and `tj/commander.js`). A bare `"build": "tsc"` is still
  treated as a build, not a dedicated type-check surface. Script bodies are
  inspected per-invocation and install commands are skipped, so a tool named
  only as an install argument (`"setup": "npm install eslint"`) is not misread
  as a runnable lint/type-check surface. Bare-word linter matchers
  (`xo`/`standard`/`tslint`/`oxlint`/`rome`/`biome`) exclude a trailing hyphen,
  so a hyphenated release tool such as `standard-version` is not mistaken for
  the StandardJS linter (same guard in the CI lint matcher).
- CI command-coverage now resolves `npm run <script>` / `npm test` aliases
  against `package.json` (recursively, with a cycle guard) before classifying a
  workflow step, so a CI step of `npm test` that runs lint + type-check + test
  no longer produces false `ci.lint.not-run` / `ci.typecheck.not-run` findings.
  The CI lint matcher also recognizes `xo`/`standard`/`tslint`/`oxlint`,
  matching the command-surface detector. CI `tsc` classification is now
  consistent with the command surface: a bare/emitting `tsc` (incl. `tsc -b`)
  is a **build** and only `tsc --noEmit` (or `tsd`/`vue-tsc`/`svelte-check`) is
  a type-check, so expanding a `npm run build` alias whose body is `tsc` can no
  longer suppress `ci.typecheck.not-run` when CI never runs the dedicated
  type-check command. Alias expansion is `working-directory`-aware: a step (or
  job/workflow `defaults.run.working-directory`) that runs in a subdirectory is
  not expanded against the root `package.json`, so a monorepo `npm test` in
  `packages/api` no longer attributes the root test script's lint/type-check to
  that step.
- `scan`/`analyze` now fail loudly when the target path does not exist or is a
  regular file, instead of silently producing a phantom "empty repository"
  report (previously a missing path scored ~68/100 with exit 0 under
  `--fail-on off`).
- The `docs.readme.missing` check now requires a **root** README. A README
  nested under `docs/` or a subpackage no longer suppresses the missing-README
  error, since the root README is the agent's primary entrypoint (the nested
  file is still inventoried for reporters).
- `prepublishOnly` and other publish/pack-only npm lifecycle scripts are no
  longer reported as install-time safety hooks; `prepublishOnly` runs before
  publishing, not during ordinary dependency installation.
- Python command detection now uses structured `pyproject.toml`/`setup.cfg`
  sections instead of broad substring matching, so comments/prose such as
  copyright text no longer imply pytest, lint, or type-check coverage.
- Large scientific sample/fixture data under common `data`, `examples`,
  `tests`, and benchmark fixture paths is downgraded to informational context
  friction without hiding arbitrary large blobs elsewhere.
- The analysis result cache now folds the concrete model into its key (via a new optional `model` on the `LlmProvider` port), so switching models between runs is a clean cache miss instead of returning the previous model's insights.
- Contradiction insight ids now incorporate the conflicting file pair as well as the topic, so two distinct contradictions with similar topics no longer collide; exact duplicates from the model are collapsed.
- `ingestHostResponses` now reports (via an optional `onWarn`) when a host response references an unknown analyzer or fails to ingest, instead of dropping it silently.
- **Security:** auto-detection no longer forwards `OPENAI_API_KEY` to a custom `AGENTREADY_LLM_BASE_URL`; a custom endpoint receives only an explicitly-scoped `AGENTREADY_LLM_API_KEY`, so an OpenAI secret can't leak to a local/third-party URL.
- The MCP stdio server is now fail-open per request (a throwing handler is reported to stderr and the stream continues), the augmented-report markdown reporter escapes pipes/newlines in LLM-produced table cells, the `agentready_analyze_finalize` MCP tool requires `path` (so finalize re-scans the same tree as prepare), and the CLI uses `parseAsync` so async `analyze` failures set a non-zero exit code.

### Removed
- The entire Next.js web application: browser UI, `POST /api/analyze` and `POST /api/report` routes, the OpenAI-based assessment engines (`ai-assessment`, `enhanced-ai-assessment`, `aligned-assessment-engine`, `unified-metrics-engine`, `metrics-validator`), website/business-type analysis, the file-size analyzer, and PDF report generation — along with their tests and the OpenAI mock.
- Next.js, React, Tailwind, and Vercel configuration and dependencies. AgentReady is now a pure local-first CLI/library with no runtime dependencies and no network calls at scan time.
- Repository debris (`temp_architecture_analysis.md`, `test-file-size.js`) and legacy web-app development docs.

### Changed
- Reused mature ecosystem libraries in the file inventory instead of bespoke code: traversal now uses [`fast-glob`](https://github.com/mrmlnc/fast-glob), ignore rules use [`ignore`](https://github.com/kaelzhang/node-ignore), and binary detection uses [`isbinaryfile`](https://github.com/gjtorikian/isBinaryFile) (still short-circuiting on known binary extensions to avoid reading large media). Classification output is unchanged for non-ignored files, and `walkFiles` keeps the same signature. The bundled Action grows accordingly (~692kB → ~793kB). (`picomatch` for the `ignorePaths` glob matcher remains a follow-up.)
- Migrated the CLI from a hand-rolled argument parser to [Commander](https://github.com/tj/commander.js). Commands, positional `path`, and all flags (including legacy `--json`/`--markdown`/`--sarif`) are unchanged; the migration adds per-command `--help`, validated `--format`/`--fail-on` choices, and clearer error messages for unknown options/commands and missing required `diff` refs.
- Restructured the scanner into a layered architecture under `lib/repo-readiness/`: `core/` (scan engine, config, scoring, contracts, git, types), `detectors/`, `checks/`, and `reporters/`. The public API is preserved via a barrel module.
- Hardened `diff` to scan git refs in isolated `git worktree` checkouts instead of checking out refs in place; it no longer mutates the working tree and works with uncommitted changes.
- Renamed the package to `agentready` and added a `bin` plus a `tsc` build to `dist/`, so it installs and runs via `npx`.
- Switched tooling to standalone ESLint (`@typescript-eslint`) and Jest via `ts-jest`; CI and tests run fully offline with no API keys.
- Rewrote README, AGENTS.md, `.cursorrules`, and the development/product docs for the local-first CLI, and refreshed the architecture/roadmap to mark implemented vs planned work.

### Added
- Multi-ecosystem command-surface detection (Node, Make, Go, Rust, Python); command-related findings are gated on a recognized ecosystem so non-Node repositories are not penalized.
- AgentReady scanner config support via `.agentready.json`, `agentready.config.json`, or `--config <path>`, with configurable ignore paths, large-file thresholds, minified-file policy, and warning escalation.
- Local-first `scan` and `diff` CLI commands with console, JSON, compact, and markdown output.
- Repository inventory, documentation, command, CI, instruction-surface, large-file, binary, generated, and minified-file readiness findings.
- Contract validation, fixture repositories, and a CLI smoke runner; CI self-scan and PR regression gate.
- Instruction-surface detector with typed evidence across Codex, Claude Code, GitHub Copilot, Cursor, Gemini, Windsurf, Cline, and Roo Code.
- Product and development documentation, and an MIT license file.

## Archived — pre-pivot web application

The entries below describe the original AI Agent Readiness Assessment web
application, which has been removed in the pivot to a local-first CLI. They are
retained for historical context only.

### Changed
- Simplified public CI to a focused Node 20 verification workflow for type checking, linting, tests, build, and informational dependency audit.
- Replaced OpenAI-shaped fake test keys with clearly invalid test placeholders to avoid public secret-scanning noise.
- Removed the `prepare` lifecycle hook so clean installs do not depend on local git-hook setup.

### Changed
- **Unified Agent Compatibility Analysis**: Merged Static Analysis Results and File Size & AI Agent Compatibility sections into a single, focused Agent Compatibility Analysis section
- **Agent Framework Support**: Updated agent compatibility to include Cursor, GitHub Copilot, Claude (unified), and Codex with agent-specific details and tooltips
- **Context Analysis Improvement**: Enhanced context consumption analysis to focus on context tokens rather than lines for better AI agent compatibility assessment
- **Repository Structure Focus**: Streamlined repository structure analysis to focus on essential checks that help agents work with repositories (README, AGENTS.md, CONTRIBUTING.md, LICENSE, CI/CD, Tests)
- **Large Files Warning**: File size distribution now only shows when there are large files (>1MB) that could impact agent performance
- **Website-Only Static Analysis**: Static Analysis Results section now only displays for websites, with repository-specific checks moved to Agent Compatibility Analysis

### Fixed
- **Business Type Detection Accuracy**: Fixed incorrect classification of technology/software documentation sites as "automotive" by improving keyword specificity and adding dedicated "technology_software" business type
- **Automotive Keywords**: Made automotive keywords more specific (e.g., "car repair", "auto repair", "vehicle service") to prevent false positives from technical terms containing "auto"
- **Technology-Specific Assessment**: Added technology_software business type with appropriate keywords (software, api, documentation, developer, intel, github, vector search, etc.) and tailored agentic flow analysis for technology sites
- **Contact Details & Social Media Links**: Restored missing contact information and social media links extraction that were not being displayed in the output
- **GitHub Social Media Detection**: Added GitHub links to social media extraction for technology sites, with proper platform identification and clickable URLs
- **Enhanced Contact Extraction**: Improved contact information extraction to include email addresses and phone numbers from both links and text content using regex patterns
- **Social Media Section Display**: Fixed social media section to always show (with "None discovered" when empty) instead of hiding when no links found
- **Limited Site Crawling**: Added intelligent key page analysis that follows navigation links to contact, about, services, pricing, support, help, team, and company pages to gather comprehensive site information
- **Technology Section Consolidation**: Removed duplicate "Programming Languages" section and consolidated into single "Detected Technologies" section with improved visual distinction and helpful context for improvement suggestions

### Added
- Instruction surface detector with typed evidence for AGENTS.md, Claude Code, GitHub Copilot, Cursor, Gemini, Windsurf, Cline, and Roo Code rule files.
- **Multi-Page Analysis**: System now analyzes up to 3 key pages per site (contact, about, services, etc.) in addition to the main page for more comprehensive information gathering
- **Comprehensive Data Merging**: Contact info, social media links, and navigation structure are now merged from main page and key pages with deduplication
- **Location Information Extraction**: Added intelligent location extraction from structured data, microdata, text content, and map links for location-relevant business types
- **Business-Type-Aware Location Display**: Location information is only shown for business types where it matters (restaurants, healthcare, retail, automotive, etc.) - not for software documentation
- **Location Grouping**: Multiple locations are automatically grouped by city/region for better organization and display
- **Code Review Improvements**: Addressed all 7 code review comments with security, performance, and maintainability enhancements

### Security & Performance Improvements
- **Command Injection Protection**: Fixed curl fallback vulnerability by properly escaping URL parameters before shell execution
- **External Link Security**: Added `nofollow` attribute to social media links to prevent SEO endorsement and improve security
- **DNS Security Enhancement**: Added explicit DNS rebinding protection documentation and improved error messages
- **Regex Performance Optimization**: Implemented cached regex compilation for business type keyword matching to improve performance
- **Module Constants**: Moved hardcoded extensionless files array to module-level constant to prevent recreation on every call
- **Code Documentation**: Added explicit comments for variance calculation behavior and AI value validation logic
- **TypeScript Improvements**: Enhanced type safety with proper AI value validation helper function

### Added
- [`.cursorrules`](.cursorrules) with Cursor-recommended instructions for Vercel/Next.js/TypeScript/Node workflows
- [`AGENTS.md`](AGENTS.md) documenting agent operating procedure and links to [`dev/ARCHITECTURE.md`](dev/ARCHITECTURE.md) and [`dev/DEVELOPMENT.md`](dev/DEVELOPMENT.md)
- AI Analysis Status tracking with comprehensive status indicators
- Enhanced error handling and debugging information display
- Conditional debug information that only shows when issues are detected
- Combined AI Analysis Status and Debug Information sections for better UX
- Comprehensive test coverage with 93 passing tests
- OpenAI API mocking system for reliable testing
- TypeScript error fixes and improved type safety
- **CRITICAL**: Coherent assessment system ensuring consistent metrics across all analysis blocks
- **NEW**: Business-type-aware assessment system with 15 industry configurations
- **NEW**: AI-relevant assessment criteria focusing on agent usability
- **NEW**: 5 agentic flows with business-specific importance weights
- **NEW**: Enhanced SSRF protection with comprehensive IP range filtering
- **NEW**: DNS-level security validation for website analysis
- **NEW**: Word-boundary regex for improved business type detection accuracy
- **NEW**: Extensionless file detection (Dockerfile, Makefile, etc.)
- **NEW**: Debug flag gating for production logging control
- **NEW**: Multi-strategy HTTP fallback system with 4 progressive strategies (minimal axios, native fetch, node-fetch, curl)
- **NEW**: URL-based analysis fallback when all HTTP strategies fail
- Website-specific scoring algorithms that align with agentic flow analysis
- Unified key findings generation based on actual analysis context (website vs repository)

### Changed
- Improved contributor/agent guidance by centralizing rules and linking architecture/development docs
- **UPDATED**: `dev/DEVELOPMENT.md` with comprehensive progress log documenting business-type-aware assessment system implementation
- **IMPROVED**: Overall score scaling from 0-20 to 0-100 for better user understanding
- **ENHANCED**: AI value handling to properly treat zero scores as valid data points
- **REFINED**: Meta description validation to trim whitespace before truthy checks
- **EXPANDED**: AI readiness insights to include all 5 agentic flows (taskManagement and personalization)
- **OPTIMIZED**: API response payload by limiting findings/recommendations to top 10 items
- **HARDENED**: Security validation with comprehensive SSRF protection and DNS-level checks
- **CRITICAL FIX**: Overall readiness score now correctly uses business-type-aware scoring instead of legacy unified metrics
- Improved UI layout by combining separate status and debug sections
- Enhanced error messages with more detailed debugging information
- Updated test configuration to use proper API key validation
- Streamlined frontend display logic for better user experience

### Fixed
- **CRITICAL**: Fixed overall readiness score discrepancy where business-type-aware scores (80-100) were being overridden by legacy unified metrics (8) causing incorrect "Needs improvement" ratings
- **TYPESCRIPT**: Fixed type signature for `createUnifiedMetric` to properly handle `undefined` AI values
- **HTTP RESILIENCE**: Added comprehensive multi-strategy fallback system for malformed HTTP headers (HPE_INVALID_HEADER_TOKEN) with 4 fallback strategies and URL-based analysis
- **DATA QUALITY**: Fixed duplicate contact information extraction using Set-based deduplication
- Documentation gaps for agent onboarding and change management
- TypeScript compilation errors related to missing `aiAnalysisStatus` property
- **CRITICAL**: Fixed major inconsistency where website analysis showed repository-focused key findings
- Fixed misalignment between detailed flow analysis scores and overall assessment scores
- Fixed key findings showing "README.md", "AGENTS.md", "CI/CD workflows" for website analysis instead of website-specific issues
- Fixed scoring inconsistencies between static analysis and AI analysis for websites
- Fixed agentic flow analysis not being properly integrated with overall scoring system
- **MAJOR**: Redesigned website analysis system to be business-type-aware (food_service, hospitality, travel, healthcare, etc.)
- **MAJOR**: Removed irrelevant checks (mobile optimization, accessibility, SEO, page load speed) that don't help AI agents
- **MAJOR**: Implemented 5 agentic flows with business-type-specific weights and requirements
- **MAJOR**: Created comprehensive business type detection with 15 different business categories
- **MAJOR**: Replaced generic website analysis with AI-relevant checks only (structured data, contact info, content accessibility)
- **MAJOR**: Implemented weighted scoring system based on business type priorities
- OpenAI API mocking issues that were causing test failures
- CI pipeline failures due to improper test configuration
- Debug information display logic to only show when needed
- Test expectations to match updated error message formats

### Technical Improvements
- Added `__mocks__/openai.js` for consistent API mocking across all tests
- Updated Jest configuration for better test reliability
- Enhanced error handling in both frontend and backend
- Improved type safety with proper interface definitions
- Better separation of concerns between UI components

## [0.1.0] - 2024-01-XX

### Added
- Initial release of AI Agent Readiness Assessment Tool
- Static analysis engine for repository evaluation
- AI-powered assessment using OpenAI GPT models
- PDF report generation with comprehensive results
- Web interface for repository analysis
- Support for GitHub repository analysis
- File size analysis and agent compatibility scoring
- Context consumption analysis for instruction files
- Comprehensive test suite with Jest
- Vercel deployment configuration

### Features
- Repository URL input and validation
- Real-time analysis progress indication
- Score visualization with progress bars
- Category breakdown display
- Key findings and recommendations
- PDF download functionality
- Responsive design with Tailwind CSS
- Error handling and fallback mechanisms
- Debug information display
- API endpoints for analysis and report generation

### Technical Stack
- Next.js 14 with App Router
- TypeScript with strict typing
- Tailwind CSS for styling
- OpenAI API integration
- JSZip for file processing
- jsPDF for report generation
- Jest for testing
- Vercel for deployment
