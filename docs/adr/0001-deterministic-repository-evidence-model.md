# ADR 0001: Deterministic Repository Evidence Model

## Status

Proposed

## Context

AgentReady already separates deterministic scanning from optional LLM analysis:
detectors collect facts, checks turn those facts into findings, and the
`analyze` layer can add semantic judgment without changing the deterministic
score. That split is the right base, but the current deterministic report still
compresses repository structure into broad counts and a small set of booleans.

The product direction needs richer insight into repository architecture and
design state without relying on an LLM or on a single high-level readiness
datapoint. It should answer questions such as:

- What are the repository's main roots, packages, apps, libraries, docs, and
  generated areas?
- Which files and directories look like ownership, runtime, build, test, or
  documentation surfaces?
- Which verification commands and CI jobs map to which parts of the tree?
- Which evidence is observed directly, which is inferred, and which is unknown?

The core scanner must stay local-first, offline, deterministic, and
never-execute. It should produce stable, machine-readable evidence that can be
diffed, cached, tested, and explained.

## Decision

Introduce a first-class deterministic `repositoryEvidence` model that records
observed repository structure as normalized facts before policy checks run.
Checks and reporters should consume this model instead of independently
reconstructing architecture hints from file counts, command booleans, or
filename-specific assumptions.

The evidence model should be descriptive and provenance-rich:

- Every evidence item has a stable `id`, `kind`, `path` or path set,
  `confidence`, and `source`.
- `source` identifies the detector and whether the item was directly observed
  from a file, derived from a manifest, inferred from naming conventions, or
  read from config.
- Low-confidence inference is allowed, but it must be marked as inference and
  should not become a hard gate by default.
- The deterministic report remains the authoritative gating surface; LLM
  augmentation may interpret this evidence but must not mutate it.

## Detailed Implementation

Add new typed evidence groups under `lib/repo-readiness/core/types.ts`:

```ts
export type EvidenceConfidence = 'low' | 'medium' | 'high'

export type EvidenceSourceKind =
  | 'file'
  | 'manifest'
  | 'workflow'
  | 'config'
  | 'inference'

export interface EvidenceSource {
  detector: string
  kind: EvidenceSourceKind
  path?: string
  note?: string
}

export interface RepositoryRootEvidence {
  id: string
  kind: 'app' | 'library' | 'package' | 'service' | 'tool' | 'docs' | 'test' | 'unknown'
  path: string
  languages: string[]
  packageManager?: PackageManager
  manifests: string[]
  sourceFiles: number
  testFiles: number
  documentationFiles: number
  generatedFiles: number
  confidence: EvidenceConfidence
  sources: EvidenceSource[]
}

export interface ArchitectureBoundaryEvidence {
  id: string
  path: string
  role:
    | 'entrypoint'
    | 'public-api'
    | 'internal-module'
    | 'adapter'
    | 'domain'
    | 'infrastructure'
    | 'test-support'
    | 'generated'
    | 'unknown'
  signals: string[]
  confidence: EvidenceConfidence
  sources: EvidenceSource[]
}

export interface RepositoryEvidence {
  roots: RepositoryRootEvidence[]
  boundaries: ArchitectureBoundaryEvidence[]
  documentSurfaces: DocumentSurfaceEvidence[]
  verificationSurfaces: VerificationSurfaceEvidence[]
}
```

Keep the existing top-level report fields for compatibility, but add
`repositoryEvidence` to `LocalReadinessReport`. Existing fields such as
`docs`, `commands`, `ci`, `instructions`, and `files` can initially be projected
from the new evidence or populated in parallel.

Add a new detector layer:

- `detectors/repository-roots.ts` detects package/workspace roots, application
  directories, library directories, docs roots, test roots, generated roots, and
  tool directories.
- `detectors/architecture-boundaries.ts` identifies likely architectural roles
  from stable signals: package exports, CLI entrypoints, language-specific module
  roots, public API barrels, internal/private directories, adapter naming,
  infrastructure naming, generated flags, and test-support paths.
- `detectors/verification-surfaces.ts` maps command evidence and CI jobs back to
  roots where possible.
- Existing detectors continue to collect their specialized evidence, but the
  scan engine merges them into the repository evidence graph before checks run.

Detection should be deterministic and conservative:

- Prefer manifest and config facts over naming conventions.
- Use language-aware parsers or structured manifest readers when available.
- Sort all evidence deterministically by normalized path and id.
- Use path normalization already present in `core/util.ts`.
- Never execute package scripts, build tools, language servers, or repository
  commands.

Report contracts must make the provenance explicit. A root inferred only from
`src/` naming should be less authoritative than a root found through
`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, or a
workspace manifest.

## Consequences

AgentReady can explain repository architecture with stable evidence instead of
opaque heuristics. Reporters can show why the scanner believes a directory is a
package, app, public API, generated area, or test support area. Diff mode can
then track architectural changes, not only new findings.

The main cost is schema expansion. To control churn, introduce the new evidence
as additive fields first, update JSON Schema and contract tests, then migrate
checks/reporters gradually.

## Verification

- Add unit fixtures for monorepo, single-package, docs-heavy, generated-heavy,
  and multi-language repositories.
- Snapshot the new evidence order and provenance.
- Assert that `scan` remains deterministic for the same tree and fixed clock.
- Assert that `diff` sees committed generated/vendor files even when
  `.gitignore` would normally ignore them.
- Keep existing JSON fields backward-compatible until a documented major change.
