# ADR 0002: Classify Document Roles Instead of Requiring Fixed Document Names

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

Checks should ask whether a non-trivial repository has enough candidate role
evidence for agent operability. They should not require a particular filename
unless a specific policy pack opts into that convention. "Coverage" in this ADR
means deterministic role evidence, not a semantic guarantee that the document is
good or complete.

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
  id: string
  kind: 'document-surface'
  path: string
  paths: string[]
  roleClaims: EvidenceClaim<'document-role'>[]
  title?: string
  headings: string[]
  linkedPaths: string[]
  commandBlocks: { index: number; language?: string; text: string; truncated: boolean }[]
  sources: EvidenceSource[]
}
```

The legacy-looking `roles: DocumentRole[]` projection may be exposed in compact
reporters, but the canonical JSON should use `roleClaims` so confidence and
provenance are per role.

Implement `detectors/document-surfaces.ts`:

1. Start from deterministic candidates:
   - documentation extensions and existing docs detector output
   - root docs and docs-tree files
   - tool instruction surfaces
   - issue/PR templates and workflow docs
2. Parse Markdown/rST/adoc text for headings, title, links, and fenced command
   blocks. Do not use an LLM for this. Apply the ADR 0000 document-size limits
   and truncate stored command blocks to `maxCommandBlockBytes`.
3. Assign roles using weighted deterministic signals:
   - path segments: `docs/architecture`, `adr`, `decisions`, `development`,
     `contributing`, `runbook`, `api`, `ops`, `environment`
   - filenames: conventional names remain high-confidence signals
   - headings: "Architecture", "Design", "Development", "Setup",
     "Testing", "Release", "Environment", "Decision", "Agent"
   - links: entrypoint docs linking to deeper docs gain entrypoint evidence
   - command blocks: setup/test/build docs gain development evidence
   - instruction detector output: agent surfaces gain agent-instruction role
4. Emit all roles as `roleClaims` with confidence and source notes.

Initial confidence rules:

| Signal | Claim |
| --- | --- |
| Root `README.*` with purpose/setup heading or command block | `entrypoint` high |
| Root `README.*` without setup/development signals | `entrypoint` medium |
| `docs/design*`, `docs/architecture*`, or `adr/**` with substantial headings | `architecture` high |
| Any file with only an "Architecture" heading and little content | `architecture` low |
| `DEVELOPMENT.*` or docs page with setup plus test/build/lint commands | `development` high |
| Fenced command blocks alone without surrounding setup text | `development` low |
| Instruction detector evidence | `agent-instruction` high |

Modify checks:

- Replace `docs.developer.thin` internals with role evidence:
  - non-trivial repos use ADR 0000's `nonTrivialSourceFiles` threshold.
  - a role suppresses a missing-role finding only when it has a high-confidence
    claim and non-trivial parsed content.
  - missing role evidence emits the ADR 0000 default info findings unless a
    policy pack strengthens them.
- Keep `docs.readme.missing` only as a root entrypoint convention check for the
  default policy, and consider downgrading it when another high-confidence
  `entrypoint` surface exists.
- Keep `instructions.missing` based on instruction surfaces, but reporters
  should show all `agent-instruction` role documents, not only one filename.

Reporter changes:

- Add a "Documentation roles" section to markdown/console output.
- Show role evidence and the paths that support each role claim.
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
- Assert that high-confidence role evidence suppresses generic "thin docs" findings.
- Assert that a repo with only a root README but no deeper development or
  architecture role still receives a missing-role insight.
- Assert that conventional filenames still classify correctly.
- Add reporter snapshots for role evidence and missing-role recommendations.
