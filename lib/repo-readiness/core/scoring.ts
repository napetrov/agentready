import type { ReadinessFinding } from './types'

const SEVERITY_PENALTY: Record<ReadinessFinding['severity'], number> = {
  error: 18,
  warning: 7,
  info: 2,
}

/**
 * Converts findings into an experimental 0-100 readiness score by applying a
 * fixed penalty per finding severity. This is intentionally simple and should
 * be treated as a structured signal, not a compliance certification.
 */
export const calculateScore = (findings: ReadinessFinding[]): number => {
  const penalty = findings.reduce((total, finding) => total + SEVERITY_PENALTY[finding.severity], 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}
