# AgentReady Sample Report: High-Readiness Repository

> This is a compact illustrative report. It shows the shape of AgentReady output
> without requiring users to install or run the scanner first.

## Summary

- **Score:** 92 / 100
- **Findings:** 2 warnings, 4 info
- **Verdict:** Ready for agent-assisted maintenance with minor context-efficiency improvements.

## Evidence highlights

- Agent instruction entrypoint found: `AGENTS.md`
- Developer docs found: `README.md`, `CONTRIBUTING.md`, `docs/architecture.md`
- Verification commands found:
  - `npm run lint`
  - `npm run type-check`
  - `npm test`
  - `npm run build`
- CI workflow runs local verification commands on pull requests.
- Generated and bundled output paths are documented or ignored.
- No install-time lifecycle hooks or deploy/publish scripts were classified as
  dangerous for ordinary agent edits.

## Findings

### `instructions.always-on.large` — warning

`AGENTS.md` is useful but long enough to increase context cost for every agent
turn.

Suggested remediation:

- Keep repo-wide rules in `AGENTS.md`.
- Move task-specific examples to `docs/agent-guidance/` and link to them.
- Add a short “when to read more” section so agents can pull extra context only
  when needed.

### `docs.review-evidence.thin` — warning

The repository documents commands, but it does not state what evidence a coding
agent should leave in a PR summary.

Suggested remediation:

Add a short checklist to `CONTRIBUTING.md` or `AGENTS.md`:

- files changed and why
- verification commands run
- known skipped checks
- risk areas for reviewer attention

## Good agent operating path

An agent entering this repository can:

1. Read `AGENTS.md` for project rules.
2. Use `README.md` and `docs/architecture.md` for orientation.
3. Make a bounded source/test change.
4. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`.
5. Leave a concise PR summary with local evidence.

## Recommended next actions

1. Trim always-on instructions.
2. Add explicit PR evidence expectations.
3. Keep the AgentReady GitHub Action in diff mode to prevent readiness
   regressions.
