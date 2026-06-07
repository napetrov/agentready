# typescript: suspected-agentready-false-positive

Run: 2026-06-06T09-55-52-882Z
Repo: https://github.com/microsoft/TypeScript.git
Commit: 7539c04d94b5adc924efb3f8fef90e4de18d39d3
Score: 0
Artifacts: artifacts/2026-06-06T09-55-52-882Z/typescript/agentready.json, artifacts/2026-06-06T09-55-52-882Z/typescript/agentready.md

## Notes

- possible false positives: files.large:tests/cases/fourslash/codeFixClassImplementInterfaceNoTruncation.ts (tests/cases/fourslash/codeFixClassImplementInterfaceNoTruncation.ts); files.large:tests/cases/fourslash/codeFixClassImplementInterfaceNoTruncationProperties.ts (tests/cases/fourslash/codeFixClassImplementInterfaceNoTruncationProperties.ts); files.large:tests/cases/fourslash/excessivelyLargeArrayLiteralCompletions.ts (tests/cases/fourslash/excessivelyLargeArrayLiteralCompletions.ts); files.large:tests/cases/fourslash/reallyLargeFile.ts (tests/cases/fourslash/reallyLargeFile.ts)

## Independent Signals

- Tracked files: 81368
- Manifests: package.json, tests/cases/projects/NodeModulesSearch/importHigher/node_modules/m2/package.json, tests/cases/projects/NodeModulesSearch/maxDepthExceeded/node_modules/m2/package.json, tests/cases/projects/NodeModulesSearch/maxDepthIncreased/node_modules/@types/m4/package.json, tests/cases/projects/NodeModulesSearch/maxDepthIncreased/node_modules/m2/package.json, tests/cases/projects/NodeModulesSearch/maxDepthIncreased/node_modules/m4/package.json
- Workflows: .github/workflows/accept-baselines-fix-lints.yaml, .github/workflows/ci.yml, .github/workflows/close-issues.yml, .github/workflows/codeql.yml, .github/workflows/copilot-setup-steps.yml, .github/workflows/create-cherry-pick-pr.yml, .github/workflows/insiders.yaml, .github/workflows/lkg.yml, .github/workflows/new-release-branch.yaml, .github/workflows/nightly.yaml, .github/workflows/pr-modified-files.yml, .github/workflows/release-branch-artifact.yaml, .github/workflows/scorecard.yml, .github/workflows/set-version.yaml, .github/workflows/sync-branch.yaml, .github/workflows/sync-wiki.yml, .github/workflows/twoslash-repros.yaml, .github/workflows/update-package-lock.yaml
- Agent instructions: .github/copilot-instructions.md, AGENTS.md, CLAUDE.md

