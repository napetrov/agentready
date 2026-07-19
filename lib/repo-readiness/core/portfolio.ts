import { readdirSync } from 'fs'
import path from 'path'
import { computeExperimentalFindingFields } from './experimental-finding-fields'
import { scanLocalReadiness } from './scan-engine'
import type {
  LocalReadinessReport,
  PortfolioRepoResult,
  PortfolioReport,
  PortfolioScanOptions,
  PortfolioSummary,
  ReadinessFinding,
  ReadinessSeverity,
} from './types'

const SEVERITY_RANK: Record<ReadinessSeverity, number> = { info: 1, warning: 2, error: 3 }
const DEFAULT_TOP_FINDINGS_PER_REPO = 5

const emptySeverityCounts = (): Record<ReadinessSeverity, number> => ({ info: 0, warning: 0, error: 0 })

// Info findings are noise at portfolio scale (a large org will have hundreds);
// only warning/error findings are worth surfacing per repo in a summary meant
// to be skimmed across many repos at once.
const worstFindings = (findings: ReadinessFinding[], limit: number): ReadinessFinding[] =>
  findings
    .filter(finding => finding.severity !== 'info')
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.id.localeCompare(b.id))
    .slice(0, limit)

/**
 * Builds one repo's successful portfolio result from its full scan report.
 * `experimentalFindingFields` mirrors `topFindings` (not `report.findings`),
 * so it advertises exactly the nested keys this result actually serializes —
 * the same advertise-or-strip contract the scan report's `reportContract`
 * gives top-level findings. See ADR 0005.
 */
export const buildPortfolioRepoResult = (
  target: string,
  report: LocalReadinessReport,
  limit: number,
): Extract<PortfolioRepoResult, { ok: true }> => {
  const bySeverity = emptySeverityCounts()
  for (const finding of report.findings) bySeverity[finding.severity] += 1
  const topFindings = worstFindings(report.findings, limit)
  const experimentalFindingFields = computeExperimentalFindingFields(topFindings)
  return {
    path: target,
    ok: true,
    score: report.summary.score,
    findingCount: report.findings.length,
    bySeverity,
    topFindings,
    ...(experimentalFindingFields.length > 0 ? { experimentalFindingFields } : {}),
  }
}

/**
 * Resolves the repository paths a batch scan should cover: explicit `paths`,
 * plus — when `root` is set — every immediate, non-hidden subdirectory of
 * `root`. That shape matches how a platform team typically stages a
 * portfolio scan: one directory holding a clone of every repo. Deduplicated
 * by resolved absolute path, preserving first-seen order.
 */
export const resolvePortfolioTargets = (paths: string[], root?: string): string[] => {
  const candidates = [...paths]
  if (root) {
    const subdirectories = readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => path.join(root, entry.name))
      .sort()
    candidates.push(...subdirectories)
  }

  const seen = new Set<string>()
  const targets: string[] = []
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate)
    if (seen.has(resolved)) continue
    seen.add(resolved)
    targets.push(candidate)
  }
  return targets
}

/**
 * Scans every target independently via `scanLocalReadiness` and aggregates
 * the results into one portfolio-wide summary. One repo's failure (a bad
 * path, an unreadable config) is captured per-repo and never aborts the
 * batch — the whole point of a multi-repo scan is a complete picture even
 * when a handful of repos are broken.
 */
export const scanPortfolio = (targets: string[], options: PortfolioScanOptions = {}): PortfolioReport => {
  const generatedAt = (options.now ?? new Date()).toISOString()
  const limit = options.topFindingsPerRepo ?? DEFAULT_TOP_FINDINGS_PER_REPO

  const repos: PortfolioRepoResult[] = targets.map((target): PortfolioRepoResult => {
    try {
      const report = scanLocalReadiness(target, {
        now: options.now,
        configPath: options.configPath,
        config: options.config,
      })
      return buildPortfolioRepoResult(target, report, limit)
    } catch (error) {
      return { path: target, ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  const scanned = repos.filter((repo): repo is Extract<PortfolioRepoResult, { ok: true }> => repo.ok)
  const failed = repos.filter((repo): repo is Extract<PortfolioRepoResult, { ok: false }> => !repo.ok)
  const scores = scanned.map(repo => repo.score)

  const bySeverity = emptySeverityCounts()
  for (const repo of scanned) {
    bySeverity.info += repo.bySeverity.info
    bySeverity.warning += repo.bySeverity.warning
    bySeverity.error += repo.bySeverity.error
  }

  const summary: PortfolioSummary = {
    repoCount: targets.length,
    scannedCount: scanned.length,
    scanErrorCount: failed.length,
    averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    minScore: scores.length > 0 ? Math.min(...scores) : null,
    maxScore: scores.length > 0 ? Math.max(...scores) : null,
    totalFindings: scanned.reduce((sum, repo) => sum + repo.findingCount, 0),
    bySeverity,
  }

  // Scan failures need attention before any scored repo; among scored repos,
  // ascending score surfaces the weakest readiness first.
  const sortedScanned = [...scanned].sort((a, b) => a.score - b.score || a.path.localeCompare(b.path))

  return { generatedAt, repos: [...failed, ...sortedScanned], summary }
}
