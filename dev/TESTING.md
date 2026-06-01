# Testing Guide

Tests run fully offline with Jest + ts-jest. There are no external services,
API keys, or network calls — the LLM analytics layer is exercised through
injected fake providers, a record/replay provider, and canned corpus responses.

## Commands

```bash
npm test                 # run all tests
npm run test:watch       # watch mode
npm run test:coverage    # coverage report (thresholds enforced in jest.config.js)
```

CI runs `npm run test:coverage` so the coverage thresholds gate the build.

## Coverage gate

`jest.config.js` enforces an **80%** global threshold on statements, branches,
functions, and lines. Coverage is collected from `lib/**` and from
`bin/agentready.ts` (the CLI). Other `bin/` scripts are CI smoke/codegen runners,
not unit-covered. Raise the thresholds as coverage climbs; do not lower them to
make a change pass — add tests instead.

## Layout

Unit/integration suites live in `__tests__/`. The high-traffic ones:

- `local-readiness.test.ts` — end-to-end scan/diff, config loading, finding
  generation, contract validation, markdown output, and worktree-isolated diff
  (including a dirty-working-tree case), using temporary repositories on disk.
- `command-surfaces.test.ts` — the multi-ecosystem command detector: a fixture
  matrix (Node/Go/Rust/Python/Make) plus unit tests for the parser branches
  (Makefile target aliases, package-manager lockfiles, Python config variants,
  and the file-read / JSON-parse error paths).
- `cli.test.ts` — drives every CLI subcommand (`scan`, `diff`, `validate-config`,
  `analyze`, `init`, `explain`) in-process via the exported `buildProgram()`,
  asserting output routing, gating, and exit codes.
- `instruction-surface-detector.test.ts` — instruction-surface detection across
  agent ecosystems.
- `capability-and-safety.test.ts` — capability-surface and safety-signal
  detectors, plus their integration into the full report.
- `output-snapshots.test.ts` — JSON / Markdown / SARIF / console snapshots of the
  canonical fixtures and the augmented report, with machine-specific paths and
  timestamps normalized so the snapshots are stable.

The LLM analytics layer (`lib/analyze/`):

- `analyze-contracts.test.ts`, `analyze-spine.test.ts`, `analyze-provider.test.ts`
  — data contracts, the efficiency spine (slicing/cache/budget/replay), and the
  provider adapters (network mocked via an injected `fetchImpl`).
- `analyze-pipeline.test.ts`, `analyze-routing.test.ts`, `analyze-host.test.ts`
  — the orchestrator, task→model routing, and the host-delegated / MCP flow.
- `analyze-analyzers.test.ts` — each analyzer's `run()` orchestration end-to-end
  (buildRequest → runner → buildInsights) via a stub `Runner`.
- `analyze-reporter.test.ts` — augmented-report rendering branches.
- `analyze-evaluation.test.ts` — the evaluation scoring math (precision/recall/
  F1/calibration).
- `analyze-corpus.test.ts` — the **CI floor**: runs the real analyzer pipeline
  over the offline gold corpus (see below) and asserts precision/recall/F1 stay
  at or above the floor, catching plumbing regressions (broken hallucination
  guards, dropped score folding, id drift) without calling a model.

- `mcp-stdio.test.ts` — the stdio JSON-RPC transport for the MCP server.

Jest is scoped to `<rootDir>/__tests__` and ignores `fixtures/`, `dist/`, and
`node_modules/`, so fixture repositories are not picked up as test suites.

## Fixtures and smoke tests

`fixtures/readiness/` holds repositories scanned both by `npm test` and by the
CLI smoke runner:

- `good-repo` / `bad-repo` — the contrast pair the fixture smoke
  (`bin/agentready-fixture-smoke.ts`, `npm run agentready:fixtures`) asserts on:
  the good repo scores higher than the bad one and both satisfy the JSON contract.
- `go-repo`, `rust-repo`, `python-repo`, `make-repo` — the ecosystem matrix that
  backs the multi-language command detection.

Other CI smoke runners: `agentready:pack-smoke` (tarball install), `agentready:schemas --check` (JSON Schema drift), and `agentready:action-smoke` (bundled GitHub Action end-to-end).

`npm run agentready:dogfood -- --out <scratch-dir>` clones a small configured
real-repository set into the scratch directory and writes JSON/markdown reports
there. Use it for release dogfood review; do not commit the cloned repositories
or generated reports.

## Evaluation harness (LLM layer)

`bin/agentready-eval.ts` (`npm run agentready:eval`) defines a labeled gold
corpus: each case pairs a fixture repository with the canned model responses a
correct model would return and gold labels (which insight ids should / should
not appear). It runs the real analyzer pipeline over the canned responses and
scores the produced insights, reporting precision/recall/F1, the confusion
matrix, and confidence calibration. It exits non-zero below the floor. The same
harness can score a live model by swapping the provider in a one-off recording
run; day-to-day CI stays offline and deterministic.

## Guidelines

- Prefer black-box tests against the public API (`scanLocalReadiness`,
  `diffLocalReadiness`, `analyzeReport`, `buildProgram`).
- When adding a check, assert its finding `id` so diffs and reporters stay stable.
- When changing a report shape, update the contract validators and the snapshots
  together (run `npm run test:coverage -- -u` to refresh snapshots intentionally).
- The analytics layer must never call a live model in tests: use a fake provider,
  the replay provider, or a corpus case.
- Tests that create git repositories disable commit signing so they work in any
  environment.
