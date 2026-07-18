# Evaluation And Benchmarks

AgentReady should be judged by whether its findings predict real friction for
coding agents, not only by parser coverage or score stability.

## Status

**Delivered (scaffold only):** `npm run agentready:benchmark`
(`bin/agentready-evaluate.ts`) automates the deterministic half of the
"Minimal public benchmark" below — a fixed, profile-diverse 10-repo corpus
(`reports/evaluation/corpus.json`, one entry per profile in that section,
including AgentReady itself scanned in place), a scan of each repo, and an
aggregated `reports/evaluation/README.md` in the tracked-summary shape
described here (corpus table, finding counts by category, and a
`Repo`/`AgentReady signal`/`Observed agent friction`/`Decision` table).

**Not delivered, and not automatable by this tool:** giving the same bounded
task to real coding agents and recording their operational friction (task
success, tool calls, hallucinated commands, reviewer corrections). That step
requires actually running agents and a human judging the result — the
generated report marks the "Observed agent friction"/"Decision" columns and
the "Confirmed true/false positives" and "Missing signals" sections `TODO`
rather than inventing plausible-looking data. Completing this milestone for
real means a human (or a follow-up session with agent access) runs bounded
tasks against the corpus and fills those sections in by hand.

## Core question

For a bounded coding task in a repository, does the AgentReady report predict:

- whether the agent finds the right files and local conventions
- whether it chooses appropriate verification commands
- whether it avoids generated, vendored, dangerous, or irrelevant files
- how much reviewer intervention is needed
- whether the final result includes clear evidence

## Minimal public benchmark

Start with a small, repeatable corpus rather than a hosted dashboard:

1. Choose 10 repositories with different readiness profiles:
   - small Node/TypeScript package
   - Python package
   - mixed Python/C++ scientific project
   - CMake or Bazel C++ project
   - Java/Gradle or Maven project
   - mature OSS repo with good docs
   - repo with weak/no agent instructions
   - repo with large fixtures/generated files
   - repo with complex CI wrappers
   - AgentReady itself
2. Run deterministic `agentready scan --format json` and save raw artifacts
   outside the repository or as CI artifacts.
3. Summarize only stable facts in tracked docs: score, finding IDs, false
   positives, true positives, and notable blind spots.
4. Give the same bounded tasks to at least two coding agents.
5. Record operational metrics:
   - task success/failure
   - time and tool calls
   - files touched
   - verification commands attempted and passed
   - hallucinated commands or stale paths
   - reviewer corrections
   - final evidence quality
6. Compare report findings against observed friction.

## Tracked summary format

Use a compact markdown table for public summaries:

| Repo | AgentReady signal | Observed agent friction | Decision |
| --- | --- | --- | --- |
| `example/repo` | `commands.test.missing` | Agent guessed test command and failed | true positive |
| `example/repo` | `files.large.fixture` | Data fixture was intentional and documented | severity tune |

Keep raw logs, model transcripts, and per-run artifacts out of the tracked tree
unless they are sanitized fixtures created specifically for tests.

## Success criteria

A benchmark pass should answer three questions:

1. **Precision:** which findings wasted maintainer attention?
2. **Recall:** which agent failures were not predicted by the report?
3. **Actionability:** did the recommendation tell a maintainer what to change?

The near-term goal is not a single universal score. The goal is a credible loop:
real repos → findings → agent runs → false-positive/false-negative notes →
detector, policy, or documentation improvements.

## Feedback classification

The tracked-summary table above is enough for a public overview, but turning a
review into reusable calibration data needs a stricter shape: every finding a
reviewer looks at should land in exactly one bucket.

| Classification | Meaning |
| --- | --- |
| `true_positive` | AgentReady found the issue and assigned a useful severity. |
| `false_positive` | AgentReady reported it, but on review it was not actually a problem — a precision failure a maintainer should never have had to look at. |
| `false_negative` | The issue mattered but AgentReady did not report it. |
| `severity_mismatch` | AgentReady found it but ranked it too low (or too high). |
| `policy_mismatch` | Default severity is reasonable, but a stricter operating context (enterprise, autonomous-merge, ...) should treat it differently. |
| `not_observable_locally` | The repository's local contents cannot prove this either way (e.g. branch protection, required reviews) — AgentReady's local-first, non-networked scan guarantee means this can only be reported as unverified, never inferred. |

These records live in `reports/evaluation/calibration/`, one file per reviewed
repository, validated against
[`calibration-feedback.schema.json`](../../reports/evaluation/calibration/calibration-feedback.schema.json).
Each finding also carries an `affectedStage` (which point in an agent's
workflow it affects — `orient`, `bootstrap`, `navigate`, `edit`, `verify`,
`review`, `merge`, `deploy`) and a `verificationStatus` (whether an AgentReady
maintainer independently re-checked it, or it is carried as-reported from the
source review), so a record never silently reads as more verified than it is.
See [`reports/evaluation/calibration/README.md`](../../reports/evaluation/calibration/README.md)
for the full format and the first record
([`napetrov-AIReady.json`](../../reports/evaluation/calibration/napetrov-AIReady.json)):
a high-readiness repository (extensive agent instructions, sophisticated CI, a
passing AgentReady Action gate at a configured minimum score of 80) whose
manual review still surfaced several `false_negative` and `severity_mismatch`
findings. That gap between an already-high score and a deeper expert review is
exactly the calibration signal this loop exists to capture — see
[docs/roadmap/v0.4-issue-drafts.md](../roadmap/v0.4-issue-drafts.md) for the
backlog it motivates.

## First milestone

`npm run agentready:benchmark` generates `reports/evaluation/README.md` with
these already filled in:

- the 10-repo corpus
- the command used to scan each repo
- finding counts by category

What still needs a human/agent-run pass to complete the milestone for real:

- three confirmed true positives
- three confirmed false positives or severity adjustments
- two missing signals to add next

That gives users evidence that AgentReady is calibrated against actual agent
work rather than only internal fixtures.
