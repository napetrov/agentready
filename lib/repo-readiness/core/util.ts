export const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

export const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every(item => typeof item === 'string')
)

export const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort()

export const normalizeRepoPath = (repoPath: string): string => (
  repoPath.replace(/\\/g, '/').replace(/^\.?\//, '')
)

const escapeRegex = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')

const globToRegex = (pattern: string): RegExp => {
  const normalized = normalizeRepoPath(pattern)
  let source = ''

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (char === '*' && next === '*') {
      source += '.*'
      index += 1
    } else if (char === '*') {
      source += '[^/]*'
    } else {
      source += escapeRegex(char)
    }
  }

  return new RegExp(`^${source}$`)
}

export const pathMatchesPattern = (repoPath: string, pattern: string): boolean => {
  const normalizedPath = normalizeRepoPath(repoPath)
  const normalizedPattern = normalizeRepoPath(pattern)

  if (normalizedPattern.length === 0) {
    return false
  }

  if (!normalizedPattern.includes('*')) {
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`)
  }

  return globToRegex(normalizedPattern).test(normalizedPath)
}
