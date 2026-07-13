import type { z } from 'zod'
import type { ContractValidationResult } from './types'
import { localReadinessReportSchema, portfolioReportSchema, readinessDiffReportSchema } from './schemas'

/**
 * Renders a Zod issue path into a readable, dotted string with bracketed array
 * indices, e.g. `files[1].sizeBytes` or `commands.packageManager`.
 */
const formatIssuePath = (path: ReadonlyArray<PropertyKey>): string =>
  path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`
    }
    return acc ? `${acc}.${String(segment)}` : String(segment)
  }, '')

const formatIssues = (issues: ReadonlyArray<z.core.$ZodIssue>): string[] =>
  issues.map(issue => {
    const path = formatIssuePath(issue.path)
    return path ? `${path}: ${issue.message}` : issue.message
  })

const toValidationResult = (
  result: { success: true } | { success: false; error: z.ZodError },
): ContractValidationResult =>
  result.success
    ? { valid: true, errors: [] }
    : { valid: false, errors: formatIssues(result.error.issues) }

export function validateLocalReadinessReportContract(report: unknown): ContractValidationResult {
  return toValidationResult(localReadinessReportSchema.safeParse(report))
}

export function validateReadinessDiffReportContract(report: unknown): ContractValidationResult {
  return toValidationResult(readinessDiffReportSchema.safeParse(report))
}

export function validatePortfolioReportContract(report: unknown): ContractValidationResult {
  return toValidationResult(portfolioReportSchema.safeParse(report))
}

export type { ContractValidationResult } from './types'
