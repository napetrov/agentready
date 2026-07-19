import { computeExperimentalFindingFields } from '../lib/repo-readiness/local-readiness'
import type { ReadinessFinding } from '../lib/repo-readiness/local-readiness'

const finding = (extra: Partial<ReadinessFinding> = {}): ReadinessFinding => ({
  id: 'f1',
  title: 'f1',
  severity: 'warning',
  recommendation: 'fix',
  ...extra,
})

describe('computeExperimentalFindingFields', () => {
  it('is empty when no finding carries confidence or scope', () => {
    expect(computeExperimentalFindingFields([finding()])).toEqual([])
  })

  it('flags confidence when present on any finding', () => {
    expect(computeExperimentalFindingFields([finding(), finding({ confidence: 'low' })])).toEqual(['confidence'])
  })

  it('flags scope when present on any finding', () => {
    expect(computeExperimentalFindingFields([finding({ scope: 'advisory' })])).toEqual(['scope'])
  })

  it('flags both in a stable order when both are present', () => {
    expect(computeExperimentalFindingFields([finding({ confidence: 'medium', scope: 'root' })])).toEqual([
      'confidence',
      'scope',
    ])
  })

  it('is empty for an empty finding list', () => {
    expect(computeExperimentalFindingFields([])).toEqual([])
  })
})
