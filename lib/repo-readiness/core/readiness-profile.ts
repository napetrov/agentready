import { NOT_VERIFIED_EXTERNAL_CONTROLS } from './not-verified'
import type {
  AxisAssessment,
  CapabilitySurfaceEvidence,
  CapabilityRiskTier,
  CoverageReport,
  CoverageSurfaceKind,
  LocalReadinessReport,
  ObservabilityReport,
  ReadinessProfile,
  RiskVerdict,
} from './types'

// The report fields the profile is derived from. Taking a subset (rather than a
// full `LocalReadinessReport`) lets the scan engine compute the profile from the
// report it is still assembling, before `readinessProfile` itself exists.
type ProfileInput = Omit<LocalReadinessReport, 'readinessProfile'>

/**
 * Aggregates per-surface capability tiers into one verdict: the worst tier
 * present, because risk is about the single most dangerous capability an agent
 * can reach — one `high` surface is not diluted by ten `low` ones. A repo with
 * no capability surfaces is a verified `low` (empty `evidenceRefs`, the absence
 * carried in `explanation`), never `unknown`. See ADR 0005.
 */
const worstTier = (tiers: CapabilityRiskTier[]): CapabilityRiskTier => {
  if (tiers.includes('high')) return 'high'
  if (tiers.includes('medium')) return 'medium'
  return 'low'
}

// A `high` surface always has a matching `safety.capability.high-risk:<path>`
/**
 * Builds a stable evidence reference for a capability surface. A `high` surface
 * always has a matching `safety.capability.high-risk:<path>` finding, so
 * reference that stable id; `medium`/`low` surfaces have no finding (and
 * `CapabilitySurfaceEvidence` has no native id), so reference the deterministic
 * ADR-0000 derived key. Either way the ref is reproducible.
 */
const capabilityRef = (surface: CapabilitySurfaceEvidence): string =>
  surface.riskTier === 'high'
    ? `safety.capability.high-risk:${surface.path}`
    : `capability:${surface.path}:${surface.kind}`

/**
 * Builds the risk axis: the worst-tier verdict across the repo's capability
 * surfaces, the surfaces driving it as `evidenceRefs`, and a one-line
 * explanation. No surfaces is a verified `low` with empty refs, never `unknown`.
 */
const buildRisk = (capabilities: CapabilitySurfaceEvidence[]): AxisAssessment<RiskVerdict> => {
  if (capabilities.length === 0) {
    return {
      verdict: 'low',
      confidence: 'high',
      evidenceRefs: [],
      explanation: 'no capability surfaces detected',
    }
  }
  const tier = worstTier(capabilities.map(surface => surface.riskTier))
  const worst = capabilities.filter(surface => surface.riskTier === tier)
  return {
    verdict: tier,
    confidence: 'high',
    evidenceRefs: worst.map(capabilityRef),
    explanation: `${worst.length} ${tier}-blast-radius capability surface${worst.length === 1 ? '' : 's'}`,
  }
}

// The order surfaces are reported in; also the observability ordering.
const SURFACE_KINDS: CoverageSurfaceKind[] = [
  'instruction-surfaces',
  'command-ecosystems',
  'ci-workflows',
  'capability-surfaces',
  'governance',
  'documentation-roles',
  'repository-topology',
]

/**
 * Which `CoverageSurfaceKind`s the repo has at least one instance of. Presence
 * is per kind (not per file/record), so a monorepo with 40 command ecosystems
 * counts `command-ecosystems` exactly once.
 */
