import { closeSync, openSync, readSync, readdirSync, statSync } from 'fs'
import path from 'path'
import type { LocalReadinessConfig, LocalReadinessFile } from '../core/types'
import { normalizeRepoPath, pathMatchesPattern } from '../core/util'

const ignoredDirectories = new Set([
  '.git',
  '.next',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
])

const sourceExtensions = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cs',
  '.css',
  '.go',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.mjs',
  '.py',
  '.rb',
  '.rs',
  '.swift',
  '.ts',
  '.tsx',
])

const documentationExtensions = new Set(['.md', '.mdx', '.rst', '.txt', '.adoc'])

const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mov',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.webp',
  '.zip',
])

const generatedPathPatterns = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lockb$/,
  /(^|\/)generated\//,
  /(^|\/)__generated__\//,
  /(^|\/)vendor\//,
]

const testPathPattern = /(^|\/)(__tests__|tests?|spec)\//i
const testFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/i

const toRepositoryPath = (root: string, filePath: string): string => (
  path.relative(root, filePath).split(path.sep).join('/')
)

const isIgnoredDirectory = (directoryName: string): boolean => ignoredDirectories.has(directoryName)

const shouldIgnorePath = (repoPath: string, config: LocalReadinessConfig): boolean => (
  config.ignorePaths.some(pattern => pathMatchesPattern(repoPath, pattern))
)

const isLikelyBinary = (absolutePath: string, extension: string): boolean => {
  if (binaryExtensions.has(extension)) {
    return true
  }

  let fd: number | undefined
  try {
    fd = openSync(absolutePath, 'r')
    const sample = Buffer.alloc(4096)
    const bytesRead = readSync(fd, sample, 0, sample.length, 0)
    return sample.subarray(0, bytesRead).includes(0)
  } catch (error) {
    console.warn(`AgentReady: unable to sample file for binary detection (${absolutePath}): ${error instanceof Error ? error.message : String(error)}`)
    return false
  } finally {
    if (fd !== undefined) {
      closeSync(fd)
    }
  }
}

export const isGeneratedPath = (repoPath: string): boolean => generatedPathPatterns.some(pattern => pattern.test(repoPath))

const isMinifiedPath = (repoPath: string): boolean => /\.(min|bundle)\.(js|css)$/i.test(repoPath)

const isDocumentationPath = (repoPath: string, extension: string): boolean => (
  documentationExtensions.has(extension)
  || /^docs\//i.test(repoPath)
  || /(^|\/)(README|CONTRIBUTING|CHANGELOG|ARCHITECTURE|DEVELOPMENT)(\.[^.]+)?$/i.test(repoPath)
)

const isSourcePath = (repoPath: string, extension: string): boolean => (
  sourceExtensions.has(extension)
  && !isGeneratedPath(repoPath)
  && !testPathPattern.test(repoPath)
  && !testFilePattern.test(repoPath)
)

/**
 * Walks the repository tree, skipping ignored directories and configured ignore
 * paths, and classifies every file (source/test/doc/generated/binary/minified).
 */
export const walkFiles = (root: string, config: LocalReadinessConfig, directory = root): LocalReadinessFile[] => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files: LocalReadinessFile[] = []

  for (const entry of entries) {
    // Skip ignored names for both directories and files; this also drops the
    // `.git` file present in linked worktrees used by `diff`.
    if (isIgnoredDirectory(entry.name)) {
      continue
    }

    const absolutePath = path.join(directory, entry.name)
    const repoPath = toRepositoryPath(root, absolutePath)

    if (shouldIgnorePath(repoPath, config)) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...walkFiles(root, config, absolutePath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    let stat
    try {
      stat = statSync(absolutePath)
    } catch (error) {
      // Tolerate files that disappear mid-walk or cannot be stat'd (permissions),
      // matching how binary sampling already handles read errors.
      console.warn(`AgentReady: unable to stat file, skipping (${absolutePath}): ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const extension = path.extname(entry.name).toLowerCase()
    const binary = isLikelyBinary(absolutePath, extension)

    files.push({
      path: normalizeRepoPath(repoPath),
      sizeBytes: stat.size,
      extension,
      binary,
      generated: isGeneratedPath(repoPath),
      minified: isMinifiedPath(repoPath),
      documentation: isDocumentationPath(repoPath, extension),
      test: testPathPattern.test(repoPath) || testFilePattern.test(repoPath),
      source: isSourcePath(repoPath, extension),
    })
  }

  return files.sort((a, b) => a.path.localeCompare(b.path))
}
