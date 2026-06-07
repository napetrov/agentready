import { closeSync, lstatSync, openSync, readFileSync, readSync, realpathSync, type Stats } from 'fs'
import { execFileSync } from 'child_process'
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

const binarySampleBytes = 512

const readBinarySample = (absolutePath: string): Buffer => {
  const fileDescriptor = openSync(absolutePath, 'r')
  try {
    const sample = Buffer.allocUnsafe(binarySampleBytes)
    const bytesRead = readSync(fileDescriptor, sample, 0, binarySampleBytes, 0)
    return sample.subarray(0, bytesRead)
  } finally {
    closeSync(fileDescriptor)
  }
}

const hasUtf8ReplacementCharacters = (sample: Buffer): boolean => {
  const maxTrailingUtf8Bytes = 3
  const trimLimit = Math.min(maxTrailingUtf8Bytes, sample.length)

  for (let trimBytes = 0; trimBytes <= trimLimit; trimBytes += 1) {
    const candidate = trimBytes === 0 ? sample : sample.subarray(0, sample.length - trimBytes)
    if (!candidate.toString('utf8').includes('\uFFFD')) {
      return false
    }
  }

  return true
}

const generatedPathPatterns = [
  // Lockfiles across ecosystems: machine-generated, frequently large, and
  // expected to be committed — so they should not be flagged as large files.
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lockb?$/,
  /(^|\/)npm-shrinkwrap\.json$/,
  /(^|\/)uv\.lock$/,
  /(^|\/)poetry\.lock$/,
  /(^|\/)Pipfile\.lock$/,
  /(^|\/)pdm\.lock$/,
  /(^|\/)Cargo\.lock$/,
  /(^|\/)go\.sum$/,
  /(^|\/)composer\.lock$/,
  /(^|\/)Gemfile\.lock$/,
  /(^|\/)gradle\.lockfile$/,
  /(^|\/)(deps|third_party|third-party)\//,
  /(^|\/)(test|tests)\/fixtures\//,
  /(^|\/)tests\/baselines\//,
  /(^|\/)tests\/cases\/fourslash\//,
  /\.generated\./,
  /(^|\/)generated\//,
  /(^|\/)__generated__\//,
  /(^|\/)vendor\//,
  /(^|\/)third[_-]?party\//i,
]

const testPathPattern = /(^|\/)(__tests__|unit_tests?|tests?|spec|specs|testdata)\//i

// Test-file naming conventions across ecosystems, matched on the basename so a
// directory like `latest/` never counts. Without these, a Go `foo_test.go` or a
// pytest `test_foo.py` living outside a `tests/` directory is misclassified as
// source and the repository reports zero tests.
const testFilePatterns: RegExp[] = [
  // JS/TS: foo.test.ts, foo.spec.jsx, foo.test.mts
  /\.(test|spec)\.[cm]?[jt]sx?$/i,
  // Go: foo_test.go
  /(^|\/)[^/]+_test\.go$/i,
  // Python (pytest/unittest): test_foo.py or foo_test.py
  /(^|\/)(test_[^/]+|[^/]+_test)\.py$/i,
  // JVM / C#: FooTest.java, FooTests.kt, FooSpec.scala, FooTests.cs (case-sensitive
  // suffix so a source file like `latest.java` is not caught).
  /(^|\/)[A-Za-z0-9]+(Test|Tests|Spec|IT)\.(java|kt|kts|scala|cs)$/,
  // Ruby / Elixir: foo_test.rb, foo_spec.rb, foo_test.exs
  /(^|\/)[^/]+_(test|spec)\.(rb|exs?)$/i,
  // C/C++ (gtest convention): foo_test.cc, foo_test.cpp
  /(^|\/)[^/]+_test\.(cc|cpp|cxx|c)$/i,
  // Swift (XCTest): FooTests.swift
  /(^|\/)[^/]+Tests?\.swift$/,
]

