import { describe, expect, it, vi } from 'vitest'
// orgReports.ts pulls in the Firebase client at import; stub it so this stays a
// pure unit test (vi.mock is hoisted above the imports below).
vi.mock('./firebase', () => ({ auth: {}, db: {} }))
import { collectOrgRequests } from './orgReports'
import { buildRequestsPrintModel, itemSchool } from './requestPrint'
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

  it('lands on the list dated the day it was written, named for its author, under HQ when untagged', () => {
    const [item] = collectOrgRequests([note()], 'maintenance')
    expect(item).toMatchObject({ kind: 'org', contextLabel: 'Katlin Gordon', date: '2026-11-10', noteId: 'n1' })
    expect(itemSchool(item)).toBe('Org-wide (HQ)')
  })

  it('is tagged like a director request — "Campus · Author" — and groups under its campus', () => {
    const [item] = collectOrgRequests([note({ siteId: 'forest-lakes' })], 'maintenance')
    expect(item.contextLabel).toBe('Forest Lakes · Katlin Gordon') // cf. "Mill Creek · Laura Baker"
    expect(itemSchool(item)).toBe('Forest Lakes')
  })

  it('names the author in the printed list too (the "who asked" column)', () => {
    const items = collectOrgRequests(
      [note({ id: 'a', siteId: 'forest-lakes' }), note({ id: 'b', text: 'Printer is out of toner', author: 'Rob Hichens' })],
      'maintenance'
    )
    const model = buildRequestsPrintModel([{ list: 'maintenance', label: 'Maintenance Requests', items }], '2026-11-11')
    const rows = model.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'table' ? b.table.rows : [])))
    expect(rows.map((r) => r[2]).sort()).toEqual(['Katlin Gordon', 'Rob Hichens'])
  })

  it('falls back to NOTE if a note somehow has no author', () => {
    const [item] = collectOrgRequests([note({ author: '  ' })], 'maintenance')
    expect(item.contextLabel).toBe('NOTE')
  })

  it('report notes keep their report label (the CDR is the exception, below)', () => {
    const [adr] = collectOrgRequests([note({ source: 'adr', siteId: 'crozet' })], 'maintenance')
    expect(adr.contextLabel).toBe('ADR · Crozet')
  })

  it('a CDR note names its campus and co-director — "CDR · Crozet · Name"', () => {
    const [cdr] = collectOrgRequests([note({ source: 'edr', siteId: 'crozet', author: 'Cam Ward' })], 'maintenance') // the CDR reuses the old key
    expect(cdr.contextLabel).toBe('CDR · Crozet · Cam Ward')
    const [older] = collectOrgRequests([note({ source: 'edr', author: 'Cam Ward' })], 'maintenance') // posted before the campus was saved
    expect(older.contextLabel).toBe('CDR · Cam Ward')
    const [bare] = collectOrgRequests([note({ source: 'edr', author: '' })], 'maintenance')
    expect(bare.contextLabel).toBe('CDR')
  })
})
