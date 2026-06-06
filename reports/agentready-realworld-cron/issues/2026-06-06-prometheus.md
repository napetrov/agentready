# prometheus: suspected-agentready-false-positive

Run: 2026-06-06T20-42-13-862Z
Repo: https://github.com/prometheus/prometheus.git
Commit: 5e3c892bfc1209b739562f885a8cfa17c6cd7fa2
Score: 91
Artifacts: artifacts/2026-06-06T20-42-13-862Z/prometheus/agentready.json, artifacts/2026-06-06T20-42-13-862Z/prometheus/agentready.md

## Notes

- possible false positives: files.large:cmd/promtool/testdata/rules_large.yml (cmd/promtool/testdata/rules_large.yml)

## Confirmation

- Raw scan artifact: `artifacts/2026-06-06T20-42-13-862Z/prometheus/agentready.json` reports `files.large:cmd/promtool/testdata/rules_large.yml` as a warning, while `tsdb/testdata/20kseries.json` is already informational fixture data.
- Independent repo signal: at commit `5e3c892bfc1209b739562f885a8cfa17c6cd7fa2`, the path is Prometheus promtool testdata (`cmd/promtool/testdata/rules_large.yml`) beside other rule fixtures.
- Detector code path: `isLikelyIntentionalDataFixture` downgrades common fixture data extensions under `testdata`, but main currently omits `.yml`/`.yaml`.
- Minimized fixture and fix already exist in PR #52 (`fix/yaml-testdata-large-file`), which adds a Prometheus-shaped YAML testdata case and downgrades YAML/YML fixture data to info. Current PR checks are green.

## Independent Signals

- Tracked files: 1619
- Manifests: Makefile, compliance/go.mod, documentation/examples/Makefile, documentation/examples/remote_storage/Makefile, documentation/examples/remote_storage/go.mod, documentation/prometheus-mixin/Makefile, go.mod, internal/tools/go.mod, web/ui/mantine-ui/package.json, web/ui/mantine-ui/src/promql/tools/go.mod, web/ui/module/codemirror-promql/package.json, web/ui/module/lezer-promql/package.json, web/ui/package.json, web/ui/react-app/package.json
- Workflows: .github/workflows/automerge-dependabot.yml, .github/workflows/buf-lint.yml, .github/workflows/buf.yml, .github/workflows/check_release_notes.yml, .github/workflows/ci.yml, .github/workflows/codeql-analysis.yml, .github/workflows/container_description.yml, .github/workflows/fuzzing.yml, .github/workflows/govulncheck.yml, .github/workflows/lock.yml, .github/workflows/prombench.yml, .github/workflows/repo_sync.yml, .github/workflows/scorecards.yml, .github/workflows/stale.yml
- Agent instructions: AGENTS.md, CLAUDE.md
