# AgentReady Real-World Cron

This directory tracks recurring real-world validation for AgentReady.

The cron runner samples real public repositories that do not already appear in
the ledger, clones them into the ignored `work/` scratch area, runs the local
AgentReady scanner, and writes:

- `artifacts/<run-id>/` - ignored per-run JSON/Markdown scan artifacts.
- `ledgers/YYYY-MM.jsonl` - tracked run ledger entries.
- `issues/*.md` - tracked candidate issues for suspected AgentReady bugs or
  repo-selection blockers that need a human/focused fix pass.
- `state.json` - ignored rotation state, so each run advances through unseen
  entries in the pool.

Repositories must not be repeated during the real-world validation campaign.
When every repository in `repo-pool.json` has already appeared in the ledger,
the runner stops and asks for new pool entries instead of wrapping around.

Run manually:

```bash
npm run agentready:realworld-cron -- --batch-size 3
```

Useful one-off flags:

```bash
npm run agentready:realworld-cron -- --repo tiny=https://github.com/pallets/itsdangerous.git --batch-size 1
npm run agentready:realworld-cron -- --reports-dir /tmp/agentready-realworld-cron --batch-size 5
```

Classification buckets:

- `product-readiness-evidence` - AgentReady found actionable readiness gaps in
  a real repository.
- `compatible-no-material-findings` - the repository scanned cleanly enough for
  the current policy.
- `suspected-agentready-false-positive` - a finding looks likely to be scanner
  noise based on independent path/context signals.
- `repo-selection-blocker` - clone/scan failed, or the selected repository did
  not produce a useful comparable scan.

If a suspected AgentReady bug is confirmed, the follow-up should be a focused
fix PR with the ledger entry and artifact path cited in the PR description.
