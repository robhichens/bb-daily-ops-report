import { describe, expect, it, vi } from 'vitest'
// orgReports.ts pulls in the Firebase client at import; stub it so this stays a
// pure unit test (vi.mock is hoisted above the imports below).
vi.mock('./firebase', () => ({ auth: {}, db: {} }))
import { collectOrgRequests } from './orgReports'
import { itemSchool } from './requestPrint'
import { localDateOf } from './dates'
import { reportMeta, sourceShort } from './reportRegistry'
import { ADMIN_NOTE_SOURCE, type LedgerNote } from './schema'

describe('localDateOf', () => {
  it('keeps an evening note on the day it was written (not the UTC day)', () => {
    // 8:30pm local on Nov 10 is already Nov 11 in UTC for anyone west of Greenwich.
    const evening = new Date(2026, 10, 10, 20, 30).toISOString()
    expect(localDateOf(evening)).toBe('2026-11-10')
    expect(localDateOf(new Date(2026, 10, 10, 6, 15).toISOString())).toBe('2026-11-10')
  })

  it('is empty for a bad timestamp instead of throwing', () => {
    expect(localDateOf('')).toBe('')
    expect(localDateOf('not a date')).toBe('')
  })
})

describe('sourceShort', () => {
  it('shows the report code, NOTE for a standalone admin note, and never crashes on a retired key', () => {
    expect(sourceShort('adr')).toBe('ADR')
    expect(sourceShort('edr')).toBe('CDR') // the CDR reuses the old executive key
    expect(sourceShort(ADMIN_NOTE_SOURCE)).toBe('NOTE')
    expect(sourceShort('mdr')).toBe('MDR') // retired report: raw key, not a blank
  })

  it('treats an admin note as "not a report"', () => {
    expect(reportMeta(ADMIN_NOTE_SOURCE)).toBeUndefined()
  })
})

describe('a standalone admin note filed to a Buy/Fix list', () => {
  const note = (over: Partial<LedgerNote> = {}): LedgerNote => ({
    id: 'n1',
    source: ADMIN_NOTE_SOURCE,
    siteId: null,
    text: 'Front office door lock is sticking',
    author: 'Katlin Gordon',
    authorUid: 'u1',
    at: new Date(2026, 10, 10, 20, 30).toISOString(),
    acked: false,
    flagged: false,
    comments: [],
    requests: [{ list: 'maintenance' }],
    ...over,
  })

  it('lands on the list dated the day it was written, labelled NOTE, under HQ when untagged', () => {
    const [item] = collectOrgRequests([note()], 'maintenance')
    expect(item).toMatchObject({ kind: 'org', contextLabel: 'NOTE', date: '2026-11-10', noteId: 'n1' })
    expect(itemSchool(item)).toBe('Org-wide (HQ)')
  })

  it('groups under its campus when one was chosen', () => {
    const [item] = collectOrgRequests([note({ siteId: 'forest-lakes' })], 'maintenance')
    expect(item.contextLabel).toBe('NOTE · Forest Lakes')
    expect(itemSchool(item)).toBe('Forest Lakes')
  })

  it('a CDR note on the list now reads CDR, not the old EDR key', () => {
    const [item] = collectOrgRequests([note({ source: 'edr' })], 'maintenance')
    expect(item.contextLabel).toBe('CDR')
  })
})
