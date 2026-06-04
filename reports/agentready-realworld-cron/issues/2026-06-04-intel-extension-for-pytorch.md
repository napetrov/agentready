# intel-extension-for-pytorch: suspected-agentready-false-positive

Run: 2026-06-04T17-15-43-532Z
Repo: https://github.com/intel/intel-extension-for-pytorch.git
Commit: 6d3ba89cf9c40eb7184d6092ab7fa9b5231553c1
Score: 8
Artifacts: artifacts/2026-06-04T17-15-43-532Z/intel-extension-for-pytorch/agentready.json, artifacts/2026-06-04T17-15-43-532Z/intel-extension-for-pytorch/agentready.md

## Notes

- possible false positives: files.large:examples/cpu/inference/python/models/bert_large/inference/cpu/configure.json (examples/cpu/inference/python/models/bert_large/inference/cpu/configure.json); files.large:examples/cpu/inference/python/models/dlrm/int8_configure.json (examples/cpu/inference/python/models/dlrm/int8_configure.json); files.large:examples/cpu/usecase_spacenet5/20230303_consolvo_spacenet5_ipex.html (examples/cpu/usecase_spacenet5/20230303_consolvo_spacenet5_ipex.html); files.large:examples/cpu/usecase_spacenet5/20230303_consolvo_spacenet5_ipex.ipynb (examples/cpu/usecase_spacenet5/20230303_consolvo_spacenet5_ipex.ipynb)

## Triage

- Confirmed AgentReady false positive: large example config/report/notebook artifacts were score-gating as warnings/errors even though the built-in policy already treats intentional example/fixture data as informational.
- Evidence: raw scan artifact `artifacts/2026-06-04T17-15-43-532Z/intel-extension-for-pytorch/agentready.json`; independent inventory paths under `examples/cpu/...`; minimized fixture added in `__tests__/local-readiness.test.ts`.
- Verification after fix: temporary real-world re-scan `2026-06-04T17-19-29-063Z` reclassified intel-extension-for-pytorch as `product-readiness-evidence` with no `suspected-agentready-false-positive` notes and improved score from 8 to 61.

## Independent Signals

- Tracked files: 1490
- Manifests: CMakeLists.txt, csrc/CMakeLists.txt, csrc/cpu/CMakeLists.txt, csrc/cpu/aten/CMakeLists.txt, csrc/cpu/autocast/CMakeLists.txt, csrc/cpu/comm/CMakeLists.txt, csrc/cpu/dyndisp/CMakeLists.txt, csrc/cpu/ideep/CMakeLists.txt, csrc/cpu/isa/CMakeLists.txt, csrc/cpu/jit/CMakeLists.txt, csrc/cpu/runtime/CMakeLists.txt, csrc/cpu/toolkit/CMakeLists.txt, csrc/cpu/tpp/CMakeLists.txt, csrc/cpu/utils/CMakeLists.txt, csrc/jit/CMakeLists.txt, csrc/utils/CMakeLists.txt, docs/Makefile, docs/requirements.txt, examples/cpu/inference/cpp/CMakeLists.txt, examples/cpu/inference/python/models/dlrm/CMakeLists.txt, examples/cpu/inference/python/models/dlrm/torchrec/csrc/CMakeLists.txt, examples/cpu/inference/python/models/dlrm/torchrec/csrc/dynamic_embedding/CMakeLists.txt, examples/cpu/inference/python/models/dlrm/torchrec/csrc/dynamic_embedding/details/redis/CMakeLists.txt, examples/cpu/inference/python/models/dlrm/torchrec/inference/CMakeLists.txt, examples/cpu/llm/fine-tuning/requirements.txt, examples/cpu/llm/requirements.txt, intel_extension_for_pytorch/csrc/CMakeLists.txt, intel_extension_for_pytorch/csrc/cpu/CMakeLists.txt, intel_extension_for_pytorch/csrc/xpu/CMakeLists.txt, requirements.txt, tests/cpu/cpp/CMakeLists.txt, tests/cpu/isa/CMakeLists.txt, tools/linter/clang_tidy/requirements.txt
- Workflows: .github/workflows/format-check.yml
- Agent instructions: none
