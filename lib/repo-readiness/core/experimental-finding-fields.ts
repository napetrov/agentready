import type { LocalReadinessExperimentalFindingField, ReadinessFinding } from './types'

/**
 * Which nested, finding-level experimental keys (`confidence`, `scope`) are
 * actually present on at least one finding in the given list. Shared by every
 * report shape that serializes findings — the scan report, and per-repo
 * portfolio results — so each can advertise the same way rather than emitting
 * the keys unadvertised. See ADR 0005.
 */
export const computeExperimentalFindingFields = (
  findings: ReadinessFinding[],
): LocalReadinessExperimentalFindingField[] => {
  const fields: LocalReadinessExperimentalFindingField[] = []
  if (findings.some(finding => finding.confidence !== undefined)) fields.push('confidence')
  if (findings.some(finding => finding.scope !== undefined)) fields.push('scope')
  return fields
}
