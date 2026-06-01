import { lstatSync, readFileSync } from 'fs'
import path from 'path'
import fastGlob from 'fast-glob'
import ignore, { type Ignore } from 'ignore'
import { isBinaryFileSync } from 'isbinaryfile'
import type { LocalReadinessConfig, LocalReadinessFile } from '../core/types'
import { normalizeRepoPath, pathMatchesPattern } from '../core/util'

// Directories that are never relevant to agent readiness and are skipped before
// traversal so we never descend into them (kept as an always-on filter on top
// of any `.gitignore` rules the repository itself declares).
const ignoredDirectories = [
  '.git',
  '.next',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
]

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

// Extensions we treat as binary without sampling, so large media never has to
// be opened. Anything not listed here is sniffed by `isbinaryfile`.
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

const shouldIgnorePath = (repoPath: string, config: LocalReadinessConfig): boolean => (
  config.ignorePaths.some(pattern => pathMatchesPattern(repoPath, pattern))
)

const isLikelyBinary = (absolutePath: string, extension: string, sizeBytes: number): boolean => {
  if (binaryExtensions.has(extension)) {
    return true
  }

  try {
    return isBinaryFileSync(absolutePath, sizeBytes)
  } catch (error) {
    console.warn(`AgentReady: unable to sample file for binary detection (${absolutePath}): ${error instanceof Error ? error.message : String(error)}`)
    return false
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
 * Builds a per-directory map of `.gitignore` matchers so the inventory honours
 * the repository's own ignore rules with the same hierarchy semantics git uses:
 * a `.gitignore` in directory `d` applies to paths under `d`, evaluated relative
 * to `d`. Reading the files is the only filesystem side effect; nothing is
 * executed.
 */
const loadGitignoreMatchers = (root: string): Map<string, Ignore> => {
  const matchers = new Map<string, Ignore>()

  const gitignoreFiles = fastGlob.sync('**/.gitignore', {
    cwd: root,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: ignoredDirectories.map(dir => `**/${dir}/**`),
  })

  for (const relativeFile of gitignoreFiles) {
    try {
      const contents = readFileSync(path.join(root, relativeFile), 'utf8')
      const dir = normalizeRepoPath(path.dirname(relativeFile))
      matchers.set(dir === '.' ? '' : dir, ignore().add(contents))
    } catch (error) {
      console.warn(`AgentReady: unable to read ${relativeFile}, skipping its ignore rules: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return matchers
}

/**
 * Returns the repo-root-relative ancestor directories whose `.gitignore` applies
 * to `logicalPath`, shallowest first: `'src/a/b.txt'` yields `['', 'src',
 * 'src/a']`. The empty string is the repository root.
 */
const applicableMatcherDirs = (logicalPath: string): string[] => {
  const segments = logicalPath.split('/')
  segments.pop() // drop the entry's own name
  const directories = ['']
  let accumulated = ''
  for (const segment of segments) {
    accumulated = accumulated === '' ? segment : `${accumulated}/${segment}`
    directories.push(accumulated)
  }
  return directories
}

/**
 * Applies each applicable `.gitignore` to `logicalPath` from shallowest to
 * deepest, so a deeper file's rules — including negations that re-include a
 * path — override shallower ones. Each matcher is evaluated against the path
 * relative to its own directory; `isDirectory` adds the trailing slash that lets
 * directory-only rules (`tmp/`) match.
 */
const evaluateGitignore = (logicalPath: string, isDirectory: boolean, matchers: Map<string, Ignore>): boolean => {
  let ignored = false
  for (const dir of applicableMatcherDirs(logicalPath)) {
    const matcher = matchers.get(dir)
    if (!matcher) {
      continue
    }

    let relative = dir === '' ? logicalPath : logicalPath.slice(dir.length + 1)
    if (relative.length === 0) {
      continue
    }
    if (isDirectory) {
      relative += '/'
    }

    const result = matcher.test(relative)
    if (result.ignored) {
      ignored = true
    } else if (result.unignored) {
      ignored = false
    }
  }

  return ignored
}

/**
 * Decides whether `repoPath` is ignored under git's hierarchy semantics. Each
 * ancestor directory is checked first: once a directory is ignored as a whole
 * (e.g. root `tmp/`), git does not descend into it, so a negation in a
 * `.gitignore` *inside* that directory cannot re-include the file. Only when no
 * ancestor directory is excluded is the file itself evaluated, where deeper
 * negations may still re-include it.
 */
const isGitIgnored = (repoPath: string, matchers: Map<string, Ignore>): boolean => {
  if (matchers.size === 0) {
    return false
  }

  const segments = repoPath.split('/')
  for (let depth = 1; depth < segments.length; depth += 1) {
    const directoryPath = segments.slice(0, depth).join('/')
    if (evaluateGitignore(directoryPath, true, matchers)) {
      return true
    }
  }

  return evaluateGitignore(repoPath, false, matchers)
}

/**
 * Walks the repository tree with `fast-glob`, skipping always-ignored
 * directories and any path matched by the repository's `.gitignore` files or the
 * configured ignore paths, and classifies every file
 * (source/test/doc/generated/binary/minified).
 *
 * `respectGitignore` (default `true`) can be disabled by callers that scan a
 * tree of committed files only — e.g. the `diff` worktrees — where git would not
 * ignore tracked paths, so `.gitignore` filtering must not drop them.
 */
export const walkFiles = (
  root: string,
  config: LocalReadinessConfig,
  options: { respectGitignore?: boolean } = {},
): LocalReadinessFile[] => {
  const gitignoreMatchers = options.respectGitignore === false
    ? new Map<string, Ignore>()
    : loadGitignoreMatchers(root)

  // `.git` lives as a regular file (not a directory) inside the linked
  // worktrees `diff` creates, so ignore it by name as well as by directory.
  const relativePaths = fastGlob.sync('**/*', {
    cwd: root,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: [
      ...ignoredDirectories.map(dir => `**/${dir}/**`),
      ...ignoredDirectories.map(dir => `**/${dir}`),
    ],
  })

  const files: LocalReadinessFile[] = []

  for (const relativePath of relativePaths) {
    const repoPath = normalizeRepoPath(relativePath)

    if (isGitIgnored(repoPath, gitignoreMatchers) || shouldIgnorePath(repoPath, config)) {
      continue
    }

    const absolutePath = path.join(root, relativePath)

    let stat
    try {
      // lstat (not stat) so symlinks are not followed: fast-glob is configured
      // with followSymbolicLinks:false and already omits them, but guarding here
      // keeps us from ever reading a target outside the repository.
      stat = lstatSync(absolutePath)
    } catch (error) {
      // Tolerate files that disappear mid-walk or cannot be stat'd (permissions),
      // matching how binary sampling already handles read errors.
      console.warn(`AgentReady: unable to stat file, skipping (${absolutePath}): ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    // Only inventory regular files — never symlinks (whose target may be
    // external) or other special entries (FIFOs, sockets, devices).
    if (!stat.isFile()) {
      continue
    }

    const extension = path.extname(repoPath).toLowerCase()
    const binary = isLikelyBinary(absolutePath, extension, stat.size)

    files.push({
      path: repoPath,
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
