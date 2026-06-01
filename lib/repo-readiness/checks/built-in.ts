import type {
  LocalReadinessConfig,
  LocalReadinessFile,
  LocalReadinessReport,
  ReadinessFinding,
  ReadinessSeverity,
  SafetyCategory,
} from '../core/types'

type EvidenceForChecks = Omit<LocalReadinessReport, 'findings' | 'summary'>

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
  // recognized command ecosystem (Node, Make, Go, Rust, Python).
  const expectsCommands = report.commands.ecosystems.length > 0
  const isNode = report.commands.ecosystems.includes('node')
  const warningSeverity: ReadinessSeverity = config.errorOnWarnings ? 'error' : 'warning'

  if (report.docs.readme.length === 0) {
    findings.push({
      id: 'docs.readme.missing',
      title: 'Repository has no README',
      severity: 'error',
      recommendation: 'Add a root README with purpose, setup, validation commands, and common agent entrypoints.',
    })
  }

  if (report.docs.architecture.length === 0 && files.filter(file => file.source).length > 20) {
    findings.push({
      id: 'docs.architecture.missing',
      title: 'Non-trivial repository has no architecture documentation',
      // Informational: an explicit architecture/design doc is valuable for
      // agents but uncommon even in mature repos, so it should not drag the
      // score like a warning. Recognition is broad (ARCHITECTURE/DESIGN/
      // DEVELOPMENT/INTERNALS and design/architecture docs under docs/).
      severity: 'info',
      recommendation: 'Add architecture notes that explain module boundaries, data flow, and where agents should make changes.',
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
  if (report.ci.workflowFiles.length > 0 && ciParsedAnyCommand) {
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
    findings.push({
      id: `files.large:${file.path}`,
      title: 'Large checked-in file can create agent context friction',
      severity: file.sizeBytes > config.largeFileErrorBytes ? 'error' : warningSeverity,
      path: file.path,
      recommendation: 'Move large assets/data out of the main source tree or document why agents should ignore them.',
    })
  }

  for (const file of files.filter(file => file.minified && !config.allowMinifiedFiles)) {
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
