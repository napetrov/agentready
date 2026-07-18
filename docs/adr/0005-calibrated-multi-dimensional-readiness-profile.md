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
Verification readiness:  not_yet_ready
Merge governance:        unknown — external controls not queried
Capability risk:         high
Scanner coverage:        78%
Calibration confidence:  low
```

instead of `score: 74`. This is more honest and more operationally useful,
because those four axes fail independently: a repository can be perfectly
editable and completely un-verifiable, and one number cannot say so.

The per-stage readiness lines render the machine `AutonomyStatus` vocabulary
(`ready | not_yet_ready | blocked`) directly. "Merge governance: unknown" is not
a readiness status — `AutonomyStatus` has no `unknown`; it is an Observability
statement (the merge controls are `notObservableLocally`, not queried offline),
surfaced next to the readiness lines because that is what a reader needs to see
together.

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

- Both fields are **optional and rule-owned**. `scope` is derived
  deterministically by each rule (a root-scope instruction contradiction is
  `root`; a large file under `examples/` is `path`).
- **`confidence` is set by the rule, not read off legacy evidence.** Most
  built-in detectors' evidence records — `CommandEvidence`, `CiEvidence`,
  `CapabilitySurfaceEvidence`, `SafetySignalEvidence`, `GovernanceEvidence` in
  `lib/repo-readiness/core/types.ts` — have **no `confidence` member**; only
  `EvidenceClaim`-style topology/repository evidence carries one. So a rule
  cannot simply "propagate the confidence of the evidence it fired on." Each rule
  instead **owns its confidence**: rules firing on determinate structural facts
  (a missing `test` script, a dangerous lifecycle hook) legitimately emit `high`
  (or omit the field, which defaults to `high`); only rules whose signal is
  genuinely heuristic set `medium`/`low`. This means confidence-aware weighting
  is intentionally a **no-op for today's structural rules** and only bites once a
  rule opts in with a sub-`high` confidence — which is correct, because those
  structural facts *are* high-confidence. Threading `EvidenceConfidence` onto the
  legacy evidence records is not required by this ADR and is left to whichever
  rule wants to source confidence from claim-level evidence.
- **Compatibility:** because both are optional and default to the neutral values
  (`confidence` → `high`, `scope` → `package`) that make every weight multiplier
  `1`, adding them changes no existing finding's behavior and no existing score.
  Rules opt in by populating them.
- No new detector is required; both are properties of evidence detectors already
  hold (its confidence, and where it lives).

### The readiness profile structure

Add `readinessProfile` to `LocalReadinessReport` as a new experimental field.
For per-stage readiness it **embeds** the existing autonomy envelope (its
`readiness` field *is* `AutonomyStageResult[]`, the same data as top-level
`autonomyEnvelope`), and it adds the two new axes. It does **not** nest
`dimensions`: the per-category severity rollup stays a **top-level** field
(`LocalReadinessReport.dimensions`) as it is today — a single source of truth,
not duplicated under `readinessProfile.dimensions`. So the profile *sits
alongside* `dimensions` and *reuses* `autonomyEnvelope`; it does not absorb
either. None of this replaces the existing fields:

The Risk axis and the readiness axes answer different questions and must not
share a verdict scale.

- **Per-stage readiness reuses the existing `AutonomyStatus`
  (`ready | not_yet_ready | blocked`)** verbatim — the `readiness` field *is*
  the existing `AutonomyStageResult[]` (`autonomyEnvelope`), so it must serialize
  exactly that vocabulary. This ADR introduces **no** new readiness verdict type;
  an earlier draft's `ready | not_ready | unknown` was wrong because it
  contradicted the `readinessProfile.readiness === autonomyEnvelope` invariant
  below.
- **Risk is a tier** and **reuses the existing `CapabilityRiskTier`
  (`low | medium | high`)** verbatim, plus `unknown` for the narrow case a tier
  cannot be assigned at all (defined below — **not** the same as unverifiable
  tool *scope*, which is deliberately `high`), so a repo with only `medium`-risk
  surfaces (the value the detector emits for settings files that *could* define
  hooks but don't appear to) is represented faithfully rather than coerced to
  `low`/`high`.

```ts
/** CapabilityRiskTier is the existing 'low' | 'medium' | 'high' from types.ts. */
export type RiskVerdict = CapabilityRiskTier | 'unknown'