const applicableKinds = (report: ProfileInput): CoverageSurfaceKind[] => {
  const present = new Set<CoverageSurfaceKind>()
  if (report.instructions.length > 0) present.add('instruction-surfaces')
  if (report.commands.ecosystems.length > 0) present.add('command-ecosystems')
  if (report.ci.workflowFiles.length > 0) present.add('ci-workflows')
  if (report.capabilities.length > 0) present.add('capability-surfaces')
  if (report.governance.codeownersPath || report.governance.pullRequestTemplatePath) {
    present.add('governance')
  }
  if (report.repositoryEvidence.documentSurfaces.some(surface => surface.roleClaims.length > 0)) {
    present.add('documentation-roles')
  }
  if (report.repositoryEvidence.roots.length > 0) present.add('repository-topology')
  return SURFACE_KINDS.filter(kind => present.has(kind))
}

/**
 * Applicable surface kinds AgentReady recognized but could not fully assess,
 * with why. Today the only such case is CI: a workflow file that fails to parse
 * (or has no jobs section) yields `{ jobs: [] }`, so the scanner got no CI
 * verification signal from it. Counting those as assessed would report 100%
 * coverage (and `verifiedLocally` for CI) the scan did not earn, so they are
 * recorded as gaps instead. Other kinds have no partial-understanding failure
 * mode in the local pipeline yet.
 */
const coverageGaps = (
  report: ProfileInput,
  applicable: CoverageSurfaceKind[],
): CoverageReport['gaps'] => {
  const gaps: CoverageReport['gaps'] = []
  if (applicable.includes('ci-workflows')) {
    const unassessed = report.ci.workflows.filter(workflow => workflow.jobs.length === 0).length
    if (unassessed > 0) {
      gaps.push({
        surface: 'ci-workflows',
        reason: `${unassessed} workflow file${unassessed === 1 ? '' : 's'} with no recognized jobs`,
      })
    }
  }
  return gaps
}

/**
 * Builds the coverage axis: applicable surface kinds minus the gaps that were
 * recognized but not fully assessed. `ratio` is `assessedSurfaces /
 * applicableSurfaces`, defined as 1 when nothing is applicable (vacuously
 * complete), and drops below 1 when a gap is present.
 */
const buildCoverage = (applicable: CoverageSurfaceKind[], gaps: CoverageReport['gaps']): CoverageReport => {
  const gapped = new Set(gaps.map(gap => gap.surface))
  const applicableSurfaces = applicable.length
  const assessedSurfaces = applicable.filter(kind => !gapped.has(kind)).length
  return {
    applicableSurfaces,
    assessedSurfaces,
    ratio: applicableSurfaces === 0 ? 1 : assessedSurfaces / applicableSurfaces,
    gaps,
  }
}

/**
 * Builds the observability axis: applicable-and-assessed surface kinds are
 * verified locally, the rest of the taxonomy is not found, and platform controls
 * that cannot be confirmed offline are listed as not observable locally. A
 * recognized-but-unassessed kind (a coverage gap) is deliberately *not* verified.
 */
const buildObservability = (
  applicable: CoverageSurfaceKind[],
  gaps: CoverageReport['gaps'],
): ObservabilityReport => {
  const gapped = new Set(gaps.map(gap => gap.surface))
  return {
    verifiedLocally: applicable.filter(kind => !gapped.has(kind)),
    notFound: SURFACE_KINDS.filter(kind => !applicable.includes(kind)),
    notObservableLocally: [...NOT_VERIFIED_EXTERNAL_CONTROLS],
  }
}

/**
 * Builds the Repository Agent Readiness Profile from an assembled report. The
 * `readiness` axis reuses the already-computed `autonomyEnvelope` verbatim (so
 * the two are equal by construction), and `calibrationConfidence` is `low`
 * until real agent-outcome data exists. Purely a view over existing evidence;
 * it never changes gating or `summary.score`. See ADR 0005.
 */
export const calculateReadinessProfile = (report: ProfileInput): ReadinessProfile => {
  const applicable = applicableKinds(report)
  const gaps = coverageGaps(report, applicable)
  return {
    readiness: report.autonomyEnvelope,
    risk: buildRisk(report.capabilities),
    coverage: buildCoverage(applicable, gaps),
    observability: buildObservability(applicable, gaps),
    calibrationConfidence: 'low',
  }
}
