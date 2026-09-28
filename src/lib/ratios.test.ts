import { describe, expect, it } from 'vitest'
import { carrySiteStaffing, effectiveRatio, openingsFor } from './schema'

describe('classroom ratios', () => {
  it('uses the base ratio at Mill Creek and +1 per teacher at Crozet / Forest Lakes', () => {
    expect(effectiveRatio('mill-creek', 'cheetahs')).toBe(10)
    expect(effectiveRatio('crozet', 'cheetahs')).toBe(11)
    expect(effectiveRatio('forest-lakes', 'lions')).toBe(5)
    expect(effectiveRatio('mill-creek', 'monkeys')).toBe(8)
  })

  it('uses a school override where one exists: Mill Creek Hippos is 1:4', () => {
    expect(effectiveRatio('mill-creek', 'hippos')).toBe(4)
    expect(effectiveRatio('crozet', 'hippos')).toBe(6) // base 5 + waiver
    expect(openingsFor('mill-creek', 'hippos', 8, 2)).toBe(0) // 2 × 4 − 8
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

describe("carrySiteStaffing (Copy from last report)", () => {
  const prev = {
    __calc: 1,
    crozet_cheetahs__kids: 13, crozet_cheetahs__teachers: 2, crozet_cheetahs: 9,
    "mill-creek_lions__kids": 7, "mill-creek_lions__teachers": 2, "mill-creek_lions": 1,
  }

  it("brings one school's children + teachers forward and recalculates openings", () => {
    const p = carrySiteStaffing(prev, "crozet")!
    expect(p.crozet_cheetahs__kids).toBe(13)
    expect(p.crozet_cheetahs__teachers).toBe(2)
    expect(p.crozet_cheetahs).toBe(9) // 2 × 11 − 13
    expect(p.crozet_lions).toBe("") // no teachers → not calculable
    expect(p.__calc).toBe(1)
    expect(Object.keys(p).some((k) => k.startsWith("mill-creek"))).toBe(false) // other schools untouched
  })

  it("returns null when the earlier grid had nothing for that school", () => {
    expect(carrySiteStaffing(prev, "forest-lakes")).toBeNull()
    expect(carrySiteStaffing({ crozet_cheetahs: 14 }, "crozet")).toBeNull() // old hand-typed grid
  })
})
