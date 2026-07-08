# Positioning

AgentReady measures **repository operability for coding agents**.

It is not a replacement for CI, lint, tests, Scorecard, CodeQL, dependency
scanners, or human review. Those tools answer whether code is correct, secure,
or policy-compliant. AgentReady asks whether an autonomous or semi-autonomous
coding agent can enter the repository, choose the right context, make a bounded
change, verify it, and leave a human with reviewable evidence.

## The product boundary

AgentReady should focus on signals that directly affect agent work:

- findable instruction surfaces (`AGENTS.md`, tool rules, local conventions)
- command surfaces for build, test, lint, type-check, and format
- CI coverage of those local commands
- repo-shape and context-efficiency risks
- generated, vendored, binary, minified, private, or dangerous paths
- capability surfaces such as MCP, skills, hooks, plugins, and LSP config
- safety signals around install hooks, deploy/publish commands, and shell risk
- stable, machine-readable findings with explainable evidence

AgentReady should avoid becoming a generic code-quality scanner. It can ingest
or link to companion tools later, but the core value is the agent-readiness model
and the deterministic evidence that supports it.

## Why this is different

| Existing tool family | What it proves | AgentReady complement |
| --- | --- | --- |
| CI / tests / lint | The current code passes known checks | Agents can discover and choose the right checks before editing |
| Scorecard / supply-chain scanners | The repo follows security hygiene | The repo exposes safe agent-operability surfaces |
| CodeQL / SAST | Code has or lacks known vulnerability patterns | Agent changes can be scoped and reviewed with clear evidence |
| Documentation | Humans can read project guidance | Agent-facing guidance is findable, bounded, and not contradictory |
| Hosted dashboards | State can be aggregated centrally | Local-first evidence can be produced without sending code away |

## Target users

1. **Maintainers** preparing a repository for coding-agent contributions.
2. **Developer-productivity teams** rolling agents out across many repositories.
3. **Security/review teams** that need stable evidence of agent-facing risk.
4. **Open-source contributors** who want a quick improvement checklist before
   asking an agent to work in an unfamiliar codebase.

## Near-term product promise

AgentReady should produce a practical answer in under a minute:

> Here is what an agent can understand today, what it cannot safely infer, which
> local checks and CI gates are visible, and the smallest changes that would make
> this repository easier to operate in.

That promise is more important than a perfect score. The score is experimental;
the evidence and improvement plan are the product.
