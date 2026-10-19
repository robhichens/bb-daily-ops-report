import { describe, expect, it } from 'vitest'
import { buildRequestsPrintModel, itemSchool } from './requestPrint'
import type { RequestItem } from './reports'

const item = (note: string, contextLabel: string, date: string, list: RequestItem['list'] = 'maintenance'): RequestItem =>
  ({ key: note, kind: 'ddr', note, list, contextLabel, date })

describe('buildRequestsPrintModel', () => {
  const fix = [
    item('Toilet broken in Elephants', 'Mill Creek · Laura Baker', '2026-08-19'),
    item('Front gutter broken', 'Mill Creek · Laura Baker', '2026-07-30'),
    item('Parking lot sign rusted', 'Forest Lakes · Jess Rybak', '2026-08-19'),
    item('Office printer jams', 'FDR · HQ', '2026-09-01'),
  ]

  it('groups by school (school order, HQ last), oldest first, with a tick column', () => {
    const m = buildRequestsPrintModel([{ list: 'maintenance', label: 'Maintenance Requests', items: fix }], '2026-10-19')
    expect(m.reportName).toBe('Maintenance Requests')
    expect(m.short).toBe('FIX')
    expect(m.meta.find((f) => f.label === 'Open items')?.value).toBe('4')
    expect(m.sections.map((s) => s.title)).toEqual(['Maintenance Requests · Forest Lakes', 'Mill Creek', 'Org-wide (HQ)'])
    const mc = m.sections[1].blocks[0]
    expect(mc.kind === 'table' && mc.table.rows.map((r) => r[1])).toEqual(['Front gutter broken', 'Toilet broken in Elephants'])
    expect(mc.kind === 'table' && mc.table.rows[0]).toEqual(['☐', 'Front gutter broken', 'Laura Baker', 'Jul 30'])
  })

  it('prints both lists on one sheet, and says when a list is empty', () => {
    const m = buildRequestsPrintModel(
      [
        { list: 'purchase', label: 'Purchase Requests', items: [] },
        { list: 'maintenance', label: 'Maintenance Requests', items: fix.slice(0, 1) },
      ],
      '2026-10-19'
    )
    expect(m.reportName).toBe('Purchase & Maintenance Requests')
    expect(m.short).toBe('BUY + FIX')
    expect(m.sections[0]).toMatchObject({ title: 'Purchase Requests', hint: 'Nothing open on this list.' })
  })

  it('reads the school from the context label', () => {
    expect(itemSchool(item('x', 'Crozet · Jacqueline Lang', '2026-09-01'))).toBe('Crozet')
    expect(itemSchool(item('x', 'ADR', '2026-09-01'))).toBe('Org-wide (HQ)')
  })
})
