import { describe, expect, it } from 'vitest'
import { effectiveRatio, openingsFor } from './schema'

describe('classroom ratios', () => {
  it('uses the base ratio at Mill Creek and +1 per teacher at Crozet / Forest Lakes', () => {
    expect(effectiveRatio('mill-creek', 'cheetahs')).toBe(10)
    expect(effectiveRatio('crozet', 'cheetahs')).toBe(11)
    expect(effectiveRatio('forest-lakes', 'lions')).toBe(5)
    expect(effectiveRatio('mill-creek', 'monkeys')).toBe(8)
  })
})

describe('openingsFor (teachers × ratio − children)', () => {
  it("matches Rob's example: Cheetahs, 2 teachers, 13 children, 1:10 → 7", () => {
    expect(openingsFor('mill-creek', 'cheetahs', 13, 2)).toBe(7)
  })

  it('adds the waiver: same room at Crozet → 2 × 11 − 13 = 9', () => {
    expect(openingsFor('crozet', 'cheetahs', 13, 2)).toBe(9)
  })

  it('shows full (0) and over ratio (negative)', () => {
    expect(openingsFor('mill-creek', 'lions', 8, 2)).toBe(0)
    expect(openingsFor('mill-creek', 'lions', 9, 2)).toBe(-1)
  })

  it('is not calculable until a teacher count is entered', () => {
    expect(openingsFor('crozet', 'tigers', 12, 0)).toBeNull()
  })
})
