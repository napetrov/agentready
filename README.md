# AgentReady

AgentReady is an open-source, local-first scanner for AI coding-agent readiness.

The core question is:

> Can an AI coding agent understand this repository, choose the right context, make a bounded change, verify it, and leave humans with a reviewable result?

AgentReady is a command-line tool and library. It scans a repository on disk, observes facts with deterministic detectors, evaluates them against built-in checks, and emits a readiness report and an experimental score. No external service is contacted, and the repository's own scripts are never executed.

It is designed around the major coding agents — Codex, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Roo, and Gemini.

## What It Scans

AgentReady helps teams understand whether a repository exposes the information and capabilities an autonomous coding agent needs:

- agent instruction surfaces such as `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, and tool-specific rule files
- repository shape: source, tests, docs, generated files, and binary/minified assets
- verification command surfaces across ecosystems (Node scripts, Makefiles, Go, Rust, Python)
- agent capability surfaces such as MCP server configs, Claude Code skills, hooks/settings, plugin manifests, and code-intelligence/LSP config
- safety signals in package scripts such as install-time lifecycle hooks, destructive commands, network-piped shells, and deploy/publish paths
- CI workflows and how they map to local checks
- context-efficiency risks such as oversized always-on instruction files or large checked-in files
- documentation entrypoints (README, CONTRIBUTING, architecture/development notes, environment templates)

## Why It Exists

Most repositories were not designed for autonomous agents. Even when CI passes, agents can still struggle because they cannot find local conventions, choose the right commands, avoid generated files, or understand which change is risky.

AgentReady treats repository readiness as agent operability, not generic code quality. It is descriptive before prescriptive: early output shows what is present, what is missing, what overlaps, and what may create friction.

## Architecture

Evidence collection is separated from policy:

- **Detectors** observe facts about the repository (`lib/repo-readiness/detectors/`).
- **Checks** evaluate those facts against rules and emit findings (`lib/repo-readiness/checks/`).
- **Scoring** converts findings into an experimental readiness score (`lib/repo-readiness/core/scoring.ts`).
- **Reporters** render console, JSON, and markdown output (`lib/repo-readiness/reporters/`).
- The **scan engine** wires these together (`lib/repo-readiness/core/scan-engine.ts`).

See [docs/product/architecture.md](docs/product/architecture.md) for the full model.

## Install And Run

Prerequisites: Node.js 18+.

```bash
npm ci
npm run agentready -- scan .
```

Once published you can run it without cloning:

```bash
npx agentready scan .
```

### Scan

```bash
npm run agentready -- scan .            # human summary
npm run agentready -- scan . --json     # machine-readable report
npm run agentready -- scan . --markdown # markdown report
```

### Diff (PR readiness)

`diff` compares two git refs and fails on new regressions. It uses a temporary
`git worktree`, so it never mutates your working tree and works even with
uncommitted changes:

```bash
npm run agentready -- diff --base origin/main --head HEAD . --fail-on-regression
```

### Configuration

Optional scanner config can live in `.agentready.json` or `agentready.config.json`:

```json
{
  "ignorePaths": ["fixtures/**", "public/vendor/**"],
  "largeFileWarningBytes": 1000000,
  "largeFileErrorBytes": 5000000,
  "allowMinifiedFiles": false,
  "errorOnWarnings": false
}
```

Use `--config <path>` to load a config file from another location.

## Documentation

- [Architecture](docs/product/architecture.md)
- [Feature Roadmap](docs/product/features.md)
- [Use Cases](docs/product/use-cases.md)
- [Language And Tooling](docs/product/language-and-tooling.md)
- [Development Guide](dev/DEVELOPMENT.md)

## Development

```bash
npm ci
npm run type-check
npm run lint
npm test
npm run build
```

`npm run build` compiles the CLI and library to `dist/` via `tsconfig.build.json`.

## Status

This repository is pre-1.0. The score is experimental and should be treated as a structured signal, not a compliance certification.

## License

MIT. See [LICENSE](LICENSE).
