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
npm run agentready -- scan .                              # human summary
npm run agentready -- scan . --format json                # machine-readable report
npm run agentready -- scan . --format markdown            # markdown report
npm run agentready -- scan . --format sarif --output a.sarif # SARIF for code scanning
npm run agentready -- scan . --fail-on warning --min-score 80 # gate the exit code
```

The legacy `--json` / `--markdown` / `--sarif` flags are still accepted. Both
`scan` and `diff` support `--fail-on <off|info|warning|error>` (default `error`)
and `--min-score <0-100>`; the process exits non-zero when a gate trips.

### Diff (PR readiness)

`diff` compares two git refs and fails on new regressions. It uses a temporary
`git worktree`, so it never mutates your working tree and works even with
uncommitted changes:

```bash
npm run agentready -- diff --base origin/main --head HEAD . --fail-on-regression
```

### Explain a finding

`explain` prints the rationale, remediation, and references for a readiness
rule. Pass a finding id from a report or a bare rule id:

```bash
npm run agentready -- explain commands.test.missing
npm run agentready -- explain files.large:assets/blob.bin
npm run agentready -- explain --list            # all documented rule ids
```

### Init

`init` scaffolds a starter `.agentready.json` (and, with `--agents`, a starter
`AGENTS.md`). Existing files are left untouched unless you pass `--force`:

```bash
npm run agentready -- init .            # write .agentready.json
npm run agentready -- init . --agents   # also scaffold AGENTS.md
```

### Analyze (optional LLM augmentation)

`analyze` runs a deterministic scan and then an **optional, opt-in** LLM layer
that judges things deterministic checks cannot — e.g. whether an `AGENTS.md` is
actually actionable, not merely present. It produces an *augmented* report: the
deterministic score is never changed; a separate, clearly-labeled augmented
score and an itemized list of adjustments are reported alongside it.

The layer is off unless a provider is configured via the environment (otherwise
`analyze` runs deterministic-only). One adapter covers hosted OpenAI and local
servers (Ollama, vLLM, LM Studio):

```bash
# Local model (no data leaves your machine):
OLLAMA_HOST=http://localhost:11434 npm run agentready -- analyze .

# Any OpenAI-compatible endpoint:
AGENTREADY_LLM_BASE_URL=https://api.openai.com/v1 \
AGENTREADY_LLM_MODEL=gpt-4o-mini OPENAI_API_KEY=sk-... \
  npm run agentready -- analyze . --format markdown
```

The deterministic `scan`/`diff` commands never call a model and are unaffected.
See [docs/product/llm-analytics-design.md](docs/product/llm-analytics-design.md).

### GitHub Action

Gate pull requests on readiness with the bundled action. It writes a job
summary, sets outputs, and can emit SARIF for code scanning:

```yaml
permissions:
  contents: read
  security-events: write

steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0
  - uses: actions/setup-node@v4
    with:
      node-version: 20
  - id: agentready
    uses: napetrov/agentready@main
    with:
      mode: diff
      base-ref: origin/${{ github.base_ref || 'main' }}
      head-ref: HEAD
      fail-on-regression: true
      min-score: 80
      upload-sarif: true
  - if: always() && steps.agentready.outputs.sarif-report-path
    uses: github/codeql-action/upload-sarif@v3
    with:
      sarif_file: ${{ steps.agentready.outputs.sarif-report-path }}
```

Inputs include `path`, `mode`, `base-ref`, `head-ref`, `config`,
`fail-on-severity`, `fail-on-regression`, `min-score`, `job-summary`,
`upload-sarif`, `output-dir`, and `tool-version`; outputs include `score`,
`findings-count`, `regressions-count`, and the report paths. See
[`action.yml`](action.yml) for the authoritative contract.

### Configuration

Optional scanner config is discovered (via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig),
restricted to **data-only** formats) from any of: `package.json#agentready`,
`.agentready.json`, `agentready.config.json`, `.agentreadyrc[.json|.yaml|.yml]`,
or `agentready.config.yaml`/`.yml`. Discovery is rooted at the scanned directory
and never walks up into parent directories. Executable config (`.js`/`.ts`/...)
is deliberately **not** loaded — AgentReady never executes repository code — so
JS/TS config files are refused rather than run.

```json
{
  "ignorePaths": ["fixtures/**", "public/vendor/**"],
  "largeFileWarningBytes": 1000000,
  "largeFileErrorBytes": 5000000,
  "allowMinifiedFiles": false,
  "errorOnWarnings": false
}
```

Use `--config <path>` to load a config file from another location (JSON or YAML). Validate a
config and print the normalized effective settings with:

```bash
npm run agentready -- validate-config .
```

The config and report shapes are published as JSON Schema under `schemas/`
(also available via the package's `./schemas/*` export), generated from the
same schemas the scanner validates against.

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
