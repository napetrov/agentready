import type { z } from 'zod'
import type { ContractValidationResult } from '../repo-readiness/core/types'
import { augmentedReportSchema, llmInsightSchema } from './schemas'

/**
 * Renders a Zod issue path into a readable, dotted string with bracketed array
 * indices, e.g. `insights[1].confidence`. Matches core/contracts.ts.
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

/** Validates a single LLM insight against the contract. */
export function validateLlmInsightContract(insight: unknown): ContractValidationResult {
  return toValidationResult(llmInsightSchema.safeParse(insight))
}

/** Validates an augmented report against the contract. */
export function validateAugmentedReportContract(report: unknown): ContractValidationResult {
  return toValidationResult(augmentedReportSchema.safeParse(report))
}

export type { ContractValidationResult } from '../repo-readiness/core/types'
