import { existsSync, writeFileSync } from 'fs'
import path from 'path'
import { defaultConfig } from './config'

export interface InitOptions {
  /** Also scaffold a starter AGENTS.md instruction file. */
  agents?: boolean
  /** Overwrite files that already exist instead of skipping them. */
  force?: boolean
}

export interface InitResult {
  /** Files written (relative to the target root). */
  created: string[]
  /** Files that already existed and were left untouched (no `force`). */
  skipped: string[]
}

// Starter instruction file. Deliberately short and prescriptive: it tells an
// agent where to look and which commands verify a change, which is exactly what
// the `instructions.missing` rule asks for.
const AGENTS_TEMPLATE = `# AGENTS.md

Guidance for AI coding agents working in this repository.

## Overview

<!-- One or two sentences: what this project is and where the main code lives. -->

## Setup

<!-- How to install dependencies from a clean checkout. -->

## Validation

Run these before proposing a change, and make sure they pass:

<!-- Replace with this repo's real commands, e.g.: -->
- Tests: \`npm test\`
- Lint: \`npm run lint\`
- Type-check: \`npm run type-check\`
- Build: \`npm run build\`

## Conventions

<!-- Code style, directory layout, and any do-not-touch areas. -->
`

const STARTER_CONFIG = `${JSON.stringify(defaultConfig, null, 2)}\n`

/**
 * Scaffolds starter AgentReady files into `root`. Existing files are skipped
 * unless `force` is set, so this is safe to run in a populated repository. The
 * result reports exactly what was created vs. skipped so callers can surface it.
 */
export const scaffoldInit = (root: string, options: InitOptions = {}): InitResult => {
  const targets: Array<{ name: string; content: string }> = [
    { name: '.agentready.json', content: STARTER_CONFIG },
  ]
  if (options.agents) {
    targets.push({ name: 'AGENTS.md', content: AGENTS_TEMPLATE })
  }

  const created: string[] = []
  const skipped: string[] = []
  for (const target of targets) {
    const absolute = path.join(root, target.name)
    if (existsSync(absolute) && !options.force) {
      skipped.push(target.name)
      continue
    }
    writeFileSync(absolute, target.content)
    created.push(target.name)
  }

  return { created, skipped }
}
