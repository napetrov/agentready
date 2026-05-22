# Feature Roadmap

## v0.1: Repository Readiness Scanner

Goal: produce useful local evidence without requiring a hosted service.

Features:

- local CLI entrypoint, likely `agentready scan`
- default scan of the current directory
- instruction-file detector for common agent tools
- repo-shape detector for packages, apps, services, docs, tests, and generated paths
- package-manager and task-runner detector
- command-surface detector for install, lint, typecheck, test, build, format, and targeted checks
- CI workflow detector for GitHub Actions
- capability-surface detector for MCP configs, skills, hooks, plugins, and code-intelligence/LSP config
- context-friction detector for large files and oversized always-on instruction files
- safety detector for dangerous scripts, deploy/publish paths, local/private instruction files, and missing ignore rules
- console and JSON reporters
- experimental readiness score

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
