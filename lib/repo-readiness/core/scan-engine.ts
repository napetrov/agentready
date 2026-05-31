import path from 'path'
import { buildFindings } from '../checks/built-in'
import { detectCapabilitySurfaces } from '../detectors/capability-surfaces'
import { detectCiWorkflows } from '../detectors/ci-workflows'
import { detectCommandSurfaces } from '../detectors/command-surfaces'
import { detectDocs } from '../detectors/docs'
import { walkFiles } from '../detectors/file-inventory'
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
  ScanOptions,
} from './types'
import { uniqueSorted } from './util'

export function scanLocalReadiness(root: string, options: ScanOptions = {}): LocalReadinessReport {
  const absoluteRoot = path.resolve(root)
  const config = loadConfig(absoluteRoot, options)
  const files = walkFiles(absoluteRoot, config)
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
    findings,
  }
}

const findingKey = (finding: ReadinessFinding): string => `${finding.id}|${finding.path ?? ''}`

export function diffLocalReadiness(root: string, options: DiffOptions): ReadinessDiffReport {
  const generatedAt = (options.now ?? new Date()).toISOString()
  const scanOptions: ScanOptions = { now: options.now, configPath: options.configPath, config: options.config }

  const baseReport = withWorktree(root, options.base, worktree => scanLocalReadiness(worktree, scanOptions))
  const headReport = withWorktree(root, options.head, worktree => scanLocalReadiness(worktree, scanOptions))

  const baseFindingsByKey = new Map(baseReport.findings.map(finding => [findingKey(finding), finding]))
  const headFindingsByKey = new Map(headReport.findings.map(finding => [findingKey(finding), finding]))
  const newFindings = headReport.findings.filter(finding => !baseFindingsByKey.has(findingKey(finding)))
  const resolvedFindings = baseReport.findings.filter(finding => !headFindingsByKey.has(findingKey(finding)))
  const regressions = newFindings.filter(finding => finding.severity === 'error' || finding.severity === 'warning')

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
