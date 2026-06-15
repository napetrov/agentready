# ADR 0003: Repository Topology And Architecture Signals

## Status

Proposed

## Context

File counts and readiness findings are useful, but they do not tell a reviewer
whether a repository is easy for an agent to navigate. Two repositories can both
have a README, tests, and CI while having very different design states:

- a clear monorepo with package boundaries and per-package tests
- a single large `src/` tree with unclear ownership and mixed concerns
- a docs-heavy repo whose architecture docs do not map to code roots
- a generated-code-heavy repo where agents need strong ignore guidance
- a repository with public API surfaces but no nearby tests or examples

AgentReady needs deterministic architecture insight that is deeper than
"present/missing" checks, but still avoids semantic claims that require an LLM.

## Decision

Add deterministic repository topology analysis that derives architecture
signals from the file inventory, manifests, exports, tests, docs, and CI
workflows. The scanner should emit explainable metrics and findings about
navigability, boundary clarity, verification locality, generated-code pressure,
and documentation-to-code coverage.

These signals are not generic code-quality judgments. They are agent-operability
signals: they estimate how easily an autonomous coding agent can find the right
context, edit bounded areas, and choose relevant proof.

## Detailed Implementation

Add `TopologyEvidence`:

```ts
export interface RepositoryTopologyEvidence {
  roots: RepositoryRootEvidence[]
  dependencyHints: DependencyHintEvidence[]
  testCoverageHints: TestCoverageHintEvidence[]
  documentationCoverageHints: DocumentationCoverageHintEvidence[]
  generatedPressure: GeneratedPressureEvidence[]
  metrics: RepositoryTopologyMetrics
}

export interface RepositoryTopologyMetrics {
  rootCount: number
  languageCount: number
  sourceToTestRatio?: number
  docsToSourceRatio?: number
  generatedFileRatio: number
  largestRootShare: number
  publicApiSurfaceCount: number
  rootsWithoutLocalTests: number
  rootsWithoutLocalDocs: number
  verificationMappedRootCount: number
}
```

Initial deterministic detectors:

1. **Root discovery**
   - Manifest roots: `package.json`, workspace manifests, `pyproject.toml`,
     `setup.cfg`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`,
     `.csproj`, `CMakeLists.txt`.
   - Conventional roots: `apps/*`, `packages/*`, `services/*`, `libs/*`,
     `src/`, `cmd/*`, `internal/*`, `pkg/*`, `docs/`, `test/`, `tests/`.
   - Workspace links from structured manifests where available.

2. **Language and role classification**
   - Use extension counts and manifest types.
   - Distinguish source, tests, docs, generated, binary, minified, fixtures.
   - Mark confidence based on manifest-backed versus naming-backed signals.

3. **Public API and entrypoint hints**
   - Node: `package.json` `main`, `module`, `exports`, `bin`, `types`.
   - Python: `project.scripts`, package/module roots, `__init__.py`.
   - Go: `cmd/*`, module path, package directories.
   - Rust: `src/lib.rs`, `src/main.rs`, `[[bin]]`.
   - Java/JVM/.NET: manifest and source-set conventions.

4. **Test locality hints**
   - Map tests to nearest root by path.
   - Identify roots with source but no nearby tests.
   - Identify test-only roots and shared test support roots.
   - Do not claim coverage percentages; only report structural proximity.

5. **Documentation coverage hints**
   - Map document roles to nearest roots.
   - Identify roots with public API or many source files but no nearby
     entrypoint/development/architecture docs.
   - Link docs that explicitly reference paths, package names, or command names.

6. **Verification mapping**
   - Map package scripts, Make targets, CI job commands, and language commands
     to roots when command working directories or manifest paths are explicit.
   - If a command is global or ambiguous, mark it as repository-level and
     low-confidence rather than forcing a root.

7. **Generated pressure**
   - Compute generated/minified/binary proportions per root.
   - Identify generated-heavy roots that need clear ignore/ownership guidance.
   - Keep lockfiles and expected generated fixtures from becoming noisy.

Add topology checks:

- `topology.root.unclear`: many source files but no manifest-backed or
  conventional root boundary.
- `topology.root.tests-unmapped`: source root has no nearby tests and no mapped
  verification command.
- `topology.root.docs-unmapped`: public API or large source root has no nearby
  documentation role.
- `topology.generated.high-pressure`: generated/minified content is large enough
  to create agent context-selection risk.
- `topology.verification.unmapped`: commands exist but cannot be mapped to any
  root, limiting targeted proof selection.

Default severity should be mostly `info`. These are design-state insights, not
hard failures. Policy packs can later strengthen selected checks for teams that
want stricter gates.

Reporter changes:

- Add a "Repository topology" section:
  - roots with role, language, source/test/doc/generated counts
  - public API and entrypoint hints
  - verification commands mapped to roots
  - roots missing local tests/docs
  - generated pressure
- Keep the score separate. Topology insights should explain design state even
  when the numeric score does not change.

## Consequences

AgentReady moves from a readiness checklist toward an architecture map an agent
can use. This makes reports more useful for repository maintainers and for
agent workflows that need to pick context and proof.

The risk is false precision. The implementation must avoid claiming dependency
graphs or coverage that it cannot prove. Use names like "hints", "signals", and
"mapped roots"; include confidence and source.

## Verification

- Add monorepo fixtures for `apps/*` and `packages/*`.
- Add single-package fixtures with colocated and non-colocated tests.
- Add generated-heavy fixtures and ensure lockfiles remain quiet.
- Add public API fixtures for Node, Python, Go, and Rust.
- Snapshot topology evidence and reporter output.
- Add deterministic ordering tests and fixed-clock report tests.
