import type {
  LocalReadinessConfig,
  LocalReadinessFile,
  LocalReadinessReport,
  ReadinessFinding,
  ReadinessSeverity,
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
      severity: warningSeverity,
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

  return findings.sort((a, b) => a.id.localeCompare(b.id))
}
