# AgentReady Sample Report: Improvement Plan Repository

> This is a compact illustrative report. It shows how AgentReady turns scanner
> findings into a maintainer checklist.

## Summary

- **Score:** 61 / 100
- **Findings:** 1 error, 5 warnings, 3 info
- **Verdict:** Agents can inspect the code, but they are likely to guess commands
  and over-read irrelevant context before making a safe change.

## Evidence highlights

- No root agent instruction file found.
- `README.md` exists but focuses on product usage, not development workflow.
- Package manager detected: npm.
- `package.json` has `build`, but no test or lint script.
- GitHub Actions workflow exists, but it runs a custom shell wrapper that cannot
  be mapped to local verification commands.
- `dist/` and `fixtures/generated/` contain large checked-in files.

## Findings

### `instructions.entrypoint.missing` — warning

No recognized agent instruction entrypoint was found.

Suggested remediation:

Create a short `AGENTS.md` with:

- project layout
- safe edit boundaries
- verification commands
- generated/vendor paths to avoid
- PR summary expectations

### `commands.test.missing` — error

The repository exposes source files but no discoverable test command.

Suggested remediation:

Add a local test command, even if it initially wraps existing tooling:

```json
{
  "scripts": {
    "test": "node --test"
  }
}
```

If tests cannot run locally, document the reason and expected CI-only gate.

### `ci.test.not-run` — warning

A CI workflow exists, but AgentReady cannot confirm that it runs the local test
surface.

Suggested remediation:

Prefer a CI step that calls the same command humans and agents should run:

```yaml
- name: Test
  run: npm test
```

### `files.generated.unmarked` — warning

Generated files are present but not clearly marked as generated, vendored, or
safe-to-ignore.

Suggested remediation:

- Add generated paths to `.gitignore` when they should not be tracked.
- Add comments, docs, or config ignores for intentionally tracked generated
  fixtures.
- Tell agents not to edit generated output directly.

### `files.large` — warning

Large files may consume context or distract agents from source changes.

Suggested remediation:

Classify them as fixtures, sample data, build artifacts, or unexpected blobs.
Use AgentReady config to ignore intentional fixtures only after documenting why.

## Prioritized maintainer checklist

1. Add `AGENTS.md` with safe edit and verification guidance.
2. Add or document a local `test` command.
3. Make CI call the same local command surface.
4. Mark generated and fixture paths so agents avoid editing them.
5. Re-run AgentReady and keep the GitHub Action in diff mode to catch
   regressions.
