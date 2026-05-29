# Agents Guide

AgentReady is a local-first, command-line repository readiness scanner for AI
coding agents, written in TypeScript. It has no web app, no hosted service, and
makes no network calls while scanning.

Read these documents first:

- Architecture overview: [dev/ARCHITECTURE.md](dev/ARCHITECTURE.md)
- Development guide and roadmap: [dev/DEVELOPMENT.md](dev/DEVELOPMENT.md)
- Product direction: [docs/product/architecture.md](docs/product/architecture.md) and [docs/product/features.md](docs/product/features.md)

## Operating Procedure

1. Read `dev/ARCHITECTURE.md` to understand the detector → check → reporter model and constraints.
2. Review `dev/DEVELOPMENT.md` for current status, coding standards, and roadmap.
3. Draft a brief plan before implementation. Keep edits small and reversible.
4. Implement with strict TypeScript. Add new behavior as a detector and/or check rather than growing a monolith.
5. Verify with:
   - `npm run type-check`
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `npm run agentready -- scan .`
   - `npm run agentready:fixtures`
6. Document progress:
   - Add a progress note to `dev/DEVELOPMENT.md` (date, change, rationale, verification).
   - Update `CHANGELOG.md` under [Unreleased] with Added/Changed/Fixed as applicable.

## Project Layout

- `bin/` — CLI entrypoints (`agentready scan` / `diff`, and the fixture smoke runner).
- `lib/repo-readiness/` — the scanner library:
  - `core/` — scan engine, config, scoring, contracts, git worktree helpers, shared types.
  - `detectors/` — file inventory, command surfaces, docs/CI, instruction surfaces.
  - `checks/` — built-in readiness rules that turn evidence into findings.
  - `reporters/` — console, JSON, and markdown output.
- `fixtures/readiness/` — good/bad repositories exercised by the fixture smoke test.
- `__tests__/` — Jest tests (run offline via ts-jest).

## Testing & Safety

- Tests must pass locally with Jest and run fully offline.
- The scanner must never execute the scanned repository's scripts or reach the network.
- When changing report shapes, update the contract validators in `lib/repo-readiness/core/contracts.ts`.
- Avoid large, breaking edits. Prefer incremental, typed changes with clear error handling.

For further details, consult the linked docs above and `.cursorrules` in the repo root.
