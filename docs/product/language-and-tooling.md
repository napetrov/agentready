# Language And Tooling

## v0.1 Implementation Choice

AgentReady v0.1 should use TypeScript and Node.js.

Reasons:

- natural fit for npm, `npx`, and GitHub Action distribution
- easy parsing of `package.json`, lockfiles, workspaces, and common JS/TS monorepos
- good CLI libraries and filesystem tooling
- fast iteration while the evidence model is still changing
- existing repository already uses Next.js, TypeScript, Jest, and npm

## Risks

The scanner must not become JavaScript-only.

Mitigations:

- keep the evidence model language-agnostic
- make detectors pluggable
- treat JS/TS checks as one detector family, not the whole product
- avoid scoring rules that punish non-JS repositories by default

## Runtime Surfaces

Planned distribution:

- local CLI: `npx agentready scan`
- npm package
- GitHub Action after the local scanner is stable
- hosted web UI later, if useful

Possible future distribution:

- GitHub release binary
- Homebrew
- Docker image

## Current Repo Stack

Current application stack:

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Jest
- OpenAI SDK
- JSZip
- jsPDF
- Vercel-oriented deployment config

## CI Expectations

Public CI should run:

- dependency install with `npm ci`
- TypeScript check
- lint
- Jest tests
- production build
- npm audit as informational or high-severity gate

The scanner itself should later have fixture-based tests for each detector family.
