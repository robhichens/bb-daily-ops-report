import { describe, expect, it, vi } from 'vitest'
vi.mock('./firebase', () => ({ auth: {}, db: {} }))
import { withoutAdminOwned } from './reports'
import { formatStamp } from './dates'
import { emptyReport } from './schema'

describe('director saves never carry leadership-owned fields', () => {
  it('drops comments, checks, flags and Buy/Fix tags but keeps the director’s own work', () => {
    const r = emptyReport('mill-creek', '2026-10-27')
    r.directorReport = ['Toilet is broken in Elephants']
    r.noteComments = [{ note: 'Toilet is broken in Elephants', text: 'Can you send a photo?', author: 'Rob', at: '2026-10-27T15:00:00Z', role: 'admin' }]
    r.acknowledgedNotes = ['Toilet is broken in Elephants']
    r.flaggedNotes = ['x']
    r.noteTags = [{ note: 'Toilet is broken in Elephants', list: 'maintenance' }]
    const out = withoutAdminOwned(r)
    expect(out).not.toHaveProperty('noteComments')
    expect(out).not.toHaveProperty('acknowledgedNotes')
    expect(out).not.toHaveProperty('flaggedNotes')
    expect(out).not.toHaveProperty('noteTags')
    expect(out.directorReport).toEqual(['Toilet is broken in Elephants'])
    expect(r.noteComments).toHaveLength(1) // the draft itself isn't mutated
  })
})

describe('formatStamp', () => {
  const now = new Date(2026, 9, 27, 12, 0)
  it('shows date and time, adding the year only when it is not this year', () => {
    const iso = new Date(2026, 9, 26, 14, 41).toISOString()
    expect(formatStamp(iso, now)).toBe('Oct 26, 2:41 PM')
    expect(formatStamp(new Date(2025, 11, 31, 9, 5).toISOString(), now)).toBe('Dec 31, 2025, 9:05 AM')
    expect(formatStamp('', now)).toBe('')
    expect(formatStamp('not a date', now)).toBe('')
  })
})
