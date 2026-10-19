import { describe, it, expect } from 'vitest'
import { censusFromPoints, enrollmentCensus, withdrawals, openingsToStaff } from './dashboard'
import { emptyReport, type DailyOpsReport, type OrgReport, type SiteId } from './schema'

function ft(site: SiteId, date: string, count: number): DailyOpsReport {
  const r = emptyReport(site, date)
  r.status = 'submitted'
  r.enrollmentMarketing.fullTimeEnrollment.count = count
  return r
}

describe('enrollmentCensus', () => {
  it('uses the latest FT count per site vs capacity, with week-over-week delta', () => {
    const rows = [ft('crozet', '2026-09-19', 90), ft('crozet', '2026-09-22', 95)]
    const last = [ft('crozet', '2026-09-15', 93)]
    const c = enrollmentCensus(rows, last, ['crozet'])
    expect(c.total).toBe(95) // the latest, not the earlier 90
    expect(c.capacity).toBe(135)
    expect(c.pct).toBe(70) // 95 / 135
    expect(c.open).toBe(40)
    expect(c.delta).toBe(2) // 95 now vs 93 last week
    expect(c.bySite[0]).toMatchObject({ siteId: 'crozet', enrolled: 95 })
  })
})

describe('census from the latest headcount (never 0 on a quiet day)', () => {
  it('uses the most recent submitted count even if it is older than the period', () => {
    const points = [
      { siteId: 'crozet' as const, date: '2026-10-14', fullTime: 50 },
      { siteId: 'crozet' as const, date: '2026-10-16', fullTime: 51 },
    ]
    // "Today" (10/19) has no DDR yet: the card still shows 51, as of 10/16.
    const c = censusFromPoints(points, points.filter((p) => p.date < '2026-10-19'), ['crozet'])
    expect(c.bySite[0]).toMatchObject({ enrolled: 51, asOf: '2026-10-16', delta: 0 })
    expect(censusFromPoints([], [], ['crozet']).bySite[0]).toMatchObject({ enrolled: 0, asOf: '' })
  })
})

describe('withdrawals', () => {
  it('pulls name / room / date / reason from termination items, newest first', () => {
    const r1 = emptyReport('crozet', '2026-09-18')
    r1.status = 'submitted'
    r1.enrollmentMarketing.terminationsToday.count = 1
    r1.enrollmentMarketing.terminationsToday.items = [{ name: 'Ava R.', room: 'Zebras', terminationDate: '2026-09-18', reason: 'Moved away' }]
    const r2 = emptyReport('mill-creek', '2026-09-22')
    r2.status = 'submitted'
    r2.enrollmentMarketing.terminationsToday.count = 1
    r2.enrollmentMarketing.terminationsToday.items = [{ name: 'Rowan D.', room: 'Lions', terminationDate: '2026-10-06', reason: 'Relocating' }]

    const out = withdrawals([r1, r2])
    expect(out.map((w) => w.name)).toEqual(['Rowan D.', 'Ava R.']) // last day 10-06 sorts above 09-18
    expect(out[0]).toMatchObject({ room: 'Lions', reason: 'Relocating', site: 'Mill Creek', date: '2026-10-06' })
  })
})

describe('openingsToStaff', () => {
  const adr: OrgReport = {
    id: '2026-09-22', date: '2026-09-22', day: '', weekOf: '', completedBy: '',
    data: {
      openingsToStaff: {
        __calc: 1,
        crozet_lions: 3,
        crozet_tigers: -1,
        'mill-creek_cheetahs': 5,
        'forest-lakes_hippos': 0,
      },
    },
    status: 'submitted', submittedAt: null, createdAt: '', updatedAt: '', createdByUid: '',
  }

  it('ranks entered rooms most-open first and totals only positive openings', () => {
    const o = openingsToStaff(adr)
    expect(o.rooms.map((r) => r.room)).toEqual(['Cheetahs', 'Lions', 'Hippos', 'Tigers']) // 5, 3, 0, -1
    expect(o.rooms[0]).toMatchObject({ site: 'Mill Creek', open: 5 })
    expect(o.totalOpen).toBe(8) // 5 + 3; the 0 and -1 don't add
    expect(o.asOfDate).toBe('2026-09-22')
  })

  it('ignores an old hand-typed grid (no calculated flag)', () => {
    const legacy = { ...adr, data: { openingsToStaff: { crozet_cheetahs: 14 } } }
    expect(openingsToStaff(legacy)).toEqual({ totalOpen: 0, asOfDate: '', rooms: [] })
  })

  it('is empty when there is no ADR yet', () => {
    const o = openingsToStaff(null)
    expect(o.rooms).toEqual([])
    expect(o.totalOpen).toBe(0)
  })
})
