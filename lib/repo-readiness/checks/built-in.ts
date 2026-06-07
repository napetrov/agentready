import type {
  LocalReadinessConfig,
  LocalReadinessFile,
  LocalReadinessReport,
  ReadinessFinding,
  ReadinessSeverity,
  SafetyCategory,
} from '../core/types'

type EvidenceForChecks = Omit<LocalReadinessReport, 'findings' | 'summary'>

// A `docs/` or `doc/` directory anywhere in the tree (matched together with the
// file's `documentation` flag so a stray non-doc file under docs/ does not count
// as developer documentation).
const DOC_TREE = /(^|\/)docs?\//i

const SCIENTIFIC_DATA_EXTENSIONS = new Set([
  '.csv',
  '.htm',
  '.html',
  '.ipynb',
  '.tsv',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.lst',
  '.parquet',
  '.pbtxt',
  '.npy',
  '.npz',
  '.h5',
  '.hdf5',
  '.mtx',
])

const TEXT_FIXTURE_EXTENSIONS = new Set(['.log', '.out', '.txt'])

const isLikelyIntentionalDataFixture = (file: LocalReadinessFile): boolean => {
  const path = file.path.toLowerCase()
  const extension = file.extension.toLowerCase()
  const fixturePath = (
    /^data\/[^/]+$/.test(path)
    || /^data\/(examples?|samples?|fixtures?)\//.test(path)
    || /(^|\/)(examples?|samples?|notebooks?)\//.test(path)
    || /(^|\/)(examples?|samples?|notebooks?)\/.*\/data\//.test(path)
    || /(^|\/)(tests?|unit_tests?|testdata|fixtures?|golden|snapshots?)\//.test(path)
    || /(^|\/)(benchmarks?|[^/]*benchmark[^/]*|perf)\/(?:.*\/)?(data|fixtures?|golden|snapshots?)\//.test(path)
  )
  const textFixturePath = (
    /(^|\/)(tests?|unit_tests?|testdata|fixtures?|golden|snapshots?)\//.test(path)
    || /(^|\/)(benchmarks?|[^/]*benchmark[^/]*|perf)\/(?:.*\/)?(fixtures?|golden|snapshots?)\//.test(path)
  )
  const dataLikeExtension = SCIENTIFIC_DATA_EXTENSIONS.has(extension) || (textFixturePath && TEXT_FIXTURE_EXTENSIONS.has(extension))
  // Some C/C++ test fixtures encode large golden payloads directly in source.
  // Keep this filename check delimiter-bound so production sources are not
  // mistaken for fixture data.
  const sourceEncodedTestData =
    file.test
    && ['.c', '.cc', '.cpp', '.cxx', '.h', '.hpp'].includes(extension)
    && /(^|[._-])(test[_-]?data|data|fixture|fixtures|golden)([._-]|$)/.test(path.split('/').pop() ?? '')
  // Fuzz corpora often use extensionless seed inputs; keep this narrower than
  // "any file under corpus/" so source/config files still use normal severity.
  const extensionlessTestCorpusData =
    extension === ''
    && file.test
    && /(^|\/)([^/]+_)?corpus\//.test(path)
  if (!dataLikeExtension && !sourceEncodedTestData && !extensionlessTestCorpusData) return false

  return fixturePath || extensionlessTestCorpusData
}

/**
 * Evaluates collected evidence against the built-in readiness rules and emits
 * findings. Each rule keeps a stable `id` so reporters and diffs can track it
 * across runs.
 */
