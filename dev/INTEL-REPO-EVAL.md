# Intel Repository Evaluation

Dogfood scans for the first AgentReady release candidate. Repositories were
cloned read-only into scratch space and scanned with:

```bash
npm run agentready -- scan <repo> --format json
```

Scanner branch: `release-prep-intel-dogfood`.

## Summary

| Repo | Score | Files | Ecosystems | Findings |
|---|---:|---:|---|---|
| `uxlfoundation/oneDAL` | 63 | 4009 | make | 0 error / 5 warning / 1 info |
| `uxlfoundation/scikit-learn-intelex` | 54 | 734 | python | 0 error / 6 warning / 2 info |

Both repositories have strong agent instruction coverage:

- `oneDAL`: 15 instruction surfaces, including root `AGENTS.md`,
  `.ci/AGENTS.md`, several path-scoped `AGENTS.md` files, and GitHub
  instruction files for build systems, C++ guidelines, docs, examples, and
  general repo behavior.
- `scikit-learn-intelex`: 16 instruction surfaces, including root `AGENTS.md`,
  `.ci/AGENTS.md`, path-scoped `AGENTS.md` files, and GitHub instruction files
  for build config, daal4py, oneDAL, sklearnex, source, and tests.

## oneDAL

Detected:

- command surface: build and test via repo CI script conventions next to the
  top-level `makefile`
- CI coverage: install, test, and build; opaque orchestrator coverage for lint,
  type-check, test, and build
- capability surface: `.editorconfig`

Findings:

- `commands.lint.missing` (warning): no stable local lint command detected
- `docs.architecture.missing` (info): no architecture/design/development doc
  detected by the current naming heuristics
- `files.large` (warnings):
  - `data/dbscan_dense.csv`
  - `data/qr.csv`
  - `data/svd.csv`
  - `docs/dalapi/doxypy/parser/compound.py`

Release-readiness read: no gate-blocking AgentReady findings after the scanner
fix. The remaining warnings look like either real context-friction signals
checked into the repository intentionally, or documentation/lint convention gaps
for humans to decide.

## scikit-learn-intelex

Detected:

- command surface: Python build, test, and lint config
- CI coverage: install, test, and build
- no capability surfaces beyond instructions

Findings:

- `ci.lint.not-run` (info): lint tooling/config exists, but CI lint execution
  was not detected
- `docs.architecture.missing` (info): no architecture/design/development doc
  detected by the current naming heuristics
- `files.large` (warnings):
  - `examples/daal4py/data/batch/df_classification_train.csv`
  - `examples/daal4py/data/batch/kmeans_dense.csv`
  - `examples/daal4py/data/batch/kmeans_init_dense.csv`
  - `examples/daal4py/data/batch/qr.csv`
  - `examples/daal4py/data/batch/svd.csv`
  - `examples/daal4py/data/distributed/kmeans_dense.csv`

Release-readiness read: no gate-blocking AgentReady findings. The remaining
signals are informational CI lint coverage plus large example data files.

## Scanner Fixes From This Run

- Python detector now matches tool names with token boundaries, so comments like
  `Copyright` no longer accidentally imply `pyright` type-check coverage.
- Python lint detection includes common config-only tools such as `black`,
  `isort`, `flake8`, `pylint`, `ruff`, and `numpydoc_validation` across
  `pyproject.toml` and `setup.cfg`.
- CI workflow detection recognizes shell/batch script conventions such as
  `.ci/scripts/test.sh`, `run_test.sh`, `run_test.bat`, `run_sklearn_tests.sh`,
  `.ci/scripts/build.sh`, and `build-doc.sh`.
- Makefile-backed repositories can expose build/test surfaces through adjacent
  CI scripts even when targets are generated or not named `build` / `test`.

