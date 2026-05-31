# CI Setup

CI is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and
runs on pull requests and pushes to `main`. No secrets or external services are
required — the scanner runs fully offline.

## `verify` job (Node 20)

1. `npm ci --include=dev`
2. `npm run type-check`
3. `npm run lint`
4. `npm run test:coverage -- --runInBand` — runs the suite **with coverage so the
   80% thresholds in `jest.config.js` gate the build**.
5. `npm run agentready -- scan . --json --compact` — self-scan.
6. `npm run agentready:fixtures` — fixture smoke test.
7. `npm run agentready:pack-smoke` — tarball install smoke test.
8. `npm run agentready:schemas -- --check` — JSON Schema drift check.
9. `npm run agentready:action-smoke` + `git diff --exit-code action/dist` —
   bundled GitHub Action end-to-end, and a bundle-freshness gate.
10. `npm run agentready:eval` — offline gold-corpus evaluation of the optional
    LLM analytics layer (canned responses, no model calls); fails below the floor.
11. On pull requests: `npm run agentready -- diff --base origin/<base> --head HEAD . --fail-on-regression`
    to fail on new readiness regressions, plus a `--markdown` summary for review.
12. `npm run build` — compile the CLI/library to `dist/`.

The PR diff step relies on `fetch-depth: 0` so the base ref is available for the
`git worktree` checkout.

## `security` job

Runs `npm audit --audit-level=high` informationally (`continue-on-error: true`).

## Local equivalent

```bash
npm run ci   # lint + type-check + test + build
```
