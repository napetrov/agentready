# AgentReady

AgentReady is an open-source scanner for AI coding-agent readiness.

The core question is:

> Can an AI coding agent understand this repository, choose the right context, make a bounded change, verify it, and leave humans with a reviewable result?

AgentReady is currently a Next.js application with repository and website analysis capabilities. The next product direction is a local-first repository readiness scanner and scorecard for coding agents such as Codex, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Roo, and Gemini.

## What It Scans

AgentReady should help teams understand whether a repository exposes the information and capabilities an autonomous coding agent needs:

- agent instruction surfaces such as `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, and tool-specific rule files
- repository shape, packages, services, docs, generated files, and ownership signals
- safe install, build, lint, typecheck, test, and targeted verification commands
- CI workflows and how they map to local checks
- context-efficiency risks such as huge always-on instruction files or oversized source files
- safety boundaries such as secrets hygiene, dangerous scripts, deploy/publish paths, and ignore/deny rules
- capability surfaces such as MCP servers, skills, hooks, plugins, and LSP/code-intelligence configuration

## Why It Exists

Most repositories were not designed for autonomous agents. Even when CI passes, agents can still struggle because they cannot find local conventions, choose the right commands, avoid generated files, or understand which change is risky.

AgentReady treats repository readiness as agent operability, not generic code quality.

## Current App

The current implementation provides:

- GitHub repository URL analysis
- static repository checks
- AI-assisted assessment
- score breakdowns and findings
- JSON and PDF report generation
- a Next.js web UI

## Product Direction

The target architecture separates evidence collection from policy:

- **Detectors** observe facts about the repository.
- **Checks** evaluate those facts against rules.
- **Policy packs** define opinionated requirements for teams, languages, or frameworks.
- **Reporters** render console, JSON, markdown, and later SARIF output.
- **Scoring** converts evidence and findings into an experimental readiness score.

The initial scanner should be descriptive before prescriptive. It should show the instruction/capability landscape, identify obvious gaps and friction, and avoid pretending that one file or one framework is universally correct.

## Documentation

- [Architecture](docs/product/architecture.md)
- [Feature Roadmap](docs/product/features.md)
- [Use Cases](docs/product/use-cases.md)
- [Language And Tooling](docs/product/language-and-tooling.md)
- [Development Guide](dev/DEVELOPMENT.md)
- [Current Technical Architecture](dev/ARCHITECTURE.md)

## Development

Prerequisites:

- Node.js 18+
- npm
- optional `OPENAI_API_KEY` for real AI assessment calls

Install and run:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Run verification:

```bash
npm run type-check
npm run lint
npm test
npm run build
```

Run a local readiness scan:

```bash
npm run agentready -- scan .
npm run agentready -- diff --base origin/main --head HEAD . --fail-on-regression
```

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

## API

### `POST /api/analyze`

Analyze a public GitHub repository or website URL.

```json
{
  "repoUrl": "https://github.com/owner/repository"
}
```

### `POST /api/report`

Generate a PDF report from assessment results.

## Status

This repository is pre-1.0. The score is experimental and should be treated as a structured signal, not a compliance certification.

## License

MIT. See [LICENSE](LICENSE).
