import type {
  LocalReadinessReport,
  ReadinessFinding,
  ReadinessSeverity,
} from '../core/types'

// Minimal SARIF 2.1.0 shapes — just the fields AgentReady populates. The full
// specification is large; GitHub code scanning only requires this subset.
interface SarifMessage {
  text: string
}

interface SarifRule {
  id: string
  name: string
  shortDescription: SarifMessage
  fullDescription?: SarifMessage
  defaultConfiguration: { level: SarifLevel }
}

interface SarifResult {
  ruleId: string
  level: SarifLevel
  message: SarifMessage
  locations?: Array<{
    physicalLocation: {
      artifactLocation: { uri: string }
    }
  }>
}

type SarifLevel = 'error' | 'warning' | 'note'

export interface SarifLog {
  $schema: string
  version: '2.1.0'
  runs: Array<{
    tool: {
      driver: {
        name: string
        informationUri: string
        version?: string
        rules: SarifRule[]
      }
    }
    results: SarifResult[]
  }>
}

const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json'
const TOOL_INFORMATION_URI = 'https://github.com/napetrov/agentready'

const levelForSeverity = (severity: ReadinessSeverity): SarifLevel =>
  severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'note'

// Finding ids follow a `rule:instance` convention (e.g. `files.large:blob.dat`).
// SARIF wants one rule per stable rule key, so collapse the instance suffix.
const ruleKeyForFinding = (finding: ReadinessFinding): string => finding.id.split(':')[0]

const messageForFinding = (finding: ReadinessFinding): string => {
  const recommendation = finding.recommendation?.trim()
  return recommendation ? `${finding.title}. ${recommendation}` : `${finding.title}.`
}

export interface SarifOptions {
  /** Tool version recorded in the SARIF driver, when known. */
  toolVersion?: string
}

/**
 * Renders a scan report as a SARIF 2.1.0 log so AgentReady findings can be
 * uploaded to GitHub code scanning (or any SARIF-aware viewer). Findings are
 * grouped into stable rules; each finding becomes a result with its own level
 * and, when available, a file location.
 */
export function formatScanSarif(report: LocalReadinessReport, options: SarifOptions = {}): SarifLog {
  const rules = new Map<string, SarifRule>()
  const results: SarifResult[] = []

  for (const finding of report.findings) {
    const ruleId = ruleKeyForFinding(finding)
    const level = levelForSeverity(finding.severity)

    if (!rules.has(ruleId)) {
      rules.set(ruleId, {
        id: ruleId,
        name: ruleId,
        shortDescription: { text: finding.title },
        defaultConfiguration: { level },
      })
    }

    results.push({
      ruleId,
      level,
      message: { text: messageForFinding(finding) },
      ...(finding.path
        ? {
            locations: [
              { physicalLocation: { artifactLocation: { uri: finding.path } } },
            ],
          }
        : {}),
    })
  }

  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'AgentReady',
            informationUri: TOOL_INFORMATION_URI,
            ...(options.toolVersion ? { version: options.toolVersion } : {}),
            rules: [...rules.values()],
          },
        },
        results,
      },
    ],
  }
}
