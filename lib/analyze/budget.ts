import type { AnalyzerTask } from './provider'

// Token budgets cap spend per task and per run (design §8). The tracker is
// advisory accounting: an analyzer asks whether a call of a given size is
// affordable before making it, and records usage after. Exhaustion is not an
// error — it just means remaining analyzers are skipped (fail-open).

export interface BudgetOptions {
  /** Max output tokens any single call may request. */
  perTaskTokens?: number
  /** Max total output tokens across the whole run. */
  perRunTokens?: number
}

const DEFAULT_PER_TASK = 4_000
const DEFAULT_PER_RUN = 60_000

export interface BudgetTracker {
  /** The per-call output cap to pass as `maxTokens`, given the task. */
  maxTokensFor(task: AnalyzerTask): number
  /** Whether at least `tokens` of run budget remain. */
  canAfford(tokens: number): boolean
  /** Record consumed output tokens after a call. */
  record(tokens: number): void
  /** Remaining run budget. */
  remaining(): number
}

export const createBudgetTracker = (options: BudgetOptions = {}): BudgetTracker => {
  const perTask = options.perTaskTokens ?? DEFAULT_PER_TASK
  const perRun = options.perRunTokens ?? DEFAULT_PER_RUN
  let used = 0

  return {
    maxTokensFor: () => Math.min(perTask, Math.max(0, perRun - used)),
    canAfford: tokens => used + tokens <= perRun,
    record: tokens => {
      used += Math.max(0, tokens)
    },
    remaining: () => Math.max(0, perRun - used),
  }
}
