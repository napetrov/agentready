import { CORPUS, FLOOR, corpusProvider, evaluateCorpus } from '../bin/agentready-eval'

// CI floor for the optional LLM analytics layer: run the real analyzer pipeline
// over the labeled offline corpus and assert precision/recall/F1 stay at or
// above the floor. This catches plumbing regressions (broken hallucination
// guards, dropped score folding, id-derivation drift) without calling a model.

describe('analytics-layer evaluation corpus', () => {
  it('meets the precision/recall/F1 floor over the gold corpus', async () => {
    const { metrics } = await evaluateCorpus()
    expect(metrics.precision).toBeGreaterThanOrEqual(FLOOR.precision)
    expect(metrics.recall).toBeGreaterThanOrEqual(FLOOR.recall)
    expect(metrics.f1).toBeGreaterThanOrEqual(FLOOR.f1)
  })

  it('rejects the hallucinated entries so they never become false positives', async () => {
    const { metrics } = await evaluateCorpus()
    // The corpus seeds ghost paths / ghost finding ids that the guards must drop.
    // If a guard regresses, those fire as insights and falsePositives climbs.
    expect(metrics.falsePositives).toBe(0)
    expect(metrics.truePositives).toBeGreaterThan(0)
  })

  it('produces the expected insight ids per case', async () => {
    const { perCase } = await evaluateCorpus()
    const byName = new Map(perCase.map(c => [c.name, c.producedIds]))

    expect(byName.get('conflicting-instructions')).toEqual(
      expect.arrayContaining([
        'analysis.instruction-quality:AGENTS.md',
        'analysis.instruction-quality:.cursorrules',
        'analysis.contradiction:package-manager:.cursorrules|AGENTS.md',
      ]),
    )
    // The hallucinated conflict produced no insight.
    expect(byName.get('clean-instructions-with-hallucination')?.some(id => id.includes('GHOST'))).toBe(false)
    // Only the real finding was credited as a false positive.
    expect(byName.get('false-positive-fixture')).toEqual(['analysis.false-positive:files.large:fixtures-data.bin'])
  })

  it('computes calibration buckets over the produced insights', async () => {
    const { calibration } = await evaluateCorpus()
    expect(calibration).toHaveLength(5)
    expect(calibration.reduce((sum, b) => sum + b.count, 0)).toBeGreaterThan(0)
  })

  it('routes by output schema to the matching canned response', async () => {
    const provider = corpusProvider({ contradiction: { contradictions: [{ topic: 't' }] } })
    const base = { system: 's', input: 'x', maxTokens: 10 } as const

    // A contradiction-shaped output schema routes to the contradiction response.
    const contradiction = await provider.complete({ task: 'contradiction', outputSchema: { properties: { contradictions: {} } }, ...base })
    expect(contradiction.output).toEqual({ contradictions: [{ topic: 't' }] })

    // An analyzer the case does not specify gets an empty (valid) response.
    const triage = await provider.complete({ task: 'triage', outputSchema: { properties: { assessments: { items: { properties: { actionable: {} } } } } }, ...base })
    expect(triage.output).toEqual({ assessments: [] })

    expect(CORPUS.length).toBeGreaterThanOrEqual(3)
  })
})
