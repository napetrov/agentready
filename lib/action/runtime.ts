import { appendFileSync } from 'fs'
import { EOL } from 'os'

// A minimal implementation of the GitHub Actions toolkit surface this action
// uses. The full @actions/core package pulls in @actions/http-client and
// undici (for getIDToken), which this action never calls; reimplementing the
// stable env/file-command contract keeps the bundled action small and
// dependency-free. See:
// https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions

const envForInput = (name: string): string =>
  `INPUT_${name.replace(/ /g, '_').toUpperCase()}`

export const getInput = (name: string): string =>
  (process.env[envForInput(name)] ?? '').trim()

export const getBooleanInput = (name: string): boolean => {
  const value = getInput(name)
  if (['true', 'True', 'TRUE'].includes(value)) return true
  if (['false', 'False', 'FALSE', ''].includes(value)) return false
  throw new Error(`Input "${name}" does not meet YAML 1.2 "Core Schema" specification: expected a boolean`)
}

export const setOutput = (name: string, value: string): void => {
  const file = process.env.GITHUB_OUTPUT
  if (file) {
    // Values here are single-line (numbers/paths); a simple key=value is safe.
    appendFileSync(file, `${name}=${value}${EOL}`)
  } else {
    process.stdout.write(`::set-output name=${name}::${value}${EOL}`)
  }
}

export const info = (message: string): void => {
  process.stdout.write(`${message}${EOL}`)
}

export const warning = (message: string): void => {
  process.stdout.write(`::warning::${message}${EOL}`)
}

export const setFailed = (message: string): void => {
  process.stdout.write(`::error::${message}${EOL}`)
  process.exitCode = 1
}

export const writeSummary = (markdown: string): void => {
  const file = process.env.GITHUB_STEP_SUMMARY
  if (file) {
    appendFileSync(file, `${markdown}${EOL}`)
  }
}
