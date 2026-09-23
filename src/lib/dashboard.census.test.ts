import { describe, it, expect } from 'vitest'
import { enrollmentCensus, withdrawals } from './dashboard'
import { emptyReport, type DailyOpsReport, type SiteId } from './schema'

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
    expect(c.capacity).toBe(110)
    expect(c.pct).toBe(86)
    expect(c.open).toBe(15)
    expect(c.delta).toBe(2) // 95 now vs 93 last week
    expect(c.bySite[0]).toMatchObject({ siteId: 'crozet', enrolled: 95 })
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
