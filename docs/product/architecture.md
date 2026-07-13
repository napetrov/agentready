# AgentReady Architecture

AgentReady is a repository readiness scanner for AI coding agents. It evaluates whether a repo gives agents enough context, safe commands, and reviewable evidence to make useful changes.

## Positioning

AgentReady is adjacent to the agentic-web readiness ecosystem, but the target surface is different.

- Agentic-web readiness focuses on product, website, API, commerce, and action surfaces.
- AgentReady focuses on code repository readiness for AI coding agents.

The product should borrow the standard shape: stable rule IDs, baseline versus conditional applicability, `must`/`should`/`may` strength, and machine-readable output.

It should not copy web-specific checks such as `robots.txt`, sitemap, JSON-LD, or commerce protocols unless the scanned repository itself implements those surfaces.

## Core Question

Can an AI coding agent:

- understand the repository shape
- find the relevant local context
- choose bounded files to edit
- avoid generated, vendored, private, or dangerous paths
- infer safe verification commands
- understand expected review risk
- leave a human with clear evidence and a reviewable result

## System Model

The target model is below; `[x]` marks what is implemented today and `[ ]`
marks what is still planned. The implemented modules live under
`lib/repo-readiness/` and `bin/`.

```text
agentready
  core/
    [x] scan-engine        (scan + diff orchestration)
    [x] evidence-model     (typed report/evidence shapes)
    [x] finding-model      (findings with stable ids)
    [x] scoring-model      (experimental severity-based score, plus a per-category dimension rollup)
    [x] config-loading
    [x] git worktree helper (safe ref scanning for diff)
    [x] policy-engine      (PolicyPack/PolicyResult model, gate integration; see checks/policy-packs)
    [x] portfolio-scan     (multi-repo batch scan + aggregated summary, local only; see cli batch)
  detectors/
    [x] instruction-files
    [x] repo-shape / file-inventory
    [x] package-managers
    [x] ci-workflows
    [x] command-surfaces   (Node, Make, CMake, Bazel, Go, Rust, Python)
    [x] command-references (stale npm/yarn/pnpm/bun script, Makefile target, and package-manager mentions in docs/instructions)
    [x] docs
    [x] capability-surfaces (MCP, skills, hooks, plugins, LSP; each classified by blast-radius risk tier)
    [x] safety-signals     (dangerous package scripts, deploy/publish)
    [x] governance         (CODEOWNERS / PR-template presence; not git-history-based ownership inference)
    [ ] risk-signals
  checks/
    [x] built-in-rules
    [ ] configurable-rule-runner
    [x] policy-packs       (default no-op + enterprise; oss/ml-scientific remain candidates)
  reporters/
    [x] console
    [x] json
    [x] markdown
    [ ] sarif
  cli/
    [x] commands (scan, diff, batch)
    [x] config-loading
```

## Main Concepts

**Detector**

Observes facts without judgment. Examples: found `AGENTS.md`, found `pnpm-lock.yaml`, found `.github/workflows/ci.yml`, found `npm test`.

**Evidence**

Structured raw observations emitted by detectors. Evidence should be reusable across checks and reporters.

**Check**

Evaluates evidence against a rule and produces a finding. Example: "repository has no recognized agent instruction entrypoint."

**Policy Pack**

An opinionated set of checks for a use case, team, language, framework, or organization. The core scanner should remain broad and conservative.

**Reporter**

Renders evidence and findings for humans or automation: console, JSON, markdown, and later SARIF.

## Candidate Evidence Model

```ts
type RepoEvidence = {
  instructionFiles: InstructionFileEvidence[];
  packageManagers: PackageManagerEvidence[];
  commands: CommandEvidence[];
  ciWorkflows: WorkflowEvidence[];
  capabilitySurfaces: CapabilitySurfaceEvidence[];
  repoShape: RepoShapeEvidence;
  codeMetrics?: CodeMetricEvidence[];
  gitSignals?: GitSignalEvidence[];
};
```

## Candidate Finding Model

```ts
type Finding = {
  id: string;
  title: string;
  severity: "error" | "warning" | "info";
  category: string;
  path?: string;
  line?: number;
  evidence?: unknown;
  recommendation?: string;
  confidence: "low" | "medium" | "high";
  policy?: string;
};
```

## v0.1 Scope (implemented)

Local repository scanning, available today:

- detect instruction/config files across major coding-agent tools
- detect repo shape, file classification, and package/workspace roots
- detect package managers and command surfaces across Node, Make, Go, Rust, and Python
- detect CI workflows and summarize available checks
- detect large files and large always-on instruction files as context-friction signals
- detect generated, binary, and minified files
- detect agent capability surfaces (MCP configs, skills, hooks, plugins, and code-intelligence/LSP config)
- heuristic detection of dangerous package scripts (install hooks, destructive commands, network-piped shells, deploy/publish)
- emit console, JSON, and markdown reports
- produce an experimental score, plus a per-category (`docs`/`commands`/`ci`/`instructions`/`files`/`safety`) dimension-score rollup so a repo with e.g. unsafe scripts but strong CI doesn't average out to look the same as the opposite profile
- `diff` two git refs (via worktrees) and gate on regressions

The v0.1 family is complete; v0.2 (automation and policy) is the next milestone.

## Deferred

These should not be default requirements yet:

- mandatory `AGENTS.md`
- required sections inside instruction files
- framework-specific policy such as Prisma or TypeScript-only rules
- prompt cassette or eval rules
- SARIF
- executing arbitrary repository commands by default

## Design Principle

AgentReady should be descriptive before prescriptive. Early output should show what is present, what is missing, what overlaps, and what may create friction. Hard policy gates can come later through explicit policy packs.
