import { describe, expect, it } from 'vitest'
import { adrSummary, cdrSummary, fdrSummary } from './dashboardReports'
import { emptyFinanceReport, type FinanceReport, type OrgReport, type SiteId } from './schema'

function org(date: string, data: OrgReport['data'], siteId: SiteId | null = null, status: OrgReport['status'] = 'submitted'): OrgReport {
  return {
    id: siteId ? `${siteId}_${date}` : date, date, day: '', weekOf: '', siteId, completedBy: '', data,
    status, submittedAt: null, createdAt: '', updatedAt: '', createdByUid: '',
  }
}

describe('cdrSummary', () => {
  const cdr = (date: string, siteId: SiteId, leads: number, complete: boolean, status: OrgReport['status'] = 'submitted') =>
    org(date, {
      enrollment: { newLeads: leads, toursDone: 1 },
      hiring: { applicants: 2, interviews: [{ name: 'Sam', campus: siteId }, { name: '', campus: '' }] },
      social: { posts: [{ what: 'Open house', page: 'BB' }] },
      facility: { complete, reason: complete ? '' : 'Short staffed' },
    }, siteId, status)

  it('scopes to the viewer’s campuses and counts only submitted days', () => {
    const rows = [
      cdr('2026-09-21', 'crozet', 3, true),
      cdr('2026-09-22', 'crozet', 2, false),
      cdr('2026-09-22', 'mill-creek', 9, true),
      cdr('2026-09-23', 'crozet', 5, true, 'draft'),
    ]
    const s = cdrSummary(rows, [cdr('2026-09-14', 'crozet', 1, true)], ['crozet'])
    expect(s.bySite.map((x) => x.siteId)).toEqual(['crozet'])
    expect(s.total.filed).toBe(2)
    expect(s.total.newLeads).toBe(5)
    expect(s.total.interviews).toBe(2) // blank list rows don't count
    expect(s.total.socialPosts).toBe(2)
    expect(s.total.closingDone).toBe(1)
    expect(s.prevTotal.newLeads).toBe(1)
    expect(s.closingMisses).toEqual([{ date: '2026-09-22', site: 'Crozet', reason: 'Short staffed' }])
  })
})

describe('adrSummary', () => {
  const adr = (date: string, inquiries: number, waitlist: number) =>
    org(date, {
      inquiries: { total: inquiries },
      conversion: { regFees: 1, regFeesAmt: 150, newEnrollments: 1 },
      pipeline: { activeLeads: 20, toursPending: 3, waitlist },
      attrition: { followUps: 4 },
    })

  it('sums flow numbers and takes the pipeline snapshot from the latest day', () => {
    const s = adrSummary([adr('2026-09-21', 4, 10), adr('2026-09-22', 6, 12)], [adr('2026-09-14', 3, 9)])
    expect(s.total.inquiries).toBe(10)
    expect(s.total.regFeesAmt).toBe(300)
    expect(s.prevTotal.inquiries).toBe(3)
    expect(s.pipeline).toEqual({ asOf: '2026-09-22', activeLeads: 20, toursPending: 3, waitlist: 12, followUps: 4 })
  })

  it('has no pipeline when nothing was filed', () => {
    expect(adrSummary([], []).pipeline).toBeNull()
  })
})

describe('fdrSummary', () => {
  function fin(date: string, status: FinanceReport['status'] = 'submitted'): FinanceReport {
    const r = emptyFinanceReport(date)
    r.status = status
    const c = r.locations.crozet
    c.paymentsByCheck = [{ who: 'A', what: 'Tuition', amount: 500 }]
    c.tuitionExpress = { achBatch: 1000, ccBatch: 200, ccPos: 0, note: '' }
    c.declinesRefunds = [{ type: 'Decline', parent: 'Smith', amount: 100 }]
    c.outstandingCurrent = { names: 'Jones', amount: date === '2026-09-22' ? 750 : 400 }
    r.locations['mill-creek'].paymentsByCheck = [{ who: 'B', what: 'Tuition', amount: 300 }]
    return r
  }

  it('nets deposits per location, keeps the latest balance, and lists declines', () => {
    const s = fdrSummary([fin('2026-09-21'), fin('2026-09-22'), fin('2026-09-23', 'draft')], [fin('2026-09-14')], ['crozet', 'forest-lakes', 'mill-creek'])
    expect(s.filed).toBe(2)
    const crozet = s.bySite.find((x) => x.siteId === 'crozet')!
    expect(crozet.deposits).toBe(2 * (500 + 1200 - 100))
    expect(crozet.outstandingCurrent).toBe(750)
    expect(s.total.deposits).toBe(2 * 1600 + 2 * 300)
    expect(s.prevDeposits).toBe(1600 + 300)
    expect(s.outstandingAsOf).toBe('2026-09-22')
    expect(s.declines).toHaveLength(2)
  })

  it('limits to the viewer’s locations', () => {
    const s = fdrSummary([fin('2026-09-21')], [], ['mill-creek'])
    expect(s.bySite.map((x) => x.siteId)).toEqual(['mill-creek'])
    expect(s.total.deposits).toBe(300)
    expect(s.declines).toHaveLength(0)
  })
})
