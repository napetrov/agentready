import { statSync } from 'fs'
import path from 'path'
import { buildFindings } from '../checks/built-in'
import { calculateDimensionScores } from '../checks/catalog'
import { detectCapabilitySurfaces } from '../detectors/capability-surfaces'
import { detectCiWorkflows } from '../detectors/ci-workflows'
import { detectCommandSurfaces } from '../detectors/command-surfaces'
import { detectDocs } from '../detectors/docs'
import { walkFiles } from '../detectors/file-inventory'
import { buildDesignState, detectRepositoryEvidence } from '../detectors/repository-evidence'
import { detectSafetySignals } from '../detectors/safety-signals'
import {
  detectInstructionSurfaces,
  type RepositoryFileReference,
} from '../detectors/instruction-surface'
import { loadConfig } from './config'
import { withWorktree } from './git'
import { calculateScore } from './scoring'
import type {
  CompactLocalReadinessReport,
  CompactReadinessDiffReport,
  DiffOptions,
  LocalReadinessReport,
  ReadinessDiffReport,
  ReadinessFinding,
  ReadinessSeverity,
  ScanOptions,
} from './types'
import { uniqueSorted } from './util'

// Orders severities so a diff can tell when a persistent finding has worsened.
const SEVERITY_RANK: Record<ReadinessSeverity, number> = { info: 1, warning: 2, error: 3 }

export function scanLocalReadiness(root: string, options: ScanOptions = {}): LocalReadinessReport {
  const absoluteRoot = path.resolve(root)
  // Fail loudly on an invalid target. Without this guard, fast-glob silently
  // yields no files for a missing path or a regular file, producing a phantom
  // "empty repository" report instead of an error.
  let stat
  try {
    stat = statSync(absoluteRoot)
  } catch {
    throw new Error(`AgentReady: cannot scan "${root}": path does not exist`)
  }
  if (!stat.isDirectory()) {
    throw new Error(`AgentReady: cannot scan "${root}": not a directory`)
  }
  const config = loadConfig(absoluteRoot, options)
  const files = walkFiles(absoluteRoot, config, { respectGitignore: options.respectGitignore })
  const filePaths = files.map(file => file.path)
  const instructionInput: RepositoryFileReference[] = files.map(file => ({
    path: file.path,
    sizeBytes: file.sizeBytes,
  }))

  const partialReport = {
    root: absoluteRoot,
    generatedAt: (options.now ?? new Date()).toISOString(),
    docs: detectDocs(filePaths),
    commands: detectCommandSurfaces(absoluteRoot, filePaths),
    ci: detectCiWorkflows(absoluteRoot, filePaths),
    instructions: detectInstructionSurfaces(instructionInput),
    capabilities: detectCapabilitySurfaces(filePaths),
    safetySignals: detectSafetySignals(absoluteRoot, filePaths),
    files,
  }

  const findings = buildFindings(files, partialReport, config)
  const repositoryEvidence = detectRepositoryEvidence(
    absoluteRoot,
    files,
    partialReport.commands,
    partialReport.ci,
    partialReport.instructions,
  )
  const designState = buildDesignState(repositoryEvidence, findings, partialReport.safetySignals)

  return {
    ...partialReport,
    summary: {
      score: calculateScore(findings),
      totalFiles: files.length,
      totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
      sourceFiles: files.filter(file => file.source).length,
      testFiles: files.filter(file => file.test).length,
      documentationFiles: files.filter(file => file.documentation).length,
      largeFiles: files.filter(file => file.sizeBytes > config.largeFileWarningBytes).length,
      binaryFiles: files.filter(file => file.binary).length,
      generatedFiles: files.filter(file => file.generated).length,
      minifiedFiles: files.filter(file => file.minified).length,
    },
    repositoryEvidence,
    designState,
    dimensions: calculateDimensionScores(findings),
    reportContract: {
      schemaVersion: 'local-readiness/v2',
      experimentalFields: ['repositoryEvidence', 'designState', 'dimensions'],
    },
    findings,
  }
}

const findingKey = (finding: ReadinessFinding): string => `${finding.id}|${finding.path ?? ''}`

export function diffLocalReadiness(root: string, options: DiffOptions): ReadinessDiffReport {
  const generatedAt = (options.now ?? new Date()).toISOString()
  // Worktrees contain only committed (tracked) files; git never ignores tracked
  // paths, so .gitignore filtering would wrongly drop checked-in files (and their
  // large/minified findings) from the diff.
  const scanOptions: ScanOptions = {
    now: options.now,
    configPath: options.configPath,
    config: options.config,
    respectGitignore: false,
  }

  const baseReport = withWorktree(root, options.base, worktree => scanLocalReadiness(worktree, scanOptions))
  const headReport = withWorktree(root, options.head, worktree => scanLocalReadiness(worktree, scanOptions))

  const baseFindingsByKey = new Map(baseReport.findings.map(finding => [findingKey(finding), finding]))
  const headFindingsByKey = new Map(headReport.findings.map(finding => [findingKey(finding), finding]))
  const newFindings = headReport.findings.filter(finding => !baseFindingsByKey.has(findingKey(finding)))
  const resolvedFindings = baseReport.findings.filter(finding => !headFindingsByKey.has(findingKey(finding)))
  const isGateable = (finding: ReadinessFinding): boolean =>
    finding.severity === 'error' || finding.severity === 'warning'
  // A finding that persists at the same id+path but whose severity worsens is a
  // regression even though it is neither new nor resolved — e.g. a large binary
  // asset (info) replaced by a same-path large text/source file (warning), which
  // shares the `files.large:<path>` id. Without this, `--fail-on-regression`
  // would miss the escalation.
  const escalatedFindings = headReport.findings.filter(finding => {
    const base = baseFindingsByKey.get(findingKey(finding))
    return base !== undefined && isGateable(finding) && SEVERITY_RANK[finding.severity] > SEVERITY_RANK[base.severity]
  })
  const regressions = [...newFindings.filter(isGateable), ...escalatedFindings]

  return {
    base: options.base,
    head: options.head,
    generatedAt,
    baseReport,
    headReport,
    summary: {
      scoreDelta: headReport.summary.score - baseReport.summary.score,
      filesDelta: headReport.summary.totalFiles - baseReport.summary.totalFiles,
      bytesDelta: headReport.summary.totalBytes - baseReport.summary.totalBytes,
      findingsDelta: headReport.findings.length - baseReport.findings.length,
      newFindings: newFindings.length,
      resolvedFindings: resolvedFindings.length,
    },
    newFindings,
    resolvedFindings,
    regressions,
  }
}

export function compactReport(report: LocalReadinessReport): CompactLocalReadinessReport {
  const { files: _files, ...compact } = report
  return { ...compact }
}

export function compactDiffReport(report: ReadinessDiffReport): CompactReadinessDiffReport {
  return {
    ...report,
    baseReport: compactReport(report.baseReport),
    headReport: compactReport(report.headReport),
  }
}

export function listFindingIds(report: LocalReadinessReport): string[] {
  return uniqueSorted(report.findings.map(finding => finding.id))
}