const isTestFilePath = (repoPath: string): boolean => testFilePatterns.some(pattern => pattern.test(repoPath))

const shouldIgnorePath = (repoPath: string, config: LocalReadinessConfig): boolean => (
  config.ignorePaths.some(pattern => pathMatchesPattern(repoPath, pattern))
)

// High-signal repository metadata is often committed even in projects with a
// broad dotfile ignore such as `.*`. Keep these files visible to readiness
// detectors so CI and agent-instruction surfaces do not disappear from scans.
const isReadinessMetadataPath = (repoPath: string): boolean => (
  /^\.github\/workflows\/.+\.ya?ml$/i.test(repoPath)
  || repoPath === '.gitlab-ci.yml'
  || repoPath === '.pre-commit-config.yaml'
  || repoPath === '.pre-commit-config.yml'
  || repoPath === '.circleci/config.yml'
  || /(^|\/)(AGENTS\.md|AGENTS\.override\.md|CLAUDE\.md|CLAUDE\.local\.md|GEMINI\.md)$/i.test(repoPath)
  || repoPath === '.cursorrules'
  || repoPath === '.windsurfrules'
  || repoPath === '.clinerules'
  || repoPath === '.roomodes'
  || /^\.roorules(-[^/]+)?$/.test(repoPath)
  || repoPath === '.github/copilot-instructions.md'
  || (repoPath.startsWith('.github/instructions/') && repoPath.endsWith('.instructions.md'))
  || (repoPath.startsWith('.github/agents/') && repoPath.endsWith('.agent.md'))
  || (repoPath.startsWith('.claude/rules/') && repoPath.endsWith('.md'))
  || (repoPath.startsWith('.claude/skills/') && repoPath.endsWith('/SKILL.md'))
  || (repoPath.startsWith('.cursor/rules/') && repoPath.endsWith('.mdc'))
  || (repoPath.startsWith('.windsurf/rules/') && repoPath.endsWith('.md'))
  || (repoPath.startsWith('.clinerules/') && (repoPath.endsWith('.md') || repoPath.endsWith('.txt')))
  || (repoPath.startsWith('.roo/rules/') && (repoPath.endsWith('.md') || repoPath.endsWith('.txt')))
  || (/^\.roo\/rules-[^/]+\//.test(repoPath) && (repoPath.endsWith('.md') || repoPath.endsWith('.txt')))
)

const loadTrackedPaths = (root: string): Set<string> | undefined => {
  try {
    const output = execFileSync('git', ['-c', 'core.fsmonitor=false', '-C', root, 'ls-files', '-z', '--'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: '0',
      },
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    return new Set(
      output
        .split('\0')
        .filter(Boolean)
        .map(normalizeRepoPath),
    )
  } catch {
    return undefined
  }
}

const isLikelyBinary = (absolutePath: string, extension: string, sizeBytes: number): boolean => {
  if (binaryExtensions.has(extension)) {
    return true
  }

  try {
    return isBinaryFileSync(absolutePath, sizeBytes)
  } catch {
    try {
      const sample = readBinarySample(absolutePath)
      if (sample.includes(0)) {
        return true
      }
      return hasUtf8ReplacementCharacters(sample)
    } catch (fallbackError) {
      console.warn(`AgentReady: unable to sample file for binary detection (${absolutePath}): ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`)
      return false
    }
  }
}

const isInsideRoot = (rootRealPath: string, targetRealPath: string): boolean => {
  const relativePath = path.relative(rootRealPath, targetRealPath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

const isSafeDocumentationSymlink = (rootRealPath: string, absolutePath: string): boolean => {
  try {
    const targetRealPath = realpathSync(absolutePath)
    return isInsideRoot(rootRealPath, targetRealPath) && lstatSync(targetRealPath).isFile()
  } catch {
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
  && !isTestFilePath(repoPath)
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
    onlyFiles: false,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: ignoredDirectories.map(dir => `**/${dir}/**`),
  })

  for (const relativeFile of gitignoreFiles) {
    try {
      const absoluteFile = path.join(root, relativeFile)
      if (!lstatSync(absoluteFile).isFile()) {
        continue
      }
      const contents = readFileSync(absoluteFile, 'utf8')
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

const shouldIncludeWalkedPath = (
  repoPath: string,
  config: LocalReadinessConfig,
  gitignoreMatchers: Map<string, Ignore>,
  trackedPaths: Set<string> | undefined,
): boolean => {
  if (shouldIgnorePath(repoPath, config)) {
    return false
  }

  const ignored = isGitIgnored(repoPath, gitignoreMatchers)
  if (!ignored) {
    return true
  }

  return trackedPaths?.has(repoPath) === true && isReadinessMetadataPath(repoPath)
}

const shouldIncludeSymlink = (repoPath: string, absolutePath: string, rootRealPath: string): boolean => {
  const extension = path.extname(repoPath).toLowerCase()
  return isDocumentationPath(repoPath, extension) && isSafeDocumentationSymlink(rootRealPath, absolutePath)
}

const toLocalReadinessFile = (
  repoPath: string,
  absolutePath: string,
  stat: Stats,
  isSymlink: boolean,
): LocalReadinessFile | undefined => {
  const extension = path.extname(repoPath).toLowerCase()

  const binary = isSymlink ? false : isLikelyBinary(absolutePath, extension, stat.size)

  return {
    path: repoPath,
    sizeBytes: stat.size,
    extension,
    binary,
    generated: isGeneratedPath(repoPath),
    minified: isMinifiedPath(repoPath),
    documentation: isDocumentationPath(repoPath, extension),
    test: testPathPattern.test(repoPath) || isTestFilePath(repoPath),
    source: isSourcePath(repoPath, extension),
  }
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
  const trackedPaths = options.respectGitignore === false ? undefined : loadTrackedPaths(root)

  // `.git` lives as a regular file (not a directory) inside the linked
  // worktrees `diff` creates, so ignore it by name as well as by directory.
  const relativePaths = fastGlob.sync('**/*', {
    cwd: root,
    dot: true,
    // Include symlink entries so a tracked root README symlink is still counted
    // as a documentation entrypoint without following or reading its target.
    onlyFiles: false,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: [
      ...ignoredDirectories.map(dir => `**/${dir}/**`),
      ...ignoredDirectories.map(dir => `**/${dir}`),
    ],
  })

  const files: LocalReadinessFile[] = []
  const rootRealPath = realpathSync(root)

  for (const relativePath of relativePaths) {
    const repoPath = normalizeRepoPath(relativePath)

    if (!shouldIncludeWalkedPath(repoPath, config, gitignoreMatchers, trackedPaths)) {
      continue
    }

    const absolutePath = path.join(root, relativePath)

    let stat
    try {
      // lstat (not stat) so symlink entries are classified by path only and
      // never dereferenced. Combined with followSymbolicLinks:false, this keeps
      // us from reading targets, including targets outside the repository.
      stat = lstatSync(absolutePath)
    } catch (error) {
      // Tolerate files that disappear mid-walk or cannot be stat'd (permissions),
      // matching how binary sampling already handles read errors.
      console.warn(`AgentReady: unable to stat file, skipping (${absolutePath}): ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    const isSymlink = stat.isSymbolicLink()
    if (!stat.isFile() && !isSymlink) {
      continue
    }

    // Symlinks are classified by path only and never read. Keep only safe
    // documentation symlinks visible: they must resolve to a regular file inside
    // this repository so broken or external README links do not receive readiness
    // credit, and manifest/workflow links stay out of downstream readers.
    if (isSymlink && !shouldIncludeSymlink(repoPath, absolutePath, rootRealPath)) {
      continue
    }

    const file = toLocalReadinessFile(repoPath, absolutePath, stat, isSymlink)
    if (file) {
      files.push(file)
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path))
}
