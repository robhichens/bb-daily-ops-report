import { describe, expect, it, vi } from 'vitest'
// headlines.ts pulls in the Firebase client at import; stub it (pure logic only).
vi.mock('./firebase', () => ({ auth: {}, db: {} }))
import { ddrHeadline, headlinePoints } from './headlines'
import { censusFromPoints, enrollmentCensus, openingsFromCells, openingsToStaff } from './dashboard'
import { emptyReport, type OrgReport } from './schema'

function ddr(date: string, count: number, status: 'draft' | 'submitted' = 'submitted') {
  const r = emptyReport('crozet', date)
  r.status = status
  r.enrollmentMarketing.fullTimeEnrollment.count = count
  r.enrollmentMarketing.terminationsToday.items = [{ name: 'Ava R.', room: 'Zebras', terminationDate: date, reason: 'Moved away' }]
  return r
}

describe('ddrHeadline', () => {
  it('ignores drafts — only submitted days feed the pinned numbers', () => {
    expect(ddrHeadline(ddr('2026-09-22', 95, 'draft'))).toBeNull()
  })

  it('carries the headcount and withdrawals, and gives the same census as the full DDRs', () => {
    const rows = [ddr('2026-09-19', 90), ddr('2026-09-22', 95)]
    const prev = [ddr('2026-09-15', 93)]
    const h = rows.map((r) => ddrHeadline(r)!)
    expect(h[1]).toMatchObject({ kind: 'ddr', siteId: 'crozet', date: '2026-09-22', fullTime: 95 })
    expect(h[1].withdrawals[0]).toMatchObject({ name: 'Ava R.', reason: 'Moved away', site: 'Crozet' })

    const fromHeadlines = censusFromPoints(headlinePoints(h), headlinePoints(prev.map((r) => ddrHeadline(r)!)), ['crozet'])
    expect(fromHeadlines).toEqual(enrollmentCensus(rows, prev, ['crozet']))
  })
})

describe('openingsFromCells', () => {
  it('matches openingsToStaff on the same grid', () => {
    const adr = { date: '2026-09-22', data: { openingsToStaff: { crozet_lions: 3, 'mill-creek_tigers': -1 } } } as unknown as OrgReport
    const cells = adr.data.openingsToStaff as Record<string, unknown>
    const out = openingsFromCells(cells, adr.date, ['crozet', 'mill-creek'])
    expect(out.totalOpen).toBe(3)
    expect(out.rooms.map((r) => r.room)).toEqual(['Lions', 'Tigers'])
    expect(out).toEqual(openingsToStaff(adr, ['crozet', 'mill-creek']))
    expect(openingsFromCells(cells, adr.date, ['crozet']).rooms).toHaveLength(1) // scoped to the viewer's schools
  })
})
