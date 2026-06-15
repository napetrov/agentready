# ADR 0002: Classify Document Roles Instead Of Requiring Fixed Document Names

## Status

Proposed

## Context

AgentReady should not make a specific filename such as `ARCHITECTURE.md`,
`CONTRIBUTING.md`, or `AGENTS.md` a universal requirement when another document
solves the same job. Repository conventions vary:

- Architecture can live in `docs/design.md`, `docs/decisions/`, `adr/`,
  `DEVELOPMENT.md`, package docs, or generated API docs.
- Contribution flow can live in `CONTRIBUTING.md`, `DEVELOPMENT.md`, a docs
  tree, issue templates, or organization-wide docs.
- Agent instructions can be tool-specific, root-level, package-level, or split
  across multiple agent surfaces.

The scanner should still be useful when conventional filenames exist, but the
general expectation must be role-based: does the repo expose the information an
agent needs, not does it use one blessed file name?

## Decision

Replace filename-driven documentation expectations with deterministic document
role classification. Filename conventions remain strong signals, but checks
should evaluate whether required roles are covered by any recognized surface.

Document roles should describe the problem a document solves:

- `entrypoint`: purpose, setup, common workflows, links to deeper docs.
- `development`: local setup, build/test/lint/type-check flow, tooling.
- `architecture`: module boundaries, data flow, extension points, constraints.
- `decision-record`: durable decisions and tradeoffs.
- `contribution`: code review, branching, issue/PR process.
- `environment`: required env vars, secrets shape, local services.
- `agent-instruction`: agent-specific rules, validation commands, safe paths.
- `operation`: deploy, release, incident, maintenance, runbook.
- `api`: public API, CLI, protocol, package contract.

Checks should ask whether a non-trivial repository has enough role coverage for
agent operability. They should not require a particular filename unless a
specific policy pack opts into that convention.

## Detailed Implementation

Add `DocumentSurfaceEvidence`:

```ts
export type DocumentRole =
  | 'entrypoint'
  | 'development'
  | 'architecture'
  | 'decision-record'
  | 'contribution'
  | 'environment'
  | 'agent-instruction'
  | 'operation'
  | 'api'

export interface DocumentSurfaceEvidence {
  path: string
  roles: DocumentRole[]
  title?: string
  headings: string[]
  linkedPaths: string[]
  commandBlocks: string[]
  confidence: EvidenceConfidence
  sources: EvidenceSource[]
}
```

Implement `detectors/document-surfaces.ts`:

1. Start from deterministic candidates:
   - documentation extensions and existing docs detector output
   - root docs and docs-tree files
   - tool instruction surfaces
   - issue/PR templates and workflow docs
2. Parse Markdown/rST/adoc text for headings, title, links, and fenced command
   blocks. Do not use an LLM for this.
3. Assign roles using weighted deterministic signals:
   - path segments: `docs/architecture`, `adr`, `decisions`, `development`,
     `contributing`, `runbook`, `api`, `ops`, `environment`
   - filenames: conventional names remain high-confidence signals
   - headings: "Architecture", "Design", "Development", "Setup",
     "Testing", "Release", "Environment", "Decision", "Agent"
   - links: entrypoint docs linking to deeper docs gain entrypoint evidence
   - command blocks: setup/test/build docs gain development evidence
   - instruction detector output: agent surfaces gain agent-instruction role
4. Emit all roles with confidence and source notes.

Modify checks:

- Replace `docs.developer.thin` internals with role coverage:
  - non-trivial repos should have at least one `entrypoint` role and one of
    `development`, `architecture`, or `decision-record`.
  - missing role coverage should normally be `info`, unless a policy pack
    strengthens it.
- Keep `docs.readme.missing` only as a root entrypoint convention check for the
  default policy, and consider downgrading it when another high-confidence
  `entrypoint` surface exists.
- Keep `instructions.missing` based on instruction surfaces, but reporters
  should show all `agent-instruction` role documents, not only one filename.

Reporter changes:

- Add a "Documentation roles" section to markdown/console output.
- Show role coverage and the paths that satisfy each role.
- For missing-role findings, recommend the missing information, not a fixed
  file name. Example: "Add or link developer-facing docs that explain module
  boundaries and validation commands" instead of "Add ARCHITECTURE.md".

Config/policy packs:

- Add optional config for organization-specific conventions:

```jsonc
{
  "documents": {
    "preferredRolePaths": {
      "architecture": ["docs/architecture.md", "docs/adr/**"],
      "development": ["DEVELOPMENT.md", "docs/dev/**"]
    }
  }
}
```

Default checks should treat these as preference signals, not universal
requirements.

## Consequences

The scanner becomes more accurate across real repositories and avoids false
negatives when good docs use different names. Findings become more actionable
because they describe missing knowledge rather than missing filenames.

The tradeoff is that document role classification is heuristic. That is
acceptable if every role has confidence/provenance and hard gates remain
conservative.

## Verification

- Add fixtures where architecture lives in `docs/design.md`, `adr/`,
  `DEVELOPMENT.md`, and package-level docs.
- Assert that role coverage suppresses generic "thin docs" findings.
- Assert that a repo with only a root README but no deeper development or
  architecture role still receives a role-coverage insight.
- Assert that conventional filenames still classify correctly.
- Add reporter snapshots for role coverage and missing-role recommendations.
