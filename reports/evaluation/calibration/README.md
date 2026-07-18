# Calibration Feedback

This directory holds the "human/agent judgment" half of the evaluation loop
described in [docs/product/evaluation.md](../../../docs/product/evaluation.md):

> real repositories -> findings -> agent runs -> false-positive/false-negative
> notes -> detector, policy, or documentation improvements

`reports/evaluation/corpus.json` and `npm run agentready:evaluate` automate the
*deterministic* half of that loop (scan a fixed corpus, aggregate finding
counts). They cannot automate this half: a human or agent has to actually read
a repository (or work in it) and judge whether AgentReady's report matched
reality. That judgment is recorded here as structured data instead of only as
narrative review comments, so it accumulates into a reusable labeled dataset.

## Format

Each file is one calibration feedback record for one repository, validated
against [`calibration-feedback.schema.json`](./calibration-feedback.schema.json).
Every finding in a record is classified into exactly one bucket:

| Classification | Meaning |
| --- | --- |
| `true_positive` | AgentReady found the issue and assigned a useful severity. |
| `false_negative` | The issue mattered but AgentReady did not report it. |
| `severity_mismatch` | AgentReady found it but ranked it too low (or too high). |
| `policy_mismatch` | Default severity is reasonable, but a stricter operating context (enterprise, autonomous-merge, ...) should treat it differently. |
| `not_observable_locally` | The repository's local contents cannot prove this either way (e.g. branch protection) — AgentReady's local-first, non-networked scan guarantee means this can only be reported as unverified, never inferred. |

Every finding also carries a `verificationStatus`: whether an AgentReady
maintainer independently re-checked it against the repository, or it is
carried as-reported from the source review
(`reported-by-reviewer-not-independently-verified`). A record is never allowed
to read as more verified than it actually is.

This shape is intentionally separate from `schemas/*.schema.json` (AgentReady's
runtime report contract, generated from Zod by `bin/agentready-emit-schemas.ts`).
A calibration record is hand-authored input to the benchmark/backlog process,
not scanner output.

## Records

- [`napetrov-AIReady.json`](./napetrov-AIReady.json) — first calibration case.
  A "high-readiness but still operationally nuanced" repository: extensive
  agent instructions, sophisticated CI, and a dedicated AgentReady GitHub
  Action gate that passed at a configured minimum score of 80. A deeper manual
  review still found a stale quick-start command, documentation drift between
  playbooks/scripts and the current implementation, an automatic session hook
  that executes branch-controlled installation code, thin high-risk-path
  ownership, and unverifiable branch-protection state — the gap this record
  exists to close. See
  [docs/roadmap/v0.4-issue-drafts.md](../../../docs/roadmap/v0.4-issue-drafts.md)
  for the backlog items it motivates.

## Adding a record

1. Copy the shape of an existing record.
2. Classify every finding using the table above — don't skip
   `not_observable_locally` findings just because AgentReady has no
   corresponding rule; recording the gap is the point.
3. Set `verificationStatus` honestly per finding.
4. Link the record from this README and, if it motivates new detector/policy
   work, from a roadmap issue draft.