export interface AxisAssessment<TVerdict extends string> {
  /** Machine-readable verdict; `unknown` when locally unverifiable. */
  verdict: TVerdict
  /** How much trust to place in this verdict, from evidence confidence. */
  confidence: EvidenceConfidence
  /**
   * Stable references to the backing evidence — a finding id when one exists,
   * otherwise an ADR-0000 derived key for evidence that has no native id (see
   * the risk-axis note below). May be empty in two cases: `verdict` is
   * `unknown` (nothing to reference because it could not be assessed), or the
   * verdict is a *verified negative* whose evidence is the absence of any
   * backing object (e.g. `low` risk because no capability surfaces exist). In
   * the verified-negative case `explanation` must state the confirmed absence.
   */
  evidenceRefs: string[]
  /** One-line explanation, e.g. "external controls not queried". */
  explanation: string
}

export interface ReadinessProfile {
  /** Per-stage readiness — reuses the existing autonomy envelope verbatim. */
  readiness: AutonomyStageResult[]
  /** Aggregate capability-risk tier, reusing CapabilityRiskTier (+ unknown). */
  risk: AxisAssessment<RiskVerdict>
  /** Applicable-surface coverage; see CoverageReport below. */
  coverage: CoverageReport
  /** What was verified, not found, or unverifiable locally. */
  observability: ObservabilityReport
  /** How much the score/weights are backed by real agent outcomes. */
  calibrationConfidence: EvidenceConfidence
}
```

**Risk-axis references must not require inventing ids.** A `high` risk verdict is
backed by a real finding (`buildFindings` emits `safety.capability.high-risk:<path>`
only for `riskTier === 'high'`), but a `medium`/`low` verdict is backed by
`CapabilitySurfaceEvidence` entries, and that type has **no `id`** (`kind`,
`path`, `tool`, `notes`, `riskTier` only). So `evidenceRefs` is a list of stable
references, not finding ids specifically: when a finding exists, use its id;
otherwise use the deterministic ADR-0000 derived key for the surface —
`capability:<normalized-path>:<kind>` — which is reproducible from the evidence
without a new field. This keeps a `medium`/`low` risk verdict verifiable instead
of unverifiable-or-fabricated. Adding a native `id` to `CapabilitySurfaceEvidence`
is a valid alternative but is left to the risk-detector work (the security-scope
ADR, item 10); this ADR only requires that the reference be stable and derivable.

**No capability surfaces is a verified `low`, not `unknown`.** When
`detectCapabilitySurfaces` returns `[]` (a common, locally-verified "nothing
exposed" case), the risk axis is `{ verdict: 'low', confidence: 'high',
evidenceRefs: [], explanation: 'no capability surfaces detected' }`. Empty
`evidenceRefs` here is correct — the confirmed *absence* of surfaces is the
evidence, carried in `explanation` — so a no-capability repo is never mislabeled
`unknown` and never needs a fabricated reference.

**Unknown tool scope is `high`, never `unknown`.** An `.mcp.json` (or any MCP
config) must **keep** its `high` verdict in the profile. The detector already
rates every MCP config `riskTier: 'high'` *because* the server's real tool set
is only visible over the protocol at runtime, not in its launch config
(`lib/repo-readiness/detectors/capability-surfaces.ts`), and `buildFindings`
emits `safety.capability.high-risk` for it. Unverifiable *scope* is precisely
why the surface is high blast-radius — it is **not** an `unknown` verdict.
Downgrading such a repo to `unknown` in the new headline profile would be a
regression against the current signal, so `unknown` is reserved **only** for a
surface the scan cannot even assign a tier to — which, today, does not happen for
statically path-detected surfaces (every one gets a deterministic blast-radius
tier, and absence is verified `low`). `unknown` is therefore a forward-looking
slot for future modes that *start but cannot complete* an assessment (e.g. the
opt-in sandboxed MCP inspection in item 9, or a platform enricher), not for any
config AgentReady detects statically.

**The coverage unit is a fixed surface *kind*, not a file or record.** To make
`ratio` reproducible and comparable across runs — and to avoid re-introducing
the size bias the axis exists to remove — a "surface" is one member of a closed,
versioned taxonomy of detector families, **not** a file, command string, rule
id, or workspace root (those scale with repo size and would make a legible
monorepo look *worse*-covered). The taxonomy maps one-to-one onto the existing
evidence groups on `LocalReadinessReport`:

```ts
export type CoverageSurfaceKind =
  | 'instruction-surfaces'   // report.instructions
  | 'command-ecosystems'     // report.commands.ecosystems
  | 'ci-workflows'           // report.ci
  | 'capability-surfaces'    // report.capabilities
  | 'governance'             // report.governance
  | 'documentation-roles'    // report.docs
  | 'repository-topology'    // report.repositoryEvidence.topology
