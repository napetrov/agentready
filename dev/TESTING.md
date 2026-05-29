# Testing Guide

Tests run fully offline with Jest + ts-jest. There are no external services,
API keys, or network calls.

## Commands

```bash
npm test                 # run all tests
npm run test:watch       # watch mode
npm run test:coverage    # coverage report (thresholds enforced in jest.config.js)
```

## Layout

- `__tests__/local-readiness.test.ts` — end-to-end scan/diff behavior, config
  loading, finding generation, contract validation, and markdown output, using
  temporary repositories created on disk.
- `__tests__/instruction-surface-detector.test.ts` — instruction-surface
  detection across agent ecosystems.

Jest is scoped to `<rootDir>/__tests__` and ignores `fixtures/`, `dist/`, and
`node_modules/`, so fixture repositories are not picked up as test suites.

## Fixtures and Smoke Test

`fixtures/readiness/good-repo` and `fixtures/readiness/bad-repo` are scanned by
`bin/agentready-fixture-smoke.ts` (run via `npm run agentready:fixtures`). The
smoke runner asserts that the good repo scores higher than the bad repo and that
both reports satisfy the JSON contract.

## Guidelines

- Prefer black-box tests against `scanLocalReadiness` / `diffLocalReadiness`.
- When adding a check, assert its finding `id` so diffs and reporters stay stable.
- When changing a report shape, update the contract validators and their tests together.
- Tests that create git repositories disable commit signing so they work in any environment.
