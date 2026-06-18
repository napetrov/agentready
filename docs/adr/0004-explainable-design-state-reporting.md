# ADR 0004: Explainable Design-State Reporting

## Status

Proposed

## Context

The current report is effective for CI and quick readiness checks: score,
counts, findings, capabilities, safety signals, and CI coverage. For deeper
repository assessment, a single score is not enough. Users need to understand
the architecture and design state:

- What is strong?
- What is ambiguous?
- What is missing?
- What is risky for an agent specifically?
- Which finding is a hard readiness gap versus a design-state observation?
- Which recommendations come from deterministic facts versus optional LLM
  judgment?

The report should make these differences visible without making the default
scanner noisy or non-deterministic.

## Decision

Add an explainable design-state layer to deterministic reporting. It should
group evidence and findings into stable insight categories, show provenance and
confidence, and separate gateable readiness findings from advisory architecture
signals.

The report should preserve the current score but stop treating the score as the
main story. The primary human output should be:

- readiness verdict and gate status
- repository topology summary
- documentation role evidence
- command/CI verification map
- architecture/design-state insights
- gateable findings
- advisory findings
- evidence provenance

## Detailed Implementation

Add `DesignStateInsight`:

```ts
export type DesignStateCategory =
  | 'documentation-evidence'
  | 'architecture-boundary'
  | 'verification-locality'
  | 'context-selection'
  | 'generated-content'
  | 'safety'
  | 'agent-instruction'
  | 'ci-alignment'

export interface DesignStateInsight {
  id: string
  category: DesignStateCategory
  title: string
  severity: 'info' | 'warning' | 'error'
  gateable: boolean
  summary: string
  evidenceIds: string[]
  findingIds?: string[]
  paths: string[]
  confidence: EvidenceConfidence
  recommendation?: string
}
```

Add `designState` to `LocalReadinessReport`:

```ts
export interface DesignStateSummary {
  strengths: DesignStateInsight[]
  risks: DesignStateInsight[]
  ambiguities: DesignStateInsight[]
}
```

Build insights from deterministic evidence after findings are created:

- Findings remain the compatibility and gating primitive.
- Design-state insights can reference findings, repository evidence, or both.
- Every insight must be explainable from existing evidence IDs and paths.
- `gateable` is derived from referenced findings: default advisory insights are
  `gateable: false`; only insights backed by warning/error findings from an
  explicit policy pack become `gateable: true`.
- LLM insights from `analyze` remain separate under the augmented report and
  must be clearly labeled as model-generated.

Reporter output should be redesigned around sections:

1. **Verdict**
   - score
   - fail-on gate result
   - count of gateable warning/error findings
   - deterministic-only versus augmented mode
2. **Repository topology**
   - roots and roles
   - language mix
   - tests/docs/generated distribution
3. **Design-state insights**
   - strengths
   - risks
   - ambiguities
   - confidence labels
4. **Verification map**
   - local commands
   - CI jobs
   - root mappings
   - unmapped commands
5. **Findings**
   - gateable first
   - advisory second
6. **Evidence notes**
   - where inference was low confidence
   - docs/commands that were recognized by role rather than filename

Example markdown shape:

```md
## AgentReady scan

Verdict: warning gate passes; score 84/100

### Repository topology
- `packages/cli`: package, TypeScript, 42 source, 18 test, public CLI entrypoint
- `docs/`: docs root, has entrypoint + architecture role evidence

### Design-state insights
- INFO documentation-evidence: Architecture role evidence found in `docs/design.md`.
- INFO verification-locality: Test command maps to repository root, not package roots.
- WARNING context-selection: generated-heavy root `proto/gen/` needs ignore guidance.

### Gateable findings
- WARNING commands.lint.missing: ...

### Advisory findings
- INFO topology.root.docs-unmapped: ...
```

CLI and JSON changes:

- `--format json` includes all design-state structures.
- Compact report variants may omit raw `files` and raw evidence arrays, but
  must keep `summary`, `findings`, and `designState` summaries when present.
  This is guidance for the existing compact JSON helpers, not a new CLI format.
- `--format markdown` should show enough evidence to be useful in PR comments
  without dumping the full file inventory.
- Existing GitHub Action summary can use the same markdown sections, with a
  concise top section for CI readability.

Scoring:

- Do not immediately fold all topology/design insights into the score.
- Gateable findings continue to affect score through existing scoring rules.
- Advisory design insights can be score-neutral until the scoring model has a
  documented policy.
- If a future policy pack wants design-state gates, it should emit normal
  warning/error findings with stable IDs.

## Consequences

Users get richer architectural understanding without sacrificing deterministic
CI behavior. Agents get a better map for context selection and validation. The
score remains useful, but the report explains why the repository is easy or hard
to work in.

The cost is reporter complexity and larger JSON output. Compact reports and
clear sectioning should keep PR comments readable.

## Verification

- Add JSON Schema tests for `designState`.
- Add markdown snapshots for single-package, monorepo, docs-heavy, and
  generated-heavy fixtures.
- Assert that deterministic scan output does not change between repeated runs
  with a fixed clock.
- Assert that gate behavior is unchanged unless a design-state check emits a
  normal warning/error finding.
- Assert that augmented LLM reports label model-generated insights separately
  from deterministic design-state insights.
