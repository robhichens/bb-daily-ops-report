import { describe, it, expect, vi } from 'vitest'
// users.ts pulls in the Firebase client at import; stub it so this stays a pure
// unit test of the access logic (vi.mock is hoisted above the import below).
vi.mock('./firebase', () => ({ auth: {}, db: {} }))
import { reportAccessLevel, accessibleReportKeys, canAccessDor, type UserProfile } from './users'

const coDirector: UserProfile = {
  uid: 'c', role: 'co_director', siteIds: ['mill-creek'], siteId: 'mill-creek', reportAccess: { edr: 'fill' },
}
const director: UserProfile = { uid: 'd', role: 'director', siteIds: ['crozet'], siteId: 'crozet' }

describe('co-director access', () => {
  it('can open the DOR app', () => {
    expect(canAccessDor('co_director')).toBe(true)
  })

  it('fills the CDR but NOT the DDR — even though it has a campus', () => {
    expect(reportAccessLevel(coDirector, 'edr')).toBe('fill')
    expect(reportAccessLevel(coDirector, 'ddr')).toBeNull()
  })

  it('only surfaces the CDR to a co-director', () => {
    expect(accessibleReportKeys(coDirector)).toEqual(['edr'])
  })

  it('a site director still auto-gets the DDR (and not the CDR)', () => {
    expect(reportAccessLevel(director, 'ddr')).toBe('fill')
    expect(reportAccessLevel(director, 'edr')).toBeNull()
  })
})

describe('finance / admissions scoped roles', () => {
  const finance: UserProfile = { uid: 'f', role: 'finance', reportAccess: { fdr: 'fill' } }
  const admissions: UserProfile = { uid: 'a', role: 'admissions', reportAccess: { adr: 'fill' } }

  it('can open the DOR app', () => {
    expect(canAccessDor('finance')).toBe(true)
    expect(canAccessDor('admissions')).toBe(true)
  })

  it('each sees only its own report — never the DDR or everything', () => {
    expect(reportAccessLevel(finance, 'fdr')).toBe('fill')
    expect(reportAccessLevel(finance, 'ddr')).toBeNull()
    expect(reportAccessLevel(finance, 'adr')).toBeNull()
    expect(accessibleReportKeys(finance)).toEqual(['fdr'])

    expect(reportAccessLevel(admissions, 'adr')).toBe('fill')
    expect(reportAccessLevel(admissions, 'fdr')).toBeNull()
    expect(accessibleReportKeys(admissions)).toEqual(['adr'])
  })
})
