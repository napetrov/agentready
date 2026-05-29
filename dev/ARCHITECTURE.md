# AgentReady Technical Architecture

AgentReady is a local-first CLI and library that scans a repository on disk for
AI coding-agent readiness. It performs no network calls and never executes the
scanned repository's scripts. This document describes the implemented system;
for product positioning and the longer-term model see
[docs/product/architecture.md](../docs/product/architecture.md).

## Pipeline

```
scan(root)
  load config            core/config.ts
  walk + classify files  detectors/file-inventory.ts
  run detectors          detectors/*  -> evidence
  run checks             checks/built-in.ts -> findings
  score                  core/scoring.ts
  report                 reporters/* (console | json | markdown)
```

`diff(base, head)` scans each git ref in an isolated temporary `git worktree`
(see `core/git.ts`), then compares findings to surface new regressions and
resolved findings. Because it uses worktrees, it never mutates the caller's
working tree, index, or branch and works even with uncommitted changes.

## Module Layout (`lib/repo-readiness/`)

- `core/`
  - `types.ts` — shared evidence, finding, config, and report types.
  - `config.ts` — loads and validates `.agentready.json` / `agentready.config.json` / `--config`.
  - `scan-engine.ts` — orchestrates detectors → checks → scoring; implements `scan` and `diff`.
  - `scoring.ts` — experimental 0–100 score from finding severities.
  - `contracts.ts` — runtime contract validators for scan and diff reports.
  - `git.ts` — `withWorktree` helper for safe ref scanning.
  - `util.ts` — path/glob helpers and type guards.
- `detectors/` — observe facts only, no judgment:
  - `file-inventory.ts` — walks the tree; classifies source/test/doc/generated/binary/minified files.
  - `command-surfaces.ts` — detects verification commands across Node, Make, Go, Rust, and Python.
  - `docs.ts` — README/CONTRIBUTING/architecture/environment docs and CI workflows.
  - `instruction-surface.ts` — re-exports the instruction-surface detector (`../instruction-surface-detector.ts`).
- `checks/built-in.ts` — evaluates evidence into findings with stable IDs.
- `reporters/console.ts`, `reporters/markdown.ts` — human-readable output. JSON output is the report object itself.
- `local-readiness.ts` — public API barrel. `index.ts` is the library entrypoint.

## CLI (`bin/`)

- `agentready.ts` — `scan` and `diff` commands, argument parsing, JSON/markdown/compact output, exit codes.
  - `scan` exits non-zero when any `error` finding is present.
  - `diff --fail-on-regression` exits non-zero when new warning/error findings appear.
- `agentready-fixture-smoke.ts` — runs the CLI against `fixtures/readiness/{good,bad}-repo` and validates the report contract.

## Constraints

- No network access and no execution of repository scripts during a scan.
- Output is machine-readable; report-shape changes must be reflected in `core/contracts.ts`.
- Detectors must be deterministic given the file tree.

## Build & Tooling

- TypeScript (strict), Node.js 18+.
- `npm run build` → `tsc -p tsconfig.build.json` emits CLI + library to `dist/`; the published `bin` is `dist/bin/agentready.js`.
- Tests run offline via Jest + ts-jest.
