# AgentReady

AgentReady is an open-source, local-first scanner for AI coding-agent readiness. It answers a different question than lint, CI, Scorecard, or secret scanners: not “is this code good?”, but “can a coding agent operate in this repository safely and leave reviewable evidence?”

The core question is:

> Can an AI coding agent understand this repository, choose the right context, make a bounded change, verify it, and leave humans with a reviewable result?

AgentReady is a command-line tool and library. It scans a repository on disk, observes facts with deterministic detectors, evaluates them against built-in checks, and emits a readiness report and an experimental score. No external service is contacted, and the repository's own scripts are never executed.

It is designed around the major coding agents — Codex, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Roo, and Gemini.

See example output before installing: [high-readiness report](examples/reports/high-readiness.md) and [improvement-plan report](examples/reports/improvement-plan.md).

## What It Scans

AgentReady helps teams understand whether a repository exposes the information and capabilities an autonomous coding agent needs:

- agent instruction surfaces such as `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, and tool-specific rule files
- repository shape: source, tests, docs, generated files, and binary/minified assets
- verification command surfaces across ecosystems (Node scripts, Makefiles, CMake, Bazel, Go, Rust, Python, Gradle, Maven, .NET)
- agent capability surfaces such as MCP server configs, Claude Code skills, hooks/settings, plugin manifests, and code-intelligence/LSP config
- safety signals in package scripts such as install-time lifecycle hooks, destructive commands, network-piped shells, and deploy/publish paths
- CI workflows and how they map to local checks
- context-efficiency risks such as oversized always-on instruction files or large checked-in files
- documentation entrypoints (README, CONTRIBUTING, architecture/development notes, environment templates)

## Why It Exists

Most repositories were not designed for autonomous agents. Even when CI passes, agents can still struggle because they cannot find local conventions, choose the right commands, avoid generated files, or understand which change is risky.

AgentReady treats repository readiness as agent operability, not generic code quality. It is descriptive before prescriptive: early output shows what is present, what is missing, what overlaps, and what may create friction.

AgentReady complements, rather than replaces, existing checks:

- **CI/lint/test** prove the current change still works; AgentReady checks whether an agent can discover the right checks before editing.
- **Scorecard/security scanners** look for supply-chain and vulnerability signals; AgentReady looks for agent-facing context, command, capability, and review surfaces.
- **Repo docs** help humans; AgentReady verifies whether that guidance is findable, scoped, and machine-reportable.

The intended output is a prioritized improvement plan for agent onboarding, plus stable evidence that CI and enterprise tools can consume.

## Architecture

Evidence collection is separated from policy:

- **Detectors** observe facts about the repository (`lib/repo-readiness/detectors/`).
- **Checks** evaluate those facts against rules and emit findings (`lib/repo-readiness/checks/`).
- **Scoring** converts findings into an experimental readiness score (`lib/repo-readiness/core/scoring.ts`).
- **Reporters** render console, JSON, and markdown output (`lib/repo-readiness/reporters/`).
- The **scan engine** wires these together (`lib/repo-readiness/core/scan-engine.ts`).

See [docs/product/architecture.md](docs/product/architecture.md) for the full model, [docs/product/positioning.md](docs/product/positioning.md) for the product boundary, and [docs/roadmap/v0.3-issue-drafts.md](docs/roadmap/v0.3-issue-drafts.md) for the next milestone issue drafts.

## Install And Run

Prerequisites: Node.js 24+ for the current development branch.

```bash
git clone https://github.com/napetrov/agentready.git
cd agentready
npm ci
npm run agentready -- scan .
```

The package name is reserved in this repository as the scoped
`@napetrov/agentready`, and the installed command name remains `agentready`. The
package is **not published yet**; until the first npm release, use the local
development command above or the first-party GitHub Action from this repository.

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

#### Use your agent's own model (MCP / library)

If AgentReady runs inside an agent (Claude Code, Cursor, …) you can reuse the
host's model instead of configuring a provider — AgentReady holds no
credentials. The bundled MCP server exposes the host-delegated flow over stdio:

```bash
npm run agentready:mcp   # JSON-RPC 2.0 over stdio
```

It offers three tools: `agentready_scan` (deterministic, no model),
`agentready_analyze_prepare` (returns prompts + sliced evidence for the host
model to answer), and `agentready_analyze_finalize` (folds the host's answers
into an augmented report). Library consumers can instead inject their own client
via `analyzeWithProvider(...)` from the `agentready/analyze` export.

### GitHub Action

Gate pull requests on readiness with the bundled action. It writes a job
summary, can post a sticky pull-request comment, sets outputs, and can emit
SARIF for code scanning:

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
      node-version: 24
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
`pr-comment`, `pr-comment-condition`, `github-token`, `upload-sarif`, `output-dir`, `tool-version`,
`analyze`, and `analyze-min-score`; outputs include `score`, `findings-count`,
`regressions-count`, the report paths, and (when `analyze` is on)
`augmented-score`/`augmented-report-path`. See [`action.yml`](action.yml) for
the authoritative contract.

#### Pull-request comment

Set `pr-comment: true` to post the markdown report as a pull-request comment.
The action keeps a single sticky comment and updates it in place on each run
rather than stacking new ones. It needs `pull-requests: write` and uses the
workflow `github-token` by default:

```yaml
permissions:
  contents: read
  pull-requests: write

steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0
  - uses: napetrov/agentready@main
    with:
      mode: diff
      base-ref: origin/${{ github.base_ref || 'main' }}
      head-ref: HEAD
      pr-comment: true
```

By default (`pr-comment-condition: on-findings`) the comment is posted only when
a run has new findings or regressions, so clean runs leave the PR thread quiet —
the verdict still lands in the job summary. Once findings are resolved, an
existing comment is updated to its cleared state rather than left showing stale
findings. Set `pr-comment-condition: always` to comment on every run, including
clean ones.

It is fail-open: on a missing permission or a non-`pull_request` run it logs a
notice and continues without failing the job. Omit `pr-comment` (and the
`pull-requests: write` permission) if the job summary is enough.

> **Fork pull requests:** for PRs from forks, GitHub gives the default
> `github.token` read-only access, so the comment can't be posted — the step
> logs a warning and the job still passes. The job summary still works in that
> case; use it (or a `pull_request_target` workflow, with the usual care around
> untrusted code) if you need comments on fork PRs.

#### Optional LLM augmentation in CI (GitHub Models)

Set `analyze: true` to also run the LLM layer. The CI-native token source is
**GitHub Models** — the workflow's built-in `GITHUB_TOKEN` with `models: read`,
no secret to manage. It is opt-in: AgentReady only uses it when
`AGENTREADY_USE_GITHUB_MODELS=1` is set, so the ambient token never silently
enables model calls.

```yaml
permissions:
  contents: read
  models: read            # required for GitHub Models
steps:
  - uses: actions/checkout@v4
  - uses: napetrov/agentready@main
    with:
      analyze: true
      analyze-min-score: 70   # optional: gate on the augmented score
    env:
      AGENTREADY_USE_GITHUB_MODELS: '1'
      GITHUB_TOKEN: ${{ github.token }}
```

The deterministic gates run first and are unaffected; augmented-score gating is
opt-in via `analyze-min-score`. Without a provider, `analyze` runs
deterministic-only.

### Policy direction

Policy packs are planned for v0.3 so the core scanner can stay broad and descriptive while teams tune severity for OSS, enterprise rollout, or scientific/ML repositories. See [docs/product/policy-packs.md](docs/product/policy-packs.md).

### Evaluation / benchmarks

AgentReady should earn trust by comparing readiness findings against real agent friction. The initial benchmark plan is in [docs/product/evaluation.md](docs/product/evaluation.md).

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

`ignorePaths` adds AgentReady-specific exclusions on top of the repository's own
`.gitignore` files, which the scanner already honours (root and nested, with git's
hierarchy semantics). Common output directories (`node_modules`, `dist`, `build`,
`out`, `coverage`, `.git`, `.next`, `.turbo`, `.vercel`) are always skipped.

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
