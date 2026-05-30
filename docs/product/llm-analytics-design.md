# LLM / Agentic Analytics Layer — Design (Epic)

> **Status:** Design / umbrella. This document is the design for an **epic**;
> implementation lands across several smaller PRs (see [Delivery plan](#delivery-plan-ep--prs)).
> It is the authoritative reference for the optional, LLM-powered analytics layer
> that augments AgentReady's deterministic scanner.

## 1. Motivation and the core principle

AgentReady's deterministic core answers **"what exists, and what shape is it?"** —
presence of a README, test/lint/type-check commands, CI workflows, instruction
files, large/minified files, unsafe scripts. It is offline, reproducible, and
never executes repository code.

There is a second class of questions it structurally cannot answer well:
**"is this any good, does it cohere, does it mean what it claims?"** Judging
whether an `AGENTS.md` is actually *useful*, whether two instruction files
*contradict* each other, or whether `ARCHITECTURE.md` still matches the tree
requires natural-language understanding. That is the job of this layer.

The guiding rule is **facts vs. judgment**, expressed as three tiers:

| Tier | What | How | Examples |
|---|---|---|---|
| **0 — Facts** | Presence, structure, syntax | Deterministic detectors | file inventory, script presence, CI presence, safety regex/AST |
| **1 — Proxies** | Cheap heuristics for quality | Deterministic, offline, no model | README has setup/usage headings + a command block; documented commands resolve to real scripts |
| **2 — Judgment** | Semantics, intent, consistency, accuracy | **LLM** | instruction-file usefulness, cross-doc contradictions, doc↔reality drift, remediation |

We push as much as possible into Tiers 0–1 (free, offline, deterministic) and
reserve the LLM for Tier 2, where there is no deterministic proxy.

## 2. Decisions (locked)

1. **Dual-mode.** A **deterministic-only** mode works fully offline with no model
   and remains the default for CI gating. An **LLM-augmented** mode is a
   first-class, opt-in capability — not a bolt-on.
2. **Two scores, never conflated.** The deterministic `score` is always present.
   When the augmented mode runs, the report also carries a **clearly-labeled
   `augmentedScore`** plus the insights that produced it. Tooling and docs always
   distinguish the two.
3. **LLM is first-class but isolated.** The layer lives in a separate, optional
   package (working name `@agentready/analyze`). The core `scan`/`diff` engine
   never imports it; no network call happens on the core path.
4. **Never gates CI by default.** Gating uses the deterministic score. Gating on
   the augmented score is an explicit opt-in. LLM errors **fail open** to
   deterministic-only.
5. **Provider-agnostic.** A thin provider port with pluggable adapters, a
   task→model routing table, environment auto-detection, and per-insight model
   stamping. No vendor is hard-coded.
6. **Never-execute still holds.** The layer reasons over *already-emitted
   evidence*; it never runs repo code and only sends bounded, explicit slices to
   a model.

## 3. Where the LLM is genuinely required (Tier 2)

- **Instruction-file usefulness / actionability** — a present-but-useless
  `AGENTS.md` passes the deterministic `instructions.missing` rule; quality is
  semantic.
- **Cross-surface contradiction / overlap** — e.g. `.cursorrules` says "use
  yarn" while `AGENTS.md` says "use npm"; `CONTRIBUTING` says `make test` while
  `package.json` says `jest`.
- **Doc ↔ reality drift** — does `ARCHITECTURE.md` describe the current module
  layout, or a stale one? Does the README's setup work given the manifest?
- **README/explanation quality beyond structure** — Tier 1 sees headings + a
  code block; "explains the purpose well enough for an unfamiliar agent" is Tier 2.
- **False-positive triage** — is that "large file" an intentional fixture? Is
  that "minified" file actually hand-written source? Context-dependent.
- **Repo-specific remediation / patches** — turning `commands.test.missing` into
  a concrete proposed change for *this* repo.
- **Task-conditioned readiness** (later) — "given *this* task, is the repo ready?"

## 4. Where the LLM is deliberately NOT used

Everything in Tiers 0–1; anything that must be deterministic, free, and offline;
and **CI gating by default**. A flaky, non-deterministic verdict must never
decide whether a PR merges.

## 5. Architecture

```
            deterministic (offline, never-execute)        optional, opt-in
  ┌───────────────────────────────────────────┐   ┌──────────────────────────┐
  │  scan / diff engine → evidence (JSON)      │──▶│  @agentready/analyze     │
  │  detectors · checks · scoring · reporters  │   │  consumes evidence       │
  └───────────────────────────────────────────┘   │   ├─ slicing + budgets    │
                                                    │   ├─ cache (content-hash) │
                          deterministic `score` ◀───┤   ├─ LlmProvider routing  │
                                                    │   ├─ analyzers (Tier 2)   │
                       augmented report + score ◀───┤   └─ insight schema       │
                                                    └──────────────────────────┘
```

- **`LlmProvider` port.** A minimal interface: given a structured request
  (system + user content + an output JSON schema + task tag), return a structured
  response. Adapters implement it; the rest of the layer is provider-blind.
- **Routing table, not a single provider.** Config maps each task to a
  `(provider, model)`, so a run can use a cheap local model for triage *and* a
  strong cloud model for remediation simultaneously.
- **Auto-detection.** Inspect the environment and pick a provider; explicit
  config overrides. (See §6.)
- **Insight schema.** Each insight is keyed to a finding id (or a new
  `analysis.*` id), and carries: verdict, confidence (0–1), rationale, optional
  remediation, and the producing `model@version` + `promptVersion`. This makes
  output structured, attributable, diffable, and auditable.
- **Contracts via Zod**, mirroring the existing `core/schemas.ts` approach, with
  versioned JSON Schema published for the insight and augmented-report shapes.

### 5.1 The seam is data, not a code dependency

The single hard rule that makes everything else safe: **the deterministic core
never imports the analytics layer; the layer only consumes the core's
already-emitted JSON evidence.** The boundary is the existing report contract, so
the layer is physically incapable of changing core behavior, adding a network
call to the core path, or executing repo code.

```
 scan / diff   →   evidence (JSON)   →   @agentready/analyze   →   augmented report
 (unchanged)       (existing contract)    (new, optional)           (deterministic report
                                                                     + insights + augmentedScore)
```

### 5.2 The provider contract

Everything provider-specific hides behind one small port, so every adapter
(Anthropic, OpenAI-compatible/local, GitHub Models, Bedrock/Vertex/Azure,
host-injected) is interchangeable. Sketch (illustrative, not final):

```ts
interface LlmProvider {
  readonly id: string                                 // "anthropic" | "openai-compat" | "github-models" | "host" | ...
  complete(req: LlmRequest): Promise<LlmResponse>     // structured in, structured out
}

interface LlmRequest {
  task: AnalyzerTask        // routing key + token-budget owner
  system: string
  input: string             // the sliced evidence (never the whole repo)
  outputSchema: JsonSchema  // the provider must return JSON matching this
  maxTokens: number
}

interface LlmResponse {
  insights: unknown         // Zod-validated against the analyzer's insight schema before use
  model: string             // stamped onto every insight (model@version)
  usage?: { inputTokens: number; outputTokens: number }
}
```

This is what makes the four token-provisioning stories in §6 collapse to "pick an
adapter": the **pipeline never changes**, only which `LlmProvider` is wired in.

### 5.3 Run lifecycle (the analyzer pipeline)

Inside `@agentready/analyze`, a run is a six-step pipeline. **Every step is
fail-open** — any error/timeout drops that insight and the run continues; the
deterministic report is always returned intact.

1. **Select** — from the deterministic findings + evidence, pick only the
   *ambiguous* subset worth a model call (e.g. judge `AGENTS.md` only if it
   exists; run contradiction checks only with ≥2 instruction surfaces). Nothing
   else is sent to a model.
2. **Slice** — build a bounded input per analyzer: the relevant file(s) plus a
   tree *summary*, never the whole repo. Hard per-task token budget.
3. **Cache lookup** — key = `hash(model, promptVersion, schemaVersion,
   slicedInput)`. A hit skips the call entirely. In CI most inputs are unchanged
   → mostly hits; `diff` mode only analyzes changed docs.
4. **Provider call** — the analyzer hands an `LlmRequest` to the `LlmProvider`
   chosen by the routing table (task → `(provider, model)`) and gets candidate
   insights back.
5. **Validate & attribute** — each insight is Zod-validated, keyed to a finding
   id (or a new `analysis.*` id), and stamped with `model@version` +
   `promptVersion`. Malformed model output is dropped, not trusted.
6. **Fold** — compute `augmentedScore` from the *validated* insights (each
   weighted by confidence, itemized), leaving the deterministic `score`
   unchanged. Emit the augmented report.

### 5.4 How each surface invokes the layer

| Surface | Invocation | Token source | Gating |
|---|---|---|---|
| **CLI** | new `agentready analyze [path]` (deterministic `scan`/`diff` stay default + untouched) | config / env adapter | deterministic by default; `--gate-on augmented` opt-in |
| **GitHub Action** | new `analyze: true` input + provider inputs | GitHub Models via built-in `GITHUB_TOKEN` (default), or OIDC / secret | deterministic by default; `gate-on: augmented` opt-in |
| **MCP / host-delegated** | AgentReady exposes evidence + analyzer prompts as MCP tools; host's model reasons and returns insights | the host's — AgentReady holds no keys | n/a (advisory) |
| **Library (DI)** | `analyze(evidence, { provider })` | caller-injected `LlmProvider` | caller decides |

### 5.5 Configuration

Discovered through the existing data-only config mechanism (no executable
config). Off unless explicitly enabled; provider/model routing and budgets live
under an `analyze` key, e.g.:

```jsonc
{
  "analyze": {
    "enabled": false,
    "provider": "auto",              // auto-detect; or "github-models" | "openai-compat" | "anthropic" | "host"
    "routing": {                      // task → model, overriding the §7 defaults
      "triage": "claude-haiku-4-5",
      "contradiction": "claude-sonnet-4-6",
      "remediation": "claude-opus-4-8"
    },
    "budgets": { "perTaskTokens": 4000, "perRunTokens": 60000 },
    "cache": { "dir": ".agentready/analyze-cache" },
    "gateOn": "deterministic"         // or "augmented" (explicit opt-in)
  }
}
```

## 6. Token sources and real-world integration

The whole point of the abstraction is that "where do the tokens come from?" has
*different right answers* per context.

### 6.1 GitHub CI — more than just a secret
- **GitHub Models** *(natural CI default)* — call inference with the workflow's
  built-in `GITHUB_TOKEN` and `permissions: models: read`. No secret to manage;
  rate-limited, so best for the cheap triage tasks.
- **OIDC keyless federation** — the Action's OIDC token assumes an AWS/GCP/Azure
  role → Bedrock / Vertex / Azure OpenAI with **no stored long-lived keys**.
- **Repo/org secrets** — classic BYO provider key.
- **Self-hosted runner** pointing at a local model (Ollama/vLLM) → zero egress.

### 6.2 Agents that already have a token source (Claude Code, Cursor, custom)
Reuse *their* tokens; AgentReady holds none of its own.
- **Host-delegated via MCP** — AgentReady runs as an MCP server exposing the
  evidence + the judgment prompts; the host agent's own model does the reasoning.
- **Injected client (library DI)** — the host passes an `LlmProvider`
  implementation into the API and reuses its existing plumbing/billing.
- **Environment inheritance** — auto-detect the provider env the host already set
  (`ANTHROPIC_API_KEY`, an OpenAI-compatible gateway base-URL, etc.) and reuse it
  through the matching adapter.
- **Agent SDK subagent** — invoke the layer as a subagent inside an SDK-based agent.

### 6.3 Local / offline
- **OpenAI-compatible adapter** covers OpenAI itself *and* Ollama, vLLM, LM
  Studio, and gateways via a base-URL — the privacy-preserving, no-egress path,
  and the recommended default story for self-hosting.

### 6.4 Multiple providers / versions
Version-agnostic interface; models pinned per task; concurrent providers allowed;
every insight stamped with `model@version`; model + prompt + schema versions are
part of the cache key so versions never collide.

## 7. Recommended models per task

Defaults (overridable); all run at low temperature with structured output.

| Routing key | Task | Tier | Examples |
|---|---|---|---|
| `triage` | FP triage, instruction-quality scoring | small / fast | Haiku, GPT-4o-mini, Llama-3.1-8B (local), GitHub Models small tier |
| `contradiction` | Cross-doc contradiction / overlap | mid | Sonnet, GPT-4o, Llama-3.1-70B |
| `remediation` | Remediation / patch generation | strong | Opus / Sonnet, GPT-4-class |

The routing keys are the same ones used in the `analyze.routing` config (§5.5).
Escalate to a stronger model only on demand (e.g. remediation requested).

## 8. Efficiency and cost controls

- **Deterministic-first, LLM-on-subset** — only analyze evidence that exists and
  is ambiguous (judge `AGENTS.md` only if it exists; run contradiction checks
  only with ≥2 instruction surfaces).
- **Bounded, sliced inputs** — send the relevant files + a tree *summary*, never
  the whole repo; hard per-task token budgets.
- **Content-hash caching** — cache verdicts by `(model, promptVersion, inputHash)`.
  In CI most inputs are unchanged → mostly cache hits; `diff` mode only analyzes
  changed docs. The single biggest cost lever.
- **Batching** — combine small judgments into one structured call where context
  allows.
- **Fail-open** — any model error/timeout degrades to deterministic-only; never
  fails the scan or the CI gate.
- **Record/replay fixtures** — AgentReady's own tests never call live models.

## 9. Output contract and scoring

- The augmented report = the deterministic report **+** an `insights[]` array
  **+** an `augmentedScore` with a breakdown of which insights moved it.
- `augmentedScore` adjusts the deterministic score using *validated* insights
  (e.g. demote confirmed false positives, add quality deductions for a useless
  instruction file), each weighted by confidence and clearly itemized.
- The deterministic `score` is never mutated. Both scores, plus the model stamps,
  appear in JSON, Markdown, and (where meaningful) SARIF.

## 10. Privacy, trust, safety

- Opt-in; off by default. Loud documentation that content is sent to a model.
- Minimal egress (slices, not the repo); optional redaction; first-class local
  model path for zero egress.
- Fail-open; never gates CI on its own; deterministic path unaffected.
- Auditable (rationale + model stamp on every insight) and overridable.
- The never-execute guarantee is unchanged — the layer reads emitted evidence.

## 11. Evaluation and metrics (how we prove the layer is good)

This is a first-class workstream, not an afterthought:

- **Gold set** — a labeled corpus of repos/instruction files with human verdicts.
- **Agreement** — measure layer vs. human agreement (precision/recall, κ).
- **False-positive reduction** — does triage measurably cut noise without hiding
  real issues?
- **Confidence calibration** — do stated confidences match observed accuracy?
- **Benchmark correlation** — tie augmented findings to the planned bounded-task
  agent-friction benchmark (time, tokens, tool calls, reviewer intervention).
- **Regression guard** — record/replay fixtures pin prompt/response pairs so
  prompt or model changes are reviewable.

## 12. Delivery plan (epic → PRs)

This document is **PR 0** (design). Subsequent PRs, each independently
reviewable and shippable:

- **PR 0 — Design (this).** Doc + epic breakdown; backlog cross-link. ✅
- **PR A — Contracts.** ✅ Zod `LlmInsight` + augmented-report schemas (with
  compile-time drift guards), published JSON Schema (`schemas/llm-insight.json`,
  `schemas/augmented-report.json`), the `LlmProvider` port (types only), contract
  validators, and the `./analyze` library export. Lives in `lib/analyze/`; the
  deterministic core does not import it.
- **PR B — Package + provider abstraction.** ✅ Environment-based provider
  auto-detection (`detectProvider`) and the OpenAI-compatible adapter
  (`createOpenAiCompatProvider`) — one adapter covering hosted OpenAI and local
  servers (Ollama/vLLM/LM Studio) via a base URL, with injectable `fetch` for
  offline tests. Requests pin temperature 0 + JSON output; errors throw (the
  pipeline applies fail-open). Detection order: explicit base URL → Ollama →
  OpenAI key; none set ⇒ deterministic-only.
- **PR C — Efficiency spine.** ✅ Evidence slicing (`sliceFiles` +
  `summarizeEvidence`, byte-budgeted), the content-hash cache
  (`createFileCache`/`createMemoryCache`, key folds model + prompt + schema +
  input), token budgets (`createBudgetTracker`), the fail-open runner
  (`createRunner`: cache → budget → provider, never throws), and the
  record/replay provider (`createReplayProvider`/`createRecordingProvider`) so
  tests never hit a live model.
- **PR D — First analyzer + scoring.** ✅ The instruction-quality analyzer (the
  first Tier-2 judgment), `computeAugmentedScore` (folds validated insights,
  weighted by confidence, leaving the deterministic score untouched), the
  `analyzeReport` orchestrator (fail-open; deterministic-only without a
  provider), augmented-report reporters (summary + markdown, both showing both
  scores), and the `agentready analyze` CLI command with env-based provider
  auto-detection. End-to-end verified against a local OpenAI-compatible model.
- **PR E — GitHub-native CI.** GitHub Models adapter, Action wiring
  (`models: read`), and keyless-OIDC documentation.
- **PR F — Host integration.** MCP server / host-delegated path and the
  injected-client library API for agents that bring their own tokens.
- **PR G — More analyzers + routing.** Contradiction/overlap, false-positive
  triage, remediation; the task→model routing table.
- **PR H — Evaluation harness.** Gold set, metrics, and calibration reporting.

## 13. Open questions

- The exact `augmentedScore` formula and per-insight weighting.
- Gold-set sourcing and labeling process.
- Default model per tier (subject to availability/cost in each environment).
- Whether remediation patches are suggestions only, or optionally applied behind
  an explicit, reviewed flag.
