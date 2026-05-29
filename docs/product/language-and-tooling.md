# Language And Tooling

## Implementation Choice

AgentReady is implemented in TypeScript on Node.js.

Reasons:

- natural fit for npm, `npx`, and (later) GitHub Action distribution
- easy parsing of `package.json`, lockfiles, workspaces, and common monorepos
- good CLI and filesystem tooling
- fast iteration while the evidence model is still changing

## Keeping It Language-Agnostic

The scanner must not become JavaScript-only. The evidence model and detectors
are language-neutral; JS/TS is one detector family among several.

In practice today:

- the command-surface detector recognizes Node, Make, Go, Rust, and Python
- command-related findings are gated on a recognized command ecosystem, so
  non-JS repositories are not punished for lacking npm scripts
- adding a language means adding a detector, not changing the core

## Runtime Surfaces

Current distribution:

- local CLI: `npm run agentready -- scan .`
- published npm package with a `bin` (`npx agentready scan`) once released

Planned/possible distribution:

- GitHub Action after the local scanner is stable
- GitHub release binary, Homebrew, or Docker image
- hosted report viewer later, if useful

## Current Stack

- TypeScript (strict), Node.js 18+
- ESLint + `@typescript-eslint`
- Jest + ts-jest (offline)
- `tsc` build to `dist/`

No web framework, no runtime dependencies, and no network calls at scan time.

## CI Expectations

Public CI runs:

- dependency install with `npm ci`
- TypeScript check, lint, Jest tests, build
- AgentReady self-scan, fixture smoke, and a PR regression diff
- `npm audit` as an informational check

Each detector family is exercised by fixture-based and unit tests.
