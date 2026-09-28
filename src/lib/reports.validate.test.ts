import { describe, expect, it, vi } from 'vitest'
// reports.ts pulls in the Firebase client at import; stub it (pure validation only).
vi.mock('./firebase', () => ({ auth: {}, db: {} }))
import { validateForSubmit } from './reports'
import { emptyReport } from './schema'

function ready() {
  const r = emptyReport('crozet', '2026-09-28')
  r.director = 'Jacqueline Lang'
  r.directorPacket.completed = true
  return r
}

describe('validateForSubmit — Full-Time Enrollment', () => {
  it('blocks submit while Full-Time Enrollment is 0 / blank', () => {
    const res = validateForSubmit(ready())
    expect(res.ok).toBe(false)
    expect(res.errors.join(' ')).toMatch(/Full-Time Enrollment/)
  })

  it('submits once a headcount is entered', () => {
    const r = ready()
    r.enrollmentMarketing.fullTimeEnrollment.count = 118
    expect(validateForSubmit(r)).toEqual({ ok: true, errors: [] })
  })
})
