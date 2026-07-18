import path from 'path'
import {
  NOT_VERIFIED_EXTERNAL_CONTROLS,
  calculateReadinessProfile,
  scanLocalReadiness,
} from '../lib/repo-readiness/local-readiness'
import type {
  CapabilityRiskTier,
  CapabilitySurfaceEvidence,
  LocalReadinessReport,
} from '../lib/repo-readiness/local-readiness'

const goodFixture = path.join(__dirname, '..', 'fixtures', 'readiness', 'good-repo')

const base = (): Omit<LocalReadinessReport, 'readinessProfile'> => {
  const { readinessProfile: _ignored, ...rest } = scanLocalReadiness(goodFixture)
  return rest
}

const surface = (
  riskTier: CapabilityRiskTier,
  path: string,
  kind: CapabilitySurfaceEvidence['kind'] = 'mcp',
): CapabilitySurfaceEvidence => ({
  kind,
  path,
  tool: 'claude-code',
  notes: [],
  riskTier,
})

describe('calculateReadinessProfile risk axis', () => {
  it('aggregates to the worst tier, not an average', () => {
    const profile = calculateReadinessProfile({
      ...base(),
      capabilities: [surface('low', 'a'), surface('low', 'b'), surface('high', '.mcp.json')],
    })
    expect(profile.risk.verdict).toBe('high')
    // evidenceRefs lists only the worst-tier surface(s).
    expect(profile.risk.evidenceRefs).toEqual(['safety.capability.high-risk:.mcp.json'])
    expect(profile.risk.confidence).toBe('high')
  })

  it('reports medium when the worst surface is medium', () => {
    const profile = calculateReadinessProfile({
      ...base(),
      capabilities: [surface('low', 'a'), surface('medium', '.vscode/settings.json')],
    })
    expect(profile.risk.verdict).toBe('medium')
    expect(profile.risk.evidenceRefs).toEqual(['capability:.vscode/settings.json:mcp'])
  })

  it('keeps an MCP config high, never unknown', () => {
    const profile = calculateReadinessProfile({
      ...base(),
      capabilities: [surface('high', '.mcp.json')],
    })
    expect(profile.risk.verdict).toBe('high')
  })

  it('is a verified low (empty refs) when there are no capability surfaces', () => {
    const profile = calculateReadinessProfile({ ...base(), capabilities: [] })
    expect(profile.risk.verdict).toBe('low')
    expect(profile.risk.confidence).toBe('high')
    expect(profile.risk.evidenceRefs).toEqual([])
    expect(profile.risk.explanation).toMatch(/no capability surfaces/i)
  })
})

describe('calculateReadinessProfile coverage axis', () => {
  it('counts surface kinds, not instances (size independence)', () => {
    const one = calculateReadinessProfile({ ...base(), capabilities: [surface('low', 'a')] })
    const many = calculateReadinessProfile({
      ...base(),
      capabilities: [surface('low', 'a'), surface('low', 'b'), surface('low', 'c'), surface('low', 'd')],
    })
    // capability-surfaces is one applicable kind whether there are 1 or 4 of them.
    expect(many.coverage.applicableSurfaces).toBe(one.coverage.applicableSurfaces)
  })

  it('keeps ratio within 0..1 and integer surface counts', () => {
    const profile = calculateReadinessProfile(base())
    expect(Number.isInteger(profile.coverage.applicableSurfaces)).toBe(true)
    expect(Number.isInteger(profile.coverage.assessedSurfaces)).toBe(true)
    expect(profile.coverage.ratio).toBeGreaterThanOrEqual(0)
    expect(profile.coverage.ratio).toBeLessThanOrEqual(1)
  })

  it('is ratio 1 with no applicable surfaces', () => {
    // Strip every surface source so nothing is applicable.
    const stripped = {
      ...base(),
      instructions: [],
      commands: { ecosystems: [], scripts: [], makeTargets: [], hasBuild: false, hasTest: false, hasLint: false, hasTypeCheck: false },
      ci: { workflowFiles: [], workflows: [], hasInstall: false, hasTest: false, hasLint: false, hasBuild: false, hasTypeCheck: false, orchestratorKinds: [] },
      capabilities: [],
      governance: {},
      repositoryEvidence: {
        ...base().repositoryEvidence,
        roots: [],
        documentSurfaces: [],
      },
    }
    const profile = calculateReadinessProfile(stripped)
    expect(profile.coverage.applicableSurfaces).toBe(0)
    expect(profile.coverage.ratio).toBe(1)
    expect(Number.isNaN(profile.coverage.ratio)).toBe(false)
  })
})

describe('calculateReadinessProfile readiness/observability/calibration', () => {
  it('reuses the autonomy envelope verbatim', () => {
    const report = base()
    const profile = calculateReadinessProfile(report)
    expect(profile.readiness).toEqual(report.autonomyEnvelope)
  })

  it('lists external controls as not observable locally', () => {
    const profile = calculateReadinessProfile(base())
    expect(profile.observability.notObservableLocally).toEqual(NOT_VERIFIED_EXTERNAL_CONTROLS)
  })

  it('reports calibration confidence as low until outcome data exists', () => {
    expect(calculateReadinessProfile(base()).calibrationConfidence).toBe('low')
  })
})

describe('scanLocalReadiness includes the profile', () => {
  it('attaches a readinessProfile and registers the experimental field', () => {
    const report = scanLocalReadiness(goodFixture)
    expect(report.readinessProfile).toBeDefined()
    expect(report.readinessProfile.readiness).toEqual(report.autonomyEnvelope)
    expect(report.reportContract.experimentalFields).toContain('readinessProfile')
  })

  it('omits experimentalFindingFields when no finding carries confidence/scope', () => {
    const report = scanLocalReadiness(goodFixture)
    expect(report.findings.every(finding => finding.confidence === undefined && finding.scope === undefined)).toBe(true)
    expect(report.reportContract.experimentalFindingFields).toBeUndefined()
  })
})
