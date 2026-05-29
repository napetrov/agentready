import type { ContractValidationResult, PackageManager, ReadinessSeverity } from './types'
import { isObject, isStringArray } from './util'

const isSeverity = (value: unknown): value is ReadinessSeverity => (
  value === 'info' || value === 'warning' || value === 'error'
)

const isPackageManager = (value: unknown): value is PackageManager => (
  value === 'npm' || value === 'pnpm' || value === 'yarn' || value === 'bun'
)

const validateLocalReadinessFileContract = (file: unknown, pathPrefix: string): string[] => {
  const errors: string[] = []
  if (!isObject(file)) {
    return [`${pathPrefix} must be an object`]
  }

  for (const key of ['path', 'extension']) {
    if (typeof file[key] !== 'string') errors.push(`${pathPrefix}.${key} must be a string`)
  }
  if (typeof file.sizeBytes !== 'number') errors.push(`${pathPrefix}.sizeBytes must be a number`)
  for (const key of ['binary', 'generated', 'minified', 'documentation', 'test', 'source']) {
    if (typeof file[key] !== 'boolean') errors.push(`${pathPrefix}.${key} must be a boolean`)
  }

  return errors
}

const validateFindingContract = (finding: unknown, pathPrefix: string): string[] => {
  const errors: string[] = []
  if (!isObject(finding)) {
    return [`${pathPrefix} must be an object`]
  }

  if (typeof finding.id !== 'string' || finding.id.length === 0) errors.push(`${pathPrefix}.id must be a non-empty string`)
  if (typeof finding.title !== 'string' || finding.title.length === 0) errors.push(`${pathPrefix}.title must be a non-empty string`)
  if (!isSeverity(finding.severity)) errors.push(`${pathPrefix}.severity must be info, warning, or error`)
  if ('path' in finding && typeof finding.path !== 'string') errors.push(`${pathPrefix}.path must be a string when present`)
  if (typeof finding.recommendation !== 'string' || finding.recommendation.length === 0) {
    errors.push(`${pathPrefix}.recommendation must be a non-empty string`)
  }

  return errors
}

export function validateLocalReadinessReportContract(report: unknown): ContractValidationResult {
  const errors: string[] = []

  if (!isObject(report)) {
    return { valid: false, errors: ['report must be an object'] }
  }

  if (typeof report.root !== 'string') errors.push('root must be a string')
  if (typeof report.generatedAt !== 'string') errors.push('generatedAt must be a string')

  if (!isObject(report.summary)) {
    errors.push('summary must be an object')
  } else {
    for (const key of [
      'score',
      'totalFiles',
      'totalBytes',
      'sourceFiles',
      'testFiles',
      'documentationFiles',
      'largeFiles',
      'binaryFiles',
      'generatedFiles',
      'minifiedFiles',
    ]) {
      if (typeof report.summary[key] !== 'number') errors.push(`summary.${key} must be a number`)
    }
  }

  if (!isObject(report.docs)) {
    errors.push('docs must be an object')
  } else {
    for (const key of ['readme', 'contributing', 'architecture', 'environment']) {
      if (!isStringArray(report.docs[key])) errors.push(`docs.${key} must be a string array`)
    }
  }

  if (!isObject(report.commands)) {
    errors.push('commands must be an object')
  } else {
    if ('packageManager' in report.commands && report.commands.packageManager !== undefined && !isPackageManager(report.commands.packageManager)) {
      errors.push('commands.packageManager must be npm, pnpm, yarn, or bun when present')
    }
    if (!isStringArray(report.commands.ecosystems)) errors.push('commands.ecosystems must be a string array')
    if (!isStringArray(report.commands.scripts)) errors.push('commands.scripts must be a string array')
    for (const key of ['hasBuild', 'hasTest', 'hasLint', 'hasTypeCheck']) {
      if (typeof report.commands[key] !== 'boolean') errors.push(`commands.${key} must be a boolean`)
    }
  }

  if (!isObject(report.ci) || !isStringArray((report.ci as Record<string, unknown>).workflowFiles)) {
    errors.push('ci.workflowFiles must be a string array')
  }

  if (!Array.isArray(report.instructions)) errors.push('instructions must be an array')
  if (!Array.isArray(report.files)) {
    errors.push('files must be an array')
  } else {
    report.files.forEach((file, index) => {
      errors.push(...validateLocalReadinessFileContract(file, `files[${index}]`))
    })
  }

  if (!Array.isArray(report.findings)) {
    errors.push('findings must be an array')
  } else {
    report.findings.forEach((finding, index) => {
      errors.push(...validateFindingContract(finding, `findings[${index}]`))
    })
  }

  return { valid: errors.length === 0, errors }
}

export function validateReadinessDiffReportContract(report: unknown): ContractValidationResult {
  const errors: string[] = []

  if (!isObject(report)) {
    return { valid: false, errors: ['diff report must be an object'] }
  }

  if (typeof report.base !== 'string') errors.push('base must be a string')
  if (typeof report.head !== 'string') errors.push('head must be a string')
  if (typeof report.generatedAt !== 'string') errors.push('generatedAt must be a string')

  const baseValidation = validateLocalReadinessReportContract(report.baseReport)
  errors.push(...baseValidation.errors.map(error => `baseReport.${error}`))
  const headValidation = validateLocalReadinessReportContract(report.headReport)
  errors.push(...headValidation.errors.map(error => `headReport.${error}`))

  if (!isObject(report.summary)) {
    errors.push('summary must be an object')
  } else {
    for (const key of ['scoreDelta', 'filesDelta', 'bytesDelta', 'findingsDelta', 'newFindings', 'resolvedFindings']) {
      if (typeof report.summary[key] !== 'number') errors.push(`summary.${key} must be a number`)
    }
  }

  for (const key of ['newFindings', 'resolvedFindings', 'regressions']) {
    if (!Array.isArray(report[key])) {
      errors.push(`${key} must be an array`)
    } else {
      (report[key] as unknown[]).forEach((finding, index) => {
        errors.push(...validateFindingContract(finding, `${key}[${index}]`))
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

export type { ContractValidationResult } from './types'
