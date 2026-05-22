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

```text
agentready
  core/
    scan-engine
    repo-discovery
    evidence-model
    finding-model
    scoring-model
    policy-engine
  detectors/
    instruction-files
    repo-shape
    package-managers
    ci-workflows
    command-surfaces
    capability-surfaces
    generated-files
    ownership
    risk-signals
  checks/
    configurable-rule-runner
    built-in-rules
    policy-packs
  reporters/
    console
    json
    markdown
    sarif-later
  cli/
    commands
    config-loading
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

## v0.1 Scope

The first implementation should prioritize local repository scanning:

- detect instruction/config files across major coding-agent tools
- detect repo shape and package/workspace roots
- detect package managers and command surfaces
- detect CI workflows and summarize available checks
- detect obvious capability surfaces such as MCP configs, skills, hooks, plugins, and code-intelligence/LSP config
- detect large files and large always-on instruction files as context-friction signals
- detect generated files and common ignore patterns
- detect dangerous package scripts heuristically
- emit console and JSON reports
- produce an experimental score

## Deferred

These should not be default v0.1 requirements:

- mandatory `AGENTS.md`
- required sections inside instruction files
- framework-specific policy such as Prisma, Vercel, or TypeScript-only rules
- prompt cassette or eval rules
- SARIF
- GitHub Action as the first implementation surface
- executing arbitrary repository commands by default

## Design Principle

AgentReady should be descriptive before prescriptive. Early output should show what is present, what is missing, what overlaps, and what may create friction. Hard policy gates can come later through explicit policy packs.
