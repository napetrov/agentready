# Real-repository evaluation

A periodic sanity check: run AgentReady's deterministic scan over a spread of
popular open-source projects, tally the findings, and judge precision. This is
how detector false positives and coverage gaps get found before they reach
users. It complements the offline gold-corpus eval (`bin/agentready-eval.ts`),
which guards the LLM layer's plumbing; this doc is about the *deterministic*
checks on real code.

The repositories are cloned read-only into a scratch directory and scanned with
`agentready scan <repo> --format json`. Nothing is pushed; the projects are not
vendored.

## Run: 16 repositories, 6 ecosystems

Scanner: the orchestrator-aware CI detector with `docs.architecture`/`ci.not-run`
at info severity and the cross-ecosystem lockfile exemption. Deterministic scan
only (no LLM layer). No scan crashed; no stderr on any repo.

| Repo | Stack | Score | Files | e/w/i | Findings (rule ids) |
|---|---|--:|--:|---|---|
| csharplang | C#/.NET | 72 | 899 | 0/4/0 | ci.workflow.missing, files.large×2, instructions.missing |
| got | Node/TS | 73 | 120 | 0/3/3 | ci.build.not-run, commands.lint/typecheck.missing, docs.architecture, instructions, safety.install-hook |
| chalk | Node | 79 | 34 | 0/3/0 | commands.lint/typecheck.missing, instructions.missing |
| fastapi | Python | 79 | 2977 | 0/3/0 | files.large, instructions.missing |
| zod | TS | 83 | 579 | 0/1/5 | ci.build/lint.not-run, commands.typecheck.missing, docs.architecture, safety.install-hook |
| requests | Python | 84 | 128 | 0/2/1 | docs.architecture, files.large, instructions.missing |
| gin | Go | 87 | 130 | 0/1/3 | ci.build/typecheck.not-run, docs.architecture, instructions.missing |
| ripgrep | Rust | 87 | 221 | 0/1/3 | ci.lint/test.not-run, docs.architecture, instructions.missing |
| cobra | Go | 91 | 66 | 0/1/1 | docs.architecture, instructions.missing |
| express | Node/JS | 91 | 213 | 0/1/1 | docs.architecture, instructions.missing |
| fd | Rust | 91 | 57 | 0/1/1 | docs.architecture, instructions.missing |
| fzf | Go | 91 | 151 | 0/1/1 | docs.architecture, instructions.missing |
| gson | Java | 91 | 311 | 0/1/1 | docs.architecture, instructions.missing |
| okhttp | Java | 91 | 794 | 0/1/1 | docs.architecture, instructions.missing |
| click | Python | 93 | 150 | 0/1/0 | instructions.missing |
| flask | Python | 93 | 236 | 0/1/0 | instructions.missing |

Mean score ≈ 86.

## What works (high-value, accurate)

- **`instructions.missing` — the headline.** 15 of 16 popular, well-run projects
  have **no** agent instruction surface; only zod ships `AGENTS.md` (correctly
  detected). This is exactly the gap AgentReady exists to surface, and it is
  accurate.
- **`files.large`** — every remaining hit is a real checked-in binary (a 2.1 MB
  `.ai`, a 2 MB PNG, a 4 MB PDF, a 1.2 MB SVG). The one earlier false positive
  (fastapi's `uv.lock`) is fixed by the cross-ecosystem lockfile exemption.
- **Ecosystem gating** correctly avoids spurious "missing test/lint" findings on
  Java/.NET repos with no recognized ecosystem.
- **Robustness** — clean scans on 6 languages, including a 2977-file monorepo
  (fastapi) and an 899-file docs repo (csharplang).

## Weak spots (now info severity, low harm)

- **`docs.architecture.missing` (≈11/16)** — lowest-precision rule; effectively
  "most repos lack a dedicated ARCHITECTURE.md." Now info. Candidate to retire or
  fold into a broader docs-quality signal.
- **Residual `ci.*.not-run`** on ripgrep/gin — cross-job / matrix CI command
  attribution is still imperfect; mitigated by info severity.

## Coverage gaps (not wrong, but limit usefulness)

- **Java/Gradle/Maven and .NET are blind spots** — gson, okhttp, and csharplang
  get `ecosystems: none`, so their reports are thin (only instructions +
  architecture). This is the single biggest applicability gap.
- **Monorepos** (zod, fastapi) are scanned as a single root; per-package
  structure isn't modeled.

## Score distribution

After moving `ci.*.not-run` and `docs.architecture` to info, the score is
dominated by `instructions.missing` and the occasional `files.large` /
`commands.*`. Healthy repos cluster at 91–93 — readable, but not very
discriminating. An instruction-*quality* signal (deterministic heuristics +
the optional LLM layer) would spread the distribution.

## Follow-ups (priority order)

1. Java/Gradle/Maven + .NET detectors — biggest applicability win. _(deferred)_
2. Retire or rework `docs.architecture.missing` — lowest-precision rule. _(S)_
3. Cross-job / matrix CI attribution, or gate `not-run` on single-job
   confidence — removes the ripgrep/gin residue. _(M)_
4. Instruction-quality signal to make the score discriminate among the 91–93
   cluster. _(M/L)_

## Headline

The core thesis holds: **15 of 16 popular, well-run OSS projects have no agent
instruction surface**, and AgentReady flags that cleanly with zero crashes and
near-zero false positives on its high-value rules. The clearest path to broader
usefulness is more ecosystem detectors, not more heuristic tuning.
