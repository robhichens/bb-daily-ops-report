import { describe, expect, it } from 'vitest'
import { busiestInWeek, mondayOf, parseRollCall, parseRoomHeader, rollCallCells, rollCallRows, weekdaysOfMonth, type PdfPage, type PdfText } from './rollCall'

// A made-up page laid out like ProCare's "Monthly Roll Call w/Schedule": 21 day
// columns (August 2026's weekdays), counts printed ~10pt right of each letter.
const COL0 = 383
const STEP = 18
const LETTERS = 'MTWTF'.repeat(5).slice(0, 21).split('')
const t = (x: number, y: number, str: string): PdfText => ({ x, y, str })

function page(school: string, header: string, counts: number[] | null, opts: { wrapAt?: number } = {}): PdfPage {
  const items: PdfText[] = [t(300, 592, school), t(40, 563, 'August 2026'), t(300, 533, `${school} Roll Call`), t(40, 490, header)]
  LETTERS.forEach((l, i) => items.push(t(COL0 + i * STEP, 490, l)))
  items.push(t(40, 468, 'Doe, Jane'), t(40, 467, 'DOB: 1/1/2025')) // a child row — must be ignored
  if (counts) {
    items.push(t(234, 182, 'Daily Count:'), t(36, 182, `Total Count: ${Math.max(...counts)}`))
    counts.forEach((n, i) => {
      // long rows wrap: some numbers a point or two off the label's line
      const y = opts.wrapAt !== undefined && i >= opts.wrapAt ? 180 : 183
      items.push(t(COL0 + 10 + i * STEP, y, String(n)))
    })
  }
  return items
}

describe('parseRoomHeader', () => {
  it('splits room, age and teachers', () => {
    expect(parseRoomHeader('Lions:2-9mo Reagan/Saundra')).toMatchObject({ label: 'Lions', age: '2-9mo', teacherNames: ['Reagan', 'Saundra'], cont: false })
    expect(parseRoomHeader('Hippos:10-15mo Kim S/Lisa').teacherNames).toEqual(['Kim S', 'Lisa'])
    expect(parseRoomHeader('Zebras: 3s & 4s Krysten')).toMatchObject({ age: '3s & 4s', teacherNames: ['Krysten'] })
    expect(parseRoomHeader('Elephants:16-24mo. Cindy')).toMatchObject({ age: '16-24mo', teacherNames: ['Cindy'] })
    expect(parseRoomHeader('Cheetahs: Abby/Angelica (Cont)')).toMatchObject({ label: 'Cheetahs', age: '', teacherNames: ['Abby', 'Angelica'], cont: true })
  })
})

describe('parseRollCall', () => {
  const lions = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 9]
  const cheetahs = [17, 18, 18, 18, 18, 13, 14, 14, 14, 13, 11, 11, 11, 11, 11, 10, 11, 11, 11, 11, 10]
  const rc = parseRollCall([
    page('Mill Creek', 'Lions:2-9mo Reagan/Saundra', lions),
    page('Mill Creek', 'Cheetahs: Abby/Angelica', null), // first page of a long room: no count yet
    page('Mill Creek', 'Cheetahs: Abby/Angelica (Cont)', cheetahs, { wrapAt: 9 }),
  ])

  it('reads school, month and each room’s daily counts in date order', () => {
    expect(rc.siteId).toBe('mill-creek')
    expect(rc.month).toBe('August 2026')
    expect(rc.days).toEqual(weekdaysOfMonth(2026, 7))
    expect(rc.days).toHaveLength(21)
    expect(rc.rooms.map((r) => r.label)).toEqual(['Lions', 'Cheetahs']) // "(Cont)" merged
    expect(rc.days.map((d) => rc.rooms[0].daily[d])).toEqual(lions)
    expect(rc.days.map((d) => rc.rooms[1].daily[d])).toEqual(cheetahs)
    expect(rc.warnings).toEqual([])
  })

  it('takes the busiest day of the upload week and counts teachers', () => {
    expect(mondayOf('2026-08-19')).toBe('2026-08-17')
    expect(busiestInWeek(rc.rooms[0].daily, '2026-08-17')).toBe(7) // 6 6 7 7 7
    expect(busiestInWeek(rc.rooms[0].daily, '2026-10-19')).toBeNull() // not in this month's roll call
    const rows = rollCallRows(rc, '2026-08-17')
    expect(rows).toEqual([
      expect.objectContaining({ roomKey: 'lions', kids: 7, teachers: 2 }),
      expect.objectContaining({ roomKey: 'cheetahs', kids: 11, teachers: 2 }),
    ])
    // Mill Creek: Lions 2 × 4 − 7 = 1; Cheetahs 2 × 10 − 11 = 9
    expect(rollCallCells('mill-creek', rows)).toMatchObject({ __calc: 1, 'mill-creek_lions': 1, 'mill-creek_cheetahs': 9 })
  })

  it('warns when the school or a room isn’t recognised', () => {
    const odd = parseRollCall([page('Somewhere Else', 'Penguins:5yr Ana', lions)])
    expect(odd.siteId).toBeNull()
    expect(odd.warnings.join(' ')).toMatch(/which school/)
    expect(odd.warnings.join(' ')).toMatch(/Penguins/)
  })
})

describe('mergeOpeningsSources (ADR grid vs roll call uploads)', () => {
  it('uses whichever is newer for each school and says where each came from', async () => {
    const { mergeOpeningsSources } = await import('./dashboard')
    const adr = { date: '2026-10-09', cells: { __calc: 1, crozet_lions: 2, 'mill-creek_lions': 3 } }
    const rollCalls = { crozet: { date: '2026-10-19', cells: { __calc: 1, crozet_lions: 1, crozet_cheetahs: 9 } } }
    const o = mergeOpeningsSources(adr, rollCalls, ['crozet', 'mill-creek'])
    const open = Object.fromEntries(o.rooms.map((r) => [`${r.siteId}_${r.room}`, r.open]))
    expect(open).toEqual({ crozet_Lions: 1, crozet_Cheetahs: 9, 'mill-creek_Lions': 3 }) // Crozet from the roll call, Mill Creek from the ADR
    expect(o.sourceNote).toBe('Roll call wk of Oct 19: Crozet · ADR Oct 9: Mill Creek')
    expect(o.asOfDate).toBe('2026-10-19')
  })

  it('falls back to the ADR when a school has no upload, and shows nothing with neither', async () => {
    const { mergeOpeningsSources } = await import('./dashboard')
    expect(mergeOpeningsSources(null, {}, ['crozet']).rooms).toEqual([])
    const older = { 'mill-creek': { date: '2026-10-05', cells: { __calc: 1, 'mill-creek_lions': 9 } } }
    const o = mergeOpeningsSources({ date: '2026-10-09', cells: { __calc: 1, 'mill-creek_lions': 3 } }, older, ['mill-creek'])
    expect(o.rooms[0].open).toBe(3)
    expect(o.sourceNote).toBe('ADR Oct 9')
  })
})