export const buildFindings = (
  files: LocalReadinessFile[],
  report: EvidenceForChecks,
  config: LocalReadinessConfig,
): ReadinessFinding[] => {
  const findings: ReadinessFinding[] = []
  // A repository "expects" verification commands when it exposes at least one
  // recognized command ecosystem (Node, Make, CMake, Bazel, Go, Rust, Python).
  const expectsCommands = report.commands.ecosystems.length > 0
  const isNode = report.commands.ecosystems.includes('node')
  const warningSeverity: ReadinessSeverity = config.errorOnWarnings ? 'error' : 'warning'

  // The agent entrypoint is the *root* README; a README nested under docs/ or a
  // subpackage is still useful but does not satisfy the top-level "start here"
  // surface. A root README has no path separator.
  const hasRootReadme = report.docs.readme.some(readmePath => !readmePath.includes('/'))
  if (!hasRootReadme) {
    findings.push({
      id: 'docs.readme.missing',
      title: 'Repository has no README',
      severity: 'error',
      recommendation: 'Add a root README with purpose, setup, validation commands, and common agent entrypoints.',
    })
  }

  // Broad developer-documentation signal (replaces the old, low-precision
  // `docs.architecture.missing`, which fired whenever a repo lacked a specific
  // ARCHITECTURE.md and tripped on ~11/16 well-documented OSS projects). We now
  // only flag a non-trivial repo when its *entire* developer-facing doc surface
  // is thin: no CONTRIBUTING, no architecture/design/development notes, and no
  // populated docs/ tree. A project with any of those is considered documented
  // and stays silent. Informational severity only — useful for agents but never
  // a score-gating gap.
  const sourceFileCount = files.filter(file => file.source).length
  const hasContributing = report.docs.contributing.length > 0
  const hasArchitectureDocs = report.docs.architecture.length > 0
  const hasDocsTree = files.some(file => DOC_TREE.test(file.path) && file.documentation)
  if (
    sourceFileCount > 20
    && !hasContributing
    && !hasArchitectureDocs
    && !hasDocsTree
  ) {
    findings.push({
      id: 'docs.developer.thin',
      title: 'Non-trivial repository has thin developer documentation',
      severity: 'info',
      recommendation:
        'Add developer-facing docs — a CONTRIBUTING guide, architecture/design notes, or a docs/ tree — that explain module boundaries, data flow, and where agents should make changes.',
    })
  }

  if (expectsCommands && !report.commands.hasTest) {
    findings.push({
      id: 'commands.test.missing',
      title: 'No test command detected',
      severity: 'error',
      recommendation: 'Expose a stable test command in package scripts or documented project tooling.',
    })
  }

  if (expectsCommands && !report.commands.hasLint) {
    findings.push({
      id: 'commands.lint.missing',
      title: 'No lint command detected',
      severity: warningSeverity,
      recommendation: 'Expose a lint command so agents can catch style and static analysis regressions before review.',
    })
  }

  if (isNode && !report.commands.hasTypeCheck && files.some(file => ['.ts', '.tsx'].includes(file.extension))) {
    findings.push({
      id: 'commands.typecheck.missing',
      title: 'TypeScript repository has no type-check command',
      severity: warningSeverity,
      recommendation: 'Expose a type-check command and run it in CI.',
    })
  }

  if (report.ci.workflowFiles.length === 0) {
    findings.push({
      id: 'ci.workflow.missing',
      title: 'No CI workflow detected',
      severity: warningSeverity,
      recommendation: 'Add CI that runs install, lint, type-check, tests, and build where applicable.',
    })
  }

  // "Command exists but CI never runs it" checks. These only fire when a
  // workflow is present and we successfully recognized at least one verification
  // command in it — otherwise our parse is low-confidence (e.g. CI runs entirely
  // through composite/marketplace actions we do not classify) and we stay silent
  // rather than emit a false positive. A per-kind orchestrator set scopes the
  // remaining uncertainty: a kind dispatched through a task runner we cannot
  // decompose (tox, make, `uv run`, … cover every kind; `pre-commit` covers only
  // lint/type-check) is skipped, so one orchestrator step no longer silences
  // unrelated checks.
  //
  // These checks are inherently heuristic — recognizing every way a command can
  // be invoked in a workflow is open-ended — so they are emitted at `info`
  // severity only. They surface a likely CI-coverage gap for a human to confirm;
  // they never gate the score like a warning/error and should not be treated as
  // authoritative.
  const orchestratorCovers = new Set(report.ci.orchestratorKinds)
  // We "recognized" the workflow when we classified a concrete command OR
  // identified an orchestrator (e.g. a `pre-commit run` step, which sets
  // orchestratorKinds but no has* flag). Either is enough confidence to reason
  // about which kinds CI does not run; without both we stay silent.
  const ciParsedAnyCommand =
    report.ci.hasInstall
    || report.ci.hasLint
    || report.ci.hasTypeCheck
    || report.ci.hasTest
    || report.ci.hasBuild
    || orchestratorCovers.size > 0
  // Single-job confidence gate. When recognized verification commands are spread
  // across more than one job (a multi-job pipeline or an OS/toolchain matrix that
  // splits lint/test/build into separate jobs), a kind we did NOT recognize is
  // plausibly run in another job — through a marketplace action, a matrix leg, or
  // a wrapper script the parser cannot classify. In that case `ci.X.not-run`
  // would be a false positive (seen on repos like ripgrep/gin), so we only emit
  // the not-run findings when concrete verification commands are concentrated in
  // at most one job. A job counts only if it ran a *concrete* verification kind
  // (`job.concreteKinds`, which already excludes kinds covered solely through an
  // orchestrator such as `pre-commit/action`, `tox`, or `make ci`), other than
  // `install` — a dedicated `npm ci` job introduces no uncertainty. Because the
  // tracking is per-step, a job that runs `npm run lint` concretely still counts
  // even when another step in the same job is an opaque orchestrator that also
  // covers lint. This stops install-only and orchestrator-only jobs from
  // spuriously inflating the spread and suppressing unrelated checks.
  const concreteVerificationJobs = report.ci.workflows
    .flatMap(workflow => workflow.jobs)
    .filter(job => job.concreteKinds.some(kind => kind !== 'install')).length
  const commandsConcentratedInOneJob = concreteVerificationJobs <= 1
  if (report.ci.workflowFiles.length > 0 && ciParsedAnyCommand && commandsConcentratedInOneJob) {
    if (report.commands.hasTest && !report.ci.hasTest && !orchestratorCovers.has('test')) {
      findings.push({
        id: 'ci.test.not-run',
        title: 'Tests are available but CI does not run them',
        severity: 'info',
        recommendation: 'Run the test command in CI so regressions are caught before review.',
      })
    }

    if (report.commands.hasLint && !report.ci.hasLint && !orchestratorCovers.has('lint')) {
      findings.push({
        id: 'ci.lint.not-run',
        title: 'A lint command is available but CI does not run it',
        severity: 'info',
        recommendation: 'Run the lint command in CI so style and static-analysis regressions are caught automatically.',
      })
    }

    if (report.commands.hasTypeCheck && !report.ci.hasTypeCheck && !orchestratorCovers.has('typecheck')) {
      findings.push({
        id: 'ci.typecheck.not-run',
        title: 'A type-check command is available but CI does not run it',
        severity: 'info',
        recommendation: 'Run the type-check command in CI so type regressions are caught before review.',
      })
    }

    if (report.commands.hasBuild && !report.ci.hasBuild && !orchestratorCovers.has('build')) {
      findings.push({
        id: 'ci.build.not-run',
        title: 'A build command is available but CI does not run it',
        severity: 'info',
        recommendation: 'Consider running the build in CI so broken builds are caught before review.',
      })
    }
  }

  if (report.instructions.length === 0) {
    findings.push({
      id: 'instructions.missing',
      title: 'No agent instruction surface detected',
      severity: warningSeverity,
      recommendation: 'Add AGENTS.md or the relevant agent-specific instruction file with repo conventions and validation commands.',
    })
  }

  for (const surface of report.instructions.filter(surface => surface.localPrivate)) {
    findings.push({
      id: `instructions.local-private:${surface.path}`,
      title: 'Local/private agent instruction file is present',
      severity: warningSeverity,
      path: surface.path,
      recommendation: 'Keep local-private instruction files out of shared repository history unless this is intentional.',
    })
  }

  for (const file of files.filter(file => file.sizeBytes > config.largeFileWarningBytes && !file.generated)) {
    const intentionalDataFixture = isLikelyIntentionalDataFixture(file)
    // A large *binary* asset (image, video, PDF, archive, model weights,
    // installer) is repo bloat, but an agent never loads it into its text
    // context, so it is not the "context friction" this check targets. Surface it
    // at info rather than dragging the score/gate like a large text/source file —
    // otherwise a presentations or C#/desktop repo full of legitimate binaries
    // scores near zero purely from assets an agent would never read.
    const binaryAsset = file.binary && !intentionalDataFixture
    const title = intentionalDataFixture
      ? 'Large checked-in example or fixture data can create agent context friction'
      : binaryAsset
        ? 'Large binary asset is checked into the repository'
        : 'Large checked-in file can create agent context friction'
    const severity: ReadinessSeverity = intentionalDataFixture || binaryAsset
      ? 'info'
      : file.sizeBytes > config.largeFileErrorBytes
        ? 'error'
        : warningSeverity
    findings.push({
      id: `files.large:${file.path}`,
      title,
      severity,
      path: file.path,
      recommendation: intentionalDataFixture
        ? 'Keep intentional sample data documented and consider AgentReady ignore paths if agents do not need to inspect it.'
        : binaryAsset
          ? 'Keep large binaries out of the source tree (use releases, Git LFS, or external storage), or add an AgentReady ignore path if intentional.'
          : 'Move large assets/data out of the main source tree or document why agents should ignore them.',
    })
  }

  for (const file of files.filter(file => file.minified && !file.generated && !config.allowMinifiedFiles)) {
    findings.push({
      id: `files.minified:${file.path}`,
      title: 'Minified file is checked into the repository',
      severity: warningSeverity,
      path: file.path,
      recommendation: 'Prefer generated build output outside source control, or ignore it in AgentReady policy if intentional.',
    })
  }

  // Safety signals describe which package scripts are unsafe for an agent to run
  // blindly. Genuinely dangerous patterns (destructive shell commands, piping a
  // network download into a shell) are warnings; install-time hooks and
  // deploy/publish paths are informational so agents know they exist.
  const safetyTitles: Record<SafetyCategory, string> = {
    'install-hook': 'Install lifecycle script runs automatically',
    destructive: 'Package script runs a destructive command',
    'network-exec': 'Package script pipes a network download into a shell',
    deploy: 'Package script deploys or publishes',
  }
  const safetySeverity: Record<SafetyCategory, ReadinessSeverity> = {
    'install-hook': 'info',
    destructive: warningSeverity,
    'network-exec': warningSeverity,
    deploy: 'info',
  }
  for (const signal of report.safetySignals) {
    findings.push({
      id: `safety.${signal.category}:${signal.source}`,
      title: safetyTitles[signal.category],
      severity: safetySeverity[signal.category],
      path: 'package.json',
      recommendation: `${signal.notes[0]} Document whether agents may run "${signal.script}", and gate it behind explicit review if it is unsafe.`,
    })
  }

  return findings.sort((a, b) => a.id.localeCompare(b.id))
}
