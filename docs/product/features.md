# Feature Roadmap

## v0.1: Repository Readiness Scanner — delivered

Goal: produce useful local evidence without requiring a hosted service.

Delivered:

- local CLI entrypoint `agentready scan` (default scan of the current directory)
- instruction-file detector for common agent tools
- repo-shape / file-inventory detector for source, tests, docs, generated, binary, and minified paths
- package-manager detector and a multi-ecosystem command-surface detector (Node, Make, Go, Rust, Python)
- CI workflow detector for GitHub Actions
- context-friction detection for large files and oversized always-on instruction files
- detection of local/private instruction files
- console, JSON, and markdown reporters
- experimental readiness score
- `agentready diff` between git refs with a regression gate (worktree-based, never mutates the working tree)
- npm package with a `bin` and a `dist` build for `npx` usage
- capability-surface detector for MCP configs, skills, hooks, plugins, and code-intelligence/LSP config
- safety detector for dangerous package scripts and deploy/publish paths

The v0.1 family is now complete.

## v0.2: Automation And Policy

Goal: make the scanner useful in pull requests and team standards.

Features:

- GitHub Action
- markdown PR report
- config file
- built-in policy packs
- stale path and command validation
- instruction-file overlap and contradiction checks
- repository-specific thresholds

## v0.3: Deeper Analysis

Goal: connect findings to real agent friction.

Features:

- SARIF output
- import graph and boundary checks
- git churn and risk signals
- language/framework policy packs
- CODEOWNERS and PR-template analysis
- benchmark harness for comparing score dimensions against real agent performance

## Later

Possible later features:

- hosted report viewer
- organization-wide scan dashboard
- public badge
- trend tracking
- generated starter instruction files
- policy marketplace
- integrations with issue trackers and developer portals

## Non-Goals For The Core

The core scanner should not assume:

- every repo is TypeScript
- every repo uses pnpm
- every repo deploys to Vercel
- one instruction file is universally canonical
- test coverage alone predicts agent success
- executing repository commands is always safe
