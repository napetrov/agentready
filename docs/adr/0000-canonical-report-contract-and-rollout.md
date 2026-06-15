# ADR 0000: Canonical Report Contract and Rollout

## Status

Proposed

## Context

The ADR set introduces repository evidence, document roles, topology signals,
and design-state reporting. Those concepts must compose into one report
contract before implementation starts. Without a canonical shape, implementers
could add parallel top-level objects, duplicate root lists, or create insights
that cannot point back to stable evidence.

AgentReady already exposes machine-readable JSON and compact diff reports, so
even additive fields need explicit versioning, rollout, and compatibility
rules.

## Decision

Use one additive report spine:

```ts
export interface LocalReadinessReport {
  // Existing fields remain during the migration.
  summary: ExistingSummary
  docs: ExistingDocsEvidence
  commands: CommandEvidence
  ci: CiEvidence
  instructions: InstructionSurfaceEvidence[]
  capabilities: CapabilitySurfaceEvidence[]
  safetySignals: SafetySignalEvidence[]
  findings: ReadinessFinding[]
  files: LocalReadinessFile[]

  // New fields, optional during the first implementation phase.
  repositoryEvidence?: RepositoryEvidence
  designState?: DesignStateSummary
  reportContract?: {
    schemaVersion: 'local-readiness/v2'
    experimentalFields: string[]
  }
}
```

`repositoryEvidence` is the canonical home for deterministic architecture facts.
Topology is nested inside it, not a parallel top-level object. The referenced
evidence interfaces are defined in ADR 0001, ADR 0002, and ADR 0003.
`designState` is derived from `repositoryEvidence`, existing findings, and
existing scan evidence. It does not own raw facts.

```ts
export interface RepositoryEvidence {
  roots: RepositoryRootEvidence[]
  boundaries: ArchitectureBoundaryEvidence[]
  documentSurfaces: DocumentSurfaceEvidence[]
  verificationSurfaces: VerificationSurfaceEvidence[]
  topology: RepositoryTopologyEvidence
}

export interface RepositoryTopologyEvidence {
  dependencyHints: DependencyHintEvidence[]
  testProximityHints: TestProximityHintEvidence[]
  documentationProximityHints: DocumentationProximityHintEvidence[]
  generatedPressure: GeneratedPressureEvidence[]
  metrics: RepositoryTopologyMetrics
}
```

Every evidence object that an insight can reference must implement:

```ts
export interface EvidenceItemBase {
  id: string
  kind: string
  paths: string[]
  sources: EvidenceSource[]
}

export interface EvidenceClaim<TKind extends string = string> {
  kind: TKind
  value: string
  confidence: EvidenceConfidence
  signals: string[]
  sources: EvidenceSource[]
}
```

Use object-level evidence for stable identity and claim-level evidence for
heuristics. Example: one document can be a high-confidence `entrypoint` and a
low-confidence `architecture` candidate at the same time.

Stable IDs are deterministic and versioned by kind, not by detector order:

```text
<kind>:<normalized-path-or-root>:<claim-kind-or-role>
```

Examples:

- `document-surface:README.md`
- `document-role:README.md:entrypoint`
- `root:packages/cli`
- `verification-surface:package.json:scripts.test`
- `design-state:documentation-proximity:packages/cli`

When a path is unavailable, use a sorted content-derived key from deterministic
manifest coordinates, such as `workflow:.github/workflows/ci.yml:job.test`.

## Rollout Plan

1. **Schema-only additive phase**
   - Add optional `repositoryEvidence`, `designState`, and `reportContract`.
   - Keep all current fields and current score behavior.
   - Add JSON Schema and contract tests.
   - Compact reports may omit raw `files` and raw evidence arrays, but must keep
     findings, summary, and design-state summaries when present.

2. **Dual-population phase**
   - Populate new evidence while still producing legacy `docs`, `commands`,
     `ci`, and `instructions`.
   - Add tests proving legacy projections and new evidence agree where they
     represent the same fact.

3. **Reporter-advisory phase**
   - Show repository topology, document roles, and design-state sections as
     advisory output.
   - Do not change gates or score.

4. **Check-migration phase**
   - Migrate selected checks to consume `repositoryEvidence`.
   - Keep default severities conservative.
   - Emit normal `ReadinessFinding` entries for anything that can affect gates.

5. **Policy-pack phase**
   - Let explicit policy packs strengthen severities or require organization
     conventions.
   - Default policy remains broad, descriptive, and filename-flexible.

## Default Thresholds

Initial thresholds should be config-backed and conservative:

```ts
export interface DesignStateThresholds {
  nonTrivialSourceFiles: 20
  manySourceFiles: 50
  largeRootSourceFiles: 100
  generatedHeavyFileRatio: 0.30
  generatedHeavyBytesRatio: 0.50
  maxDocumentBytesParsed: 128_000
  maxHeadingsPerDocument: 80
  maxLinksPerDocument: 200
  maxCommandBlocksPerDocument: 40
  maxCommandBlockBytes: 4_000
}
```

These values are defaults, not universal standards. Repositories can tune them
through config or policy packs.

## Default New Finding Severities

| Finding id | Severity | Gateable by default |
| --- | --- | --- |
| `docs.roles.missing-entrypoint` | info | no |
| `docs.roles.missing-design-context` | info | no |
| `topology.root.unclear` | info | no |
| `topology.root.tests-unmapped` | info | no |
| `topology.root.docs-unmapped` | info | no |
| `topology.generated.high-pressure` | info | no |
| `topology.verification.unmapped` | info | no |

Policy packs may raise selected items to warning/error. The default scanner
should not make advisory architecture signals fail CI.

## Never-Execute Rule

All new detectors are static readers only. They may parse files, manifests,
workflow YAML, and command text. They must not:

- invoke package managers, compilers, test runners, language servers, or build
  tools
- run shell commands from the scanned repository
- use shell expansion to resolve scripts
- call `make -n`, package-manager introspection, or language-specific metadata
  commands
- follow symlinks outside the scanned tree

## Consequences

The other ADRs can focus on their specific evidence area while sharing one
contract and rollout path. Reviewers and implementers get one place to verify
schema composition, compatibility, thresholds, and default gates.
