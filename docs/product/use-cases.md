# Use Cases

## Maintainer Preflight

A maintainer runs AgentReady before inviting coding agents into a repository.

They want to know:

- which instruction files exist
- whether setup and verification commands are discoverable
- whether generated files and dangerous scripts are obvious
- whether a human reviewer can understand agent risk

Expected output: console summary and JSON evidence.

## Pull Request Gate

A team runs AgentReady in CI to prevent repository-readiness regressions.

Examples:

- a new package has no local verification command
- a newly added instruction file is too broad or too large
- a deploy script is added without being classified as dangerous
- generated files are committed without ignore or deny guidance

Expected output: markdown PR comment and optional status check.

## Agent Onboarding

An engineer wants to make a repo easier for Codex, Claude Code, Cursor, GitHub Copilot, or another coding agent.

AgentReady should show:

- missing root entrypoint docs
- local context gaps in major packages
- stale command references
- overlapping or contradictory rule files
- quick wins for context efficiency

Expected output: prioritized recommendations, not a hard compliance report.

## Enterprise Rollout

A developer productivity team wants a standard way to assess many repositories before broad agent adoption.

AgentReady should support:

- machine-readable reports
- stable rule IDs
- configurable policy packs
- consistent severity model
- repeatable scoring
- governance checks for secrets, permissions, and approved capability surfaces

Expected output: JSON for ingestion plus markdown summaries for repo owners.

## Public Repository Signal

An open-source maintainer wants to show that a project is easy for agents to work on.

AgentReady should eventually support:

- public report URL
- badge
- trend history
- recommendations that contributors can act on

Expected output: public scorecard and generated improvement checklist.

## Benchmarking

The project team wants to validate whether AgentReady scores predict real agent performance.

Benchmark flow:

1. choose repos with different readiness profiles
2. run AgentReady and save evidence
3. give the same bounded tasks to multiple coding agents
4. measure time, token usage, tool calls, changed files, test success, reviewer intervention, and completion
5. compare score dimensions against real friction
