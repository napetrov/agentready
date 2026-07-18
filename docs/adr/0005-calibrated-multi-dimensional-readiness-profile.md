# ADR 0005: Calibrated Multi-Dimensional Readiness Profile

## Status

Proposed

## Context

The single most important technical gap in AgentReady is the **credibility of
the score**. Today the aggregate score is a fixed severity penalty
(`lib/repo-readiness/core/scoring.ts`):

```ts
const SEVERITY_PENALTY = { error: 18, warning: 7, info: 2 }
// score = clamp(0, 100, 100 - sum(penalty per finding))
```

The code and README are honest that this is experimental, and ADR 0004 already
argues the score should stop being the main story. This ADR makes the follow-on
scoring decision that ADR 0004 deferred ("until the scoring model has a
documented policy"). The fixed penalty has structural problems that no amount of
weight-tuning fixes:

1. **Count substitutes for risk.** Five inconsequential `info` findings (5 × 2 =
   10) outweigh one important `warning` (7), even though the operational effect
   is the opposite.
2. **No applicability denominator.** A large, multi-language monorepo exposes
   more recognizable surfaces than a tiny npm package, so it accrues more
   penalty *opportunities* simply because AgentReady understands it better. A
   raw score punishes legibility.
3. **Confidence is unused.** The evidence model already carries
   `EvidenceConfidence` (`low | medium | high`), but the penalty formula ignores
   it — a low-confidence inference costs the same as a high-confidence fact.
4. **Scope is unused.** One root-level broken test command usually matters more
   than five path-scoped issues in a rarely-used `examples/` tree, but both
   contribute identically.
5. **No outcome calibration.** The weights (18/7/2) are not derived from any
   observed probability of agent task failure, wasted tool calls, wrong
   commands, reviewer correction, unsafe side effect, or rejected patch. They
   are round numbers.
6. **False precision.** `82` reads like a measurement. It is an aggregated
   heuristic, and presenting it as a single number implies more accuracy than
   exists.

The infrastructure to fix this is already in place and should be built on, not
replaced:

- `AutonomyStageResult[]` (`autonomyEnvelope`) already maps findings to the
  eight agent workflow stages `orient | bootstrap | navigate | edit | verify |
  review | merge | deploy` via each rule's `RuleDoc.affectedStages`.
- `ReadinessDimensionScore[]` (`dimensions`) already rolls the score up per
  category so an unsafe-but-well-tested repo does not average out to look like
  its opposite.
- `EvidenceConfidence` is threaded through every evidence claim.
- The calibration feedback loop (`reports/evaluation/calibration/`,
  `docs/product/evaluation.md`) already records, per finding, a classification
  (`true_positive`, `false_positive`, `false_negative`, `severity_mismatch`,
  `policy_mismatch`, `not_observable_locally`), an `affectedStage`, and a
  `verificationStatus`.

What is missing is a **profile** that makes the score secondary and separates
the distinct questions a reader actually has, plus a **calibration path** that
lets the weights be derived from evidence rather than asserted.

## Decision

Make the **Repository Agent Readiness Profile** the primary product and demote
the absolute score to a secondary, clearly-labeled representation. The profile
separates four independent axes that today are collapsed into one number:

- **Readiness** — can an agent do the work? (per stage: `orient`, `bootstrap`,
  `navigate`, `edit`, `verify`, `review`, `merge`, `deploy`)
- **Risk** — how dangerous are the capabilities the repository exposes to an
  agent?
- **Coverage** — what fraction of the *applicable* surfaces did the scanner
  actually understand? (the missing applicability denominator)
- **Observability** — what was verified locally, what was not found, and what is
  impossible to verify locally?

A report should be able to say:

```text
Edit readiness:          ready
Verification readiness:  not ready
Merge governance:        unknown — external controls not queried
Capability risk:         high
Scanner coverage:        78%
Calibration confidence:  low
```

instead of `score: 74`. This is more honest and more operationally useful,
because those four axes fail independently: a repository can be perfectly
editable and completely un-verifiable, and one number cannot say so.

Four concrete rules follow from this decision:

1. **The absolute score stays, but as a derived secondary view**, never the
   headline. It remains the compatibility primitive for existing gates
   (`--fail-on`, diff regression, the Action `minimum-score`). We do **not**
   break it.
2. **Findings gain calibration-aware weighting inputs** (confidence and scope)
   so the score reflects operational risk rather than finding count. This is
   additive to the finding model.
3. **Coverage is measured against an applicability denominator**, so a legible
   repository is not penalized for being understood.
4. **Weights become calibratable**, sourced from the existing calibration
   records rather than hard-coded — but the default weights stay exactly as they
   are until real outcome data justifies changing them. Calibration is the
   *mechanism*; changing a default weight is a separate, evidence-gated event.

## Detailed Implementation

### New evidence inputs on findings (additive, optional)

The **shipped** `ReadinessFinding` (`lib/repo-readiness/core/types.ts`) carries
only `id`, `title`, `severity`, `path?`, and `recommendation`. It has **no
`confidence` field** — confidence lives on evidence claims (`EvidenceClaim`,
`EvidenceConfidence`) and only appears on the *aspirational* candidate `Finding`
model in `docs/product/architecture.md`, not on the real type. So both fields
scoring needs are **new, optional, additive** fields on `ReadinessFinding`;
neither is "already present":

```ts
export type FindingScope = 'root' | 'package' | 'path' | 'advisory'

export interface ReadinessFinding {
  // existing fields unchanged: id, title, severity, path?, recommendation
  confidence?: EvidenceConfidence  // NEW, optional; defaults to 'high'
  scope?: FindingScope             // NEW, optional; defaults to 'package'
}
```

- Both fields are **optional**. `confidence` propagates the confidence of the
  evidence a rule fired on (rules that fire on high-confidence facts may omit
  it); `scope` is derived deterministically by each rule (a root-scope
  instruction contradiction is `root`; a large file under `examples/` is
  `path`).
- **Compatibility:** because both are optional and default to the neutral values
  (`confidence` → `high`, `scope` → `package`) that make every weight multiplier
  `1`, adding them changes no existing finding's behavior and no existing score.
  Rules opt in by populating them.
- No new detector is required; both are properties of evidence detectors already
  hold (its confidence, and where it lives).

### The readiness profile structure

Add `readinessProfile` to `LocalReadinessReport` as a new experimental field. It
composes the *existing* `autonomyEnvelope` and `dimensions` with the two new
axes rather than replacing them:

```ts
export type AxisVerdict = 'ready' | 'not_ready' | 'high' | 'low' | 'unknown'

export interface ReadinessAxis {
  /** Machine-readable verdict; `unknown` when locally unverifiable. */
  verdict: AxisVerdict
  /** How much trust to place in this verdict, from evidence confidence. */
  confidence: EvidenceConfidence
  /** Ids of the findings/evidence backing the verdict. */
  evidenceIds: string[]
  /** One-line explanation, e.g. "external controls not queried". */
  explanation: string
}

export interface ReadinessProfile {
  /** Per-stage readiness — reuses the existing autonomy envelope verbatim. */
  readiness: AutonomyStageResult[]
  /** Aggregate capability-risk verdict, from capability + safety evidence. */
  risk: ReadinessAxis
  /** Applicable-surface coverage; see CoverageReport below. */
  coverage: CoverageReport
  /** What was verified, not found, or unverifiable locally. */
  observability: ObservabilityReport
  /** How much the score/weights are backed by real agent outcomes. */
  calibrationConfidence: EvidenceConfidence
}

export interface CoverageReport {
  /** Surfaces AgentReady knows how to evaluate and found applicable here. */
  applicableSurfaces: number
  /** Of those, how many it could actually assess (not blocked/unknown). */
  assessedSurfaces: number
  /** assessedSurfaces / applicableSurfaces, 0..1; the missing denominator. */
  ratio: number
  /** Applicable surfaces it could not assess, with why. */
  gaps: Array<{ surface: string; reason: string }>
}

export interface ObservabilityReport {
  verifiedLocally: string[]
  notFound: string[]
  /** Explicitly unverifiable offline (branch protection, required reviews...). */
  notObservableLocally: string[]
}
```

`notObservableLocally` reuses the exact concept the calibration schema already
names (`not_observable_locally`) and ADR 0000/0004's "Not verified from
repository contents" list — it is now part of the machine-readable contract, not
only presentation text.

### Calibratable scoring

Replace the hard-coded constant with an injectable weight table that *defaults
to today's values*, and let it read confidence and scope:

```ts
export interface ScoreWeights {
  severity: Record<ReadinessSeverity, number>   // default { error: 18, warning: 7, info: 2 }
  confidence: Record<EvidenceConfidence, number> // default { high: 1, medium: 1, low: 1 }
  scope: Record<FindingScope, number>            // default all 1
}

export const DEFAULT_WEIGHTS: ScoreWeights = /* today's behavior exactly */

export const calculateScore = (
  findings: ReadinessFinding[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number => {
  const penalty = findings.reduce((total, f) => {
    const base = weights.severity[f.severity]
    const c = weights.confidence[f.confidence ?? 'high']
    const s = weights.scope[f.scope ?? 'package']
    return total + base * c * s
  }, 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}
```

With `DEFAULT_WEIGHTS` all multipliers are `1`, so **the default score is
byte-identical to today's**. A policy pack or a future calibrated profile can
supply non-default multipliers (e.g. discount low-confidence findings, discount
`advisory`-scope findings) without touching the core.

### Where calibrated weights come from (relationship to the benchmark)

The weights must eventually be derived, not asserted. The mechanism is the
calibration loop already scaffolded in `docs/product/evaluation.md` and
`reports/evaluation/calibration/`. For each rule, the target statistics are:

- `P(agent failure | finding present)`
- `P(reviewer intervention | finding present)`
- `P(unsafe action | finding present)`
- precision / recall, and false-positive vs false-negative cost

These require **real bounded-task agent runs** across a 30–50 repo corpus with
multiple agent families — the deterministic scan half is automated
(`npm run agentready:benchmark`), the outcome half is not, and the docs already
mark those columns `TODO` rather than inventing data. This ADR does **not**
claim that data exists. It establishes that:

- default weights remain frozen and honestly experimental until outcome data
  exists;
- when outcome data exists, changing a weight is a reviewable event backed by a
  calibration record, not an edit to a magic number;
- `readinessProfile.calibrationConfidence` reports `low` until then, so the
  report never *looks* more calibrated than it is.

### Reporter changes

The primary human output leads with the profile (four axes + per-stage
readiness), and the score appears as a labeled secondary line, consistent with
ADR 0004's section ordering. Example markdown:

```md
## AgentReady scan

Repository Agent Readiness Profile

- Edit readiness:         ready
- Verification readiness: not ready (commands.test.missing)
- Merge governance:       unknown — external controls not queried
- Capability risk:        high (3 high-blast-radius surfaces)
- Scanner coverage:       78% (7/9 applicable surfaces assessed)
- Calibration confidence: low

Secondary score: 74/100 (experimental, uncalibrated)
```

### Compatibility impact

- **Score:** unchanged by default (`DEFAULT_WEIGHTS` reproduces current output).
  Existing `--fail-on`, diff-regression, and Action `minimum-score` gates keep
  working with identical numbers.
- **Schema:** the new `ReadinessFinding.confidence` and
  `ReadinessFinding.scope` fields (both optional), `readinessProfile`, and
  `ScoreWeights` are all **additive**. The two optional finding fields default
  to neutral values and so leave every existing finding's shape and score
  unchanged; `readinessProfile` is registered as a new
  `LocalReadinessExperimentalField` alongside `dimensions` and
  `autonomyEnvelope`; `schemaVersion` stays `local-readiness/v2` because nothing
  existing changes shape or meaning.
- **Default severities:** unchanged. No rule's default severity moves in this
  ADR.
- **Rollout phase:** target **v0.4**, sitting on the autonomy-envelope and
  calibration work already merged for v0.4. Ships as an experimental field,
  behind the same experimental-field contract as `designState`.

## Scope of this ADR and its relationship to the wider review

This ADR decides **score credibility only** (review item 6) and the
**calibration mechanism** that makes it honest (the weighting half of item 7).
The wider review raises adjacent concerns that are *inputs to* the Coverage,
Risk, and Observability axes but are each a separate architectural decision.
They are explicitly **out of scope here and deferred to their own ADRs**, so
this one stays a single reviewable decision:

| Review item | Feeds which axis | Decision owner |
| --- | --- | --- |
| 7 — real-agent benchmark corpus & metrics | calibrates all weights | evaluation ADR (extends `docs/product/evaluation.md`) |
| 8 — parametrizable policy, waivers, policy-as-code | interprets the profile | policy-plane ADR |
| 9 — static + sandboxed MCP assurance | Risk | MCP-assurance ADR |
| 10 — git-metadata/workflow-injection security, OWASP/NIST/CWE mappings | Risk | security-scope ADR |
| 11 — reproducible-environment dimension | Readiness (`bootstrap`) | environment-dimension ADR |
| 12 — OpenTelemetry runtime-feedback ingestion | calibrates weights | runtime-feedback ADR |
| 13 — opt-in GitHub/GitLab enrichers | Observability (`notObservableLocally` → verified) | enrichment ADR |
| 14 — documentation drift (e.g. this repo's `architecture.md` still marks SARIF/v0.2 as planned) | — | doc-consistency / dogfood check |
| 15, 18, 19 — distribution, SWOT, positioning | — | product docs, not architecture |
| 16 — layered target architecture | — | umbrella ADR that sequences the above |

Keeping these separate is deliberate: the profile is designed so each of those
efforts lands as new evidence into an existing axis (Coverage gains an enricher
source, Risk gains MCP/security detectors, Readiness gains an environment stage)
**without** reopening the scoring contract. That composability is the point of
splitting the four axes now, before those detectors exist.

### What this ADR explicitly does not do

- It does not change any default weight, severity, or gate threshold.
- It does not claim outcome calibration has been performed.
- It does not call the score a certification.
- It does not add detectors; it restructures how existing findings are
  presented and scored.

## Consequences

Readers get an honest, operationally useful profile: they can tell an editable
repository from a verifiable one from a safely-mergeable one, see how much of the
repository the scanner actually understood, and see how calibrated the verdict
is — none of which a single number can express. The score survives for CI
continuity but stops masquerading as a measurement.

The calibration path is made explicit and gated: weights can only move on
recorded outcome evidence, which protects against both false precision and
arbitrary re-tuning.

The costs are a larger report payload and reporter complexity (mitigated by the
compact-report guidance from ADR 0004), and the discipline of keeping
`calibrationConfidence: low` visible until the benchmark's outcome half is done —
which is a feature, not a bug, because it stops the profile from overclaiming.

## Verification

- Assert `calculateScore(findings, DEFAULT_WEIGHTS)` is byte-identical to the
  current `calculateScore(findings)` across all existing fixtures (regression
  lock on the default path).
- Add JSON Schema tests for `readinessProfile`, `scope`, `CoverageReport`, and
  `ObservabilityReport`; assert they are registered as experimental fields and
  that `schemaVersion` is unchanged.
- Assert `readinessProfile.readiness` equals the existing `autonomyEnvelope`
  (the profile reuses it, not recomputes it).
- Add fixtures where the axes diverge (editable but not verifiable;
  low-coverage large monorepo; unknown merge governance) and snapshot the
  profile output.
- Assert `coverage.ratio` rises when more applicable surfaces are assessed and
  is unaffected by inapplicable surfaces (legibility is not penalized).
- Assert weighting by confidence/scope only changes the score when non-default
  weights are supplied, and that low-confidence findings can be discounted by a
  policy pack without altering the raw finding set.
- Assert `calibrationConfidence` reports `low` while the benchmark's
  outcome columns remain `TODO`.
- Assert deterministic output across repeated runs with a fixed clock.
</content>
</invoke>