```

- A kind is **applicable** when the repo has ≥1 instance of it (e.g. any
  recognized command ecosystem makes `command-ecosystems` applicable). Absence
  makes the kind *not applicable* — it never counts against coverage.
- A kind is **assessed** when AgentReady produced a determinate evaluation for
  it (evidence + any findings), and *unassessed* when it was recognized as
  present but could not be evaluated (parse failure, an over-limit file, a
  surface deferred to an enricher). Unassessed kinds populate `gaps`.
- Counts are of **kinds**, so `applicableSurfaces ≤ 7` today; the taxonomy is
  versioned and grows only by deliberate addition (a new detector family), which
  is the one thing that legitimately moves the denominator.

```ts
export interface CoverageReport {
  /** Count of CoverageSurfaceKind values applicable to this repo (>=1 instance). */
  applicableSurfaces: number
  /** Of those, how many AgentReady could actually assess (not blocked/unknown). */
  assessedSurfaces: number
  /**
   * assessedSurfaces / applicableSurfaces, always within 0..1.
   * Invariant: when applicableSurfaces is 0 the division is undefined, so the
   * ratio is defined as `1` — zero applicable surfaces means coverage is
   * vacuously complete (there was nothing this scan needed to assess). The
   * value must never be NaN, Infinity, null, or outside 0..1.
   */
  ratio: number
  /** Applicable-but-unassessed kinds, with why. */
  gaps: Array<{ surface: CoverageSurfaceKind; reason: string }>
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

`ScoreWeights` is an **internal parameter of `calculateScore`**, not a
serialized report field (see Compatibility impact). Because a policy pack is the
intended future source of a non-default weight table, the contract must be
defensive: the default is immutable, and injected weights are validated before
use.

**Weight injection is not available in the delivered policy contract and this
ADR does not add it.** Today `PolicyPack.adjust` returns only a per-finding
severity change, and `applyPolicy` recomputes `calculateScore(adjustedFindings)`
with no weights argument (`lib/repo-readiness/core/policy.ts`); the diff gate
does the same (`lib/repo-readiness/core/gate.ts`). Letting a pack (e.g.
`ml-scientific` discounting low-confidence/advisory findings) supply weights is a
**contract change owned by the policy-plane ADR (item 8)**, not something to
treat as already wired. When that ADR lands it must, at minimum:

- add an optional `weights?: ScoreWeights` (or a `weights()` accessor) to
  `PolicyPack`;
- thread it through `applyPolicy` into the `calculateScore(adjustedFindings,
  pack.weights)` call and through the diff gate's score recomputation;
- run the same `assertValidWeights` validation on the pack-supplied table.

Until then, this ADR only makes `calculateScore` *accept* a validated weight
argument (defaulting to the frozen `DEFAULT_WEIGHTS`); the sole caller is the
core scorer, and every shipped pack continues to affect the score exclusively
through severity adjustment.

```ts
export interface ScoreWeights {
  severity: Record<ReadinessSeverity, number>   // default { error: 18, warning: 7, info: 2 }
  confidence: Record<EvidenceConfidence, number> // default { high: 1, medium: 1, low: 1 }
  scope: Record<FindingScope, number>            // default all 1
}

// Deep-frozen so a caller cannot mutate the shared default and silently change
// future scores; the defaulting path passes this frozen value, never a shared
// mutable one.
export const DEFAULT_WEIGHTS: ScoreWeights = Object.freeze({
  severity: Object.freeze({ error: 18, warning: 7, info: 2 }),
  confidence: Object.freeze({ high: 1, medium: 1, low: 1 }),
  scope: Object.freeze({ root: 1, package: 1, path: 1, advisory: 1 }),
}) as ScoreWeights

// Every severity/confidence/scope multiplier must be finite and >= 0, and the
// maps must be complete: a missing key would yield `undefined -> NaN`, and a
// negative weight could *raise* the score and weaken an existing gate.
const assertValidWeights = (w: ScoreWeights): void => { /* throws on bad input */ }

export const calculateScore = (
  findings: ReadinessFinding[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number => {
  if (weights !== DEFAULT_WEIGHTS) assertValidWeights(weights)
  const penalty = findings.reduce((total, f) => {
    const base = weights.severity[f.severity]
    const c = weights.confidence[f.confidence ?? 'high']
    const s = weights.scope[f.scope ?? 'package']
    return total + base * c * s
  }, 0)
  // Round to an integer: calibrated weights can be fractional, but the score
  // and the per-category `dimensions[].score` are serialized as integers.
  return Math.max(0, Math.min(100, Math.round(100 - penalty)))
}
```

**Scores stay integers.** Calibrated multipliers may be fractional (e.g. a
`0.5` low-confidence discount), which would otherwise yield values like `96.5`.
Both `calculateScore` and the per-category `calculateDimensionScores` (which
reuses the same penalty model) must round to a nearest integer, because the
serialized `summary.score` and `dimensions[].score` are integer-typed in the
strict schema (`readinessDimensionScoreSchema` uses `z.number().int()`). Rounding
is a no-op on the default path — `DEFAULT_WEIGHTS` multipliers are all `1`, so
`100 - penalty` is already integer — preserving byte-identical default output.

With `DEFAULT_WEIGHTS` all multipliers are `1`, so **the default score is
byte-identical to today's**. Once the policy-plane ADR wires weights into
`PolicyPack` (above), a pack or a calibrated profile can supply non-default
multipliers (e.g. discount low-confidence findings, discount `advisory`-scope
findings) — but only weights that pass `assertValidWeights` (finite,
non-negative, complete), so an injected pack can never produce a `NaN` score or a
negative penalty that inflates the score past an existing gate. This ADR delivers
the validated *parameter*; it does not itself give any pack a way to set it.

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
- Verification readiness: not_yet_ready (commands.test.missing)
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
- **Schema (serialized report fields):** the new `ReadinessFinding.confidence`
  and `ReadinessFinding.scope` fields (both optional) and `readinessProfile` are
  **additive, but they do change the strict schemas.** The v2 report and finding
  schemas (`lib/repo-readiness/core/schemas.ts`) reject unknown keys — a
  strictness the tests enforce (`__tests__/schemas.test.ts` "rejects unknown
  keys") — so these new keys must be **added to the strict Zod/JSON schemas in
  the same change**, and the schema strictness/snapshot tests updated in
  lockstep. Runtime defaults (`confidence → high`, `scope → package`) mean a
  finding that omits them is unchanged in *value*, but a report or finding that
  *emits* them is only valid against the updated schema.
- **Why `schemaVersion` stays `local-readiness/v2`:** not because "nothing
  changes" — the strict schema does change — but because this follows the
  established **additive-within-v2 experimental-field contract** from ADR 0000's
  rollout plan, exactly as `repositoryEvidence`, `designState`, `dimensions`, and
  `autonomyEnvelope` were added without a version bump. `readinessProfile` is
  registered as a new `LocalReadinessExperimentalField` (the top-level opt-in
  signal that a field is unstable within v2). The trade-off is explicit and
  inherited from that contract: a consumer pinned to an *older* copy of the v2
  schema must regenerate it to accept the new keys — that is the accepted cost of
  an experimental field, and the schema tests are the gate that keeps the shipped
  schema and the emitted report in agreement.
- **Finding-level additions get their own opt-in marker (decision: option a).**
  `LocalReadinessExperimentalField` enumerates *report* fields, so it cannot flag
  `ReadinessFinding.confidence`/`scope`. This ADR **chooses to extend the
  contract** rather than ship unmarked nested keys or prematurely call them
  stable: add an `experimentalFindingFields: string[]` companion to
  `experimentalFields` on `reportContract`:

  ```ts
  export interface LocalReadinessReportContract {
    schemaVersion: 'local-readiness/v2'
    experimentalFields: LocalReadinessExperimentalField[]
    /** Nested finding-level experimental keys, e.g. 'confidence', 'scope'. */
    experimentalFindingFields?: LocalReadinessExperimentalFindingField[]
  }

  export type LocalReadinessExperimentalFindingField = 'confidence' | 'scope'
  ```

  This gives the nested keys the same explicit opt-in signal top-level fields
  have, keeps `schemaVersion` at v2 (the addition is itself optional and
  additive), and means a consumer can detect that `findings[].confidence`/`scope`
  are unstable without inspecting individual findings. The alternative — option
  (b), keeping the fields internal until stable — was rejected because the
  profile's explainability goal wants per-finding confidence/scope *visible* so a
  reader can see why a finding was weighted; hiding them defeats that.
- **The marker must travel with the findings, in every report shape.**
  `ReadinessFinding` is serialized in more than the scan report: the diff report
  emits `newFindings`/`resolvedFindings`/`regressions` and the portfolio report
  emits `repos[].topFindings` (`lib/repo-readiness/core/types.ts`), and neither
  `ReadinessDiffReport` nor `PortfolioReport` carries a `reportContract` today.
  So the rule is: **any report shape that serializes findings carrying
  `confidence`/`scope` must advertise them the same way** — add an
  `experimentalFindingFields` advertisement to `ReadinessDiffReport` and
  `PortfolioReport` (via a `reportContract`, or a standalone field), *or* strip
  those experimental keys from findings before serializing them in that shape.
  What is not allowed is emitting `findings[].confidence`/`scope` in `agentready
  diff`/`batch --format json` output with no adjacent marker — that would break
  the "never emitted unadvertised" invariant. This ADR requires the advertisement
  path for the diff report (whose regression reasoning benefits from confidence)
  and leaves strip-vs-advertise to the implementer for the portfolio summary.
- **`ScoreWeights` is not a schema field.** It is an internal parameter of
  `calculateScore` (and a future policy-pack input), not part of
  `LocalReadinessReport`, `reportContract.experimentalFields`, or the config
  schema — nothing serializes it. It carries no schema-version or
  experimental-field registration obligation; its only compatibility contract is
  that `DEFAULT_WEIGHTS` reproduces today's score exactly and that injected
  weights are validated.
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
  `ObservabilityReport`; assert `readinessProfile` is registered as an
  experimental field and that `schemaVersion` stays `local-readiness/v2`.
- Assert the updated **strict** report and finding schemas *accept* the new
  optional keys and still *reject* genuinely unknown keys, so
  `__tests__/schemas.test.ts` passes rather than tripping on the additions.
- Assert that when **any** report shape emits findings carrying
  `confidence`/`scope` — scan `findings`, diff
  `newFindings`/`resolvedFindings`/`regressions`, portfolio `topFindings` — that
  shape either advertises the keys via `experimentalFindingFields` or strips
  them, so the nested experimental fields are never emitted without an adjacent
  opt-in marker in `agentready scan`/`diff`/`batch --format json`.
- Assert `calculateScore` still takes only the frozen `DEFAULT_WEIGHTS` from any
  shipped policy pack (no pack supplies a weight table until the policy-plane
  ADR adds `PolicyPack.weights`), so every current pack affects the score
  through severity adjustment alone.
- Assert `readinessProfile.readiness` equals the existing `autonomyEnvelope`
  and serializes the `AutonomyStatus` vocabulary (`ready | not_yet_ready |
  blocked`), with no `not_ready`/`unknown` readiness value anywhere (the profile
  reuses the envelope, it does not introduce a parallel verdict type).
- Add fixtures where the axes diverge (editable but not verifiable;
  low-coverage large monorepo; unknown merge governance) and snapshot the
  profile output.
- Assert a repo with no capability surfaces yields
  `risk = { verdict: 'low', confidence: 'high', evidenceRefs: [] }` with an
  absence `explanation`, and is **not** reported as `unknown`; assert a
  `medium`/`low` verdict backed by real surfaces populates `evidenceRefs` with
  derivable `capability:<path>:<kind>` keys.
- Assert a repo with an `.mcp.json` (or other MCP config) keeps `risk.verdict`
  `high` in the profile — never `unknown` — matching the detector's existing
  `riskTier: 'high'` and its `safety.capability.high-risk` finding, so the new
  headline profile does not regress the current high-blast-radius signal.
- Assert `coverage` counts fixed `CoverageSurfaceKind` values, not files/records:
  `applicableSurfaces` is stable regardless of how many instances a kind has (a
  monorepo with 40 command ecosystems and one with 2 both count
  `command-ecosystems` once), so a legible repo is never penalized for size.
- Assert `coverage.ratio` rises when more applicable surfaces are assessed and
  is unaffected by inapplicable surfaces (legibility is not penalized).
- Assert `coverage.ratio` is `1` (never `NaN`/`Infinity`/`null`) when
  `applicableSurfaces` is `0`, and stays within `0..1` for all inputs.
- Assert weighting by confidence/scope only changes the score when non-default
  weights are passed **directly** to `calculateScore(findings, weights)` (e.g. a
  fractional low-confidence discount lowers the penalty) without altering the raw
  finding set. Do **not** assert policy-pack-driven discounting here — no shipped
  pack can supply weights until the policy-plane ADR adds `PolicyPack.weights`;
  that test belongs to that ADR.
- Assert a fractional weight (e.g. `confidence.low = 0.5`) yields an integer
  `summary.score` and integer `dimensions[].score` (rounding), so the strict
  `z.number().int()` dimension schema still validates.
- Assert `calculateScore` rejects injected weights that are non-finite,
  negative, or incomplete (missing severity/confidence/scope keys), and that
  `DEFAULT_WEIGHTS` is deep-frozen so a caller cannot mutate the shared default.
- Assert `calibrationConfidence` reports `low` while the benchmark's
  outcome columns remain `TODO`.
- Assert deterministic output across repeated runs with a fixed clock.
