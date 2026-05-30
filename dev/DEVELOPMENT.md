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
npm test
npm run build
npm run agentready -- scan .
npm run agentready:fixtures
```

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
  (Node, Make, Go, Rust, Python), docs and CI workflows, and instruction surfaces
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
- CLI on Commander + cosmiconfig (JSON/YAML/JS config); add `explain` and `init`.
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
