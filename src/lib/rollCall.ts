// src/lib/rollCall.ts
// Reads ProCare's "Monthly Roll Call w/Schedule" PDF (FD_Rollcall17.rpt) into
// per-room counts for Openings to Staff. One page per room (long rooms continue
// on a "(Cont)" page); each page has:
//   - "<School> Roll Call"                       → which school
//   - "<Month> <Year>"                            → which weekdays the columns are
//   - "Lions:2-9mo Reagan/Saundra  M T W T F …"   → room, age, teachers, day columns
//   - "Daily Count:" + one number per day column  → children scheduled that day
// Only counts and teacher names are kept — never children's names or birthdays.
//
// Pure functions over positioned text (x, y, str) so they can be tested without a
// PDF; lib/rollCallPdf.ts does the PDF → text step in the browser.

import { CLASSROOMS, SITES, matrixCellKey, openingsFor, staffingKey, STAFFING_CALC_FLAG, type SiteId } from './schema'
import { addIsoDays } from './dates'

export interface PdfText { x: number; y: number; str: string }
export type PdfPage = PdfText[]

export interface RollCallRoom {
  roomKey: string | null // matched CLASSROOMS key, null if the name wasn't recognised
  label: string // as printed, e.g. "Lions"
  age: string // e.g. "2-9mo"
  teacherNames: string[]
  daily: Record<string, number> // ISO date → children scheduled
}

export interface RollCall {
  siteId: SiteId | null
  schoolName: string
  month: string // "August 2026"
  days: string[] // ISO weekdays of the month, in column order
  rooms: RollCallRoom[]
  warnings: string[]
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const DAY_LETTERS = new Set(['M', 'T', 'W', 'F'])
const SAME_LINE = 4 // points

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

/** Mon–Fri dates of a month, in order. */
export function weekdaysOfMonth(year: number, monthIdx: number): string[] {
  const out: string[] = []
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(year, monthIdx, d)
    if (dt.getMonth() !== monthIdx) break
    const wd = dt.getDay()
    if (wd >= 1 && wd <= 5) out.push(iso(year, monthIdx, d))
  }
  return out
}

/** Lines: items grouped by y (within SAME_LINE), each sorted left to right. */
function lines(page: PdfPage): { y: number; items: PdfText[]; text: string }[] {
  const groups: { y: number; items: PdfText[] }[] = []
  for (const it of [...page].sort((a, b) => b.y - a.y)) {
    const g = groups.find((x) => Math.abs(x.y - it.y) <= 1.5)
    if (g) g.items.push(it)
    else groups.push({ y: it.y, items: [it] })
  }
  return groups.map((g) => {
    const items = g.items.sort((a, b) => a.x - b.x)
    return { y: g.y, items, text: items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim() }
  })
}

/** "Lions:2-9mo Reagan/Saundra" → name, age, teachers. Age = everything up to the
 *  last word with a digit ("3s & 4s", "2's", "16-24mo."); the rest are teachers. */
export function parseRoomHeader(raw: string): { label: string; age: string; teacherNames: string[]; cont: boolean } {
  const cont = /\(cont\)/i.test(raw)
  const text = raw.replace(/\(cont\)/gi, '').trim()
  const colon = text.indexOf(':')
  const label = (colon >= 0 ? text.slice(0, colon) : text.split(' ')[0]).trim()
  const rest = (colon >= 0 ? text.slice(colon + 1) : text.slice(label.length)).trim()
  const words = rest.split(/\s+/).filter(Boolean)
  let lastAge = -1
  words.forEach((w, i) => { if (/\d/.test(w)) lastAge = i })
  const age = words.slice(0, lastAge + 1).join(' ').replace(/\.$/, '')
  const teacherText = words.slice(lastAge + 1).join(' ')
  const teacherNames = teacherText.split('/').map((t) => t.trim()).filter(Boolean)
  return { label, age, teacherNames, cont }
}

const roomKeyFor = (label: string): string | null =>
  CLASSROOMS.find((c) => c.name.toLowerCase() === label.trim().toLowerCase())?.key ?? null

export function parseRollCall(pages: PdfPage[]): RollCall {
  const out: RollCall = { siteId: null, schoolName: '', month: '', days: [], rooms: [], warnings: [] }

  for (const [pi, page] of pages.entries()) {
    const ls = lines(page)

    if (!out.schoolName) {
      const m = ls.map((l) => l.text.match(/^(.+?)\s+Roll Call$/i)).find(Boolean)
      if (m) {
        out.schoolName = m[1].trim()
        out.siteId = SITES.find((s) => s.name.toLowerCase() === out.schoolName.toLowerCase())?.id ?? null
      }
    }
    if (!out.month) {
      const m = ls.map((l) => l.text.match(/^([A-Za-z]+)\s+(\d{4})$/)).find((x) => x && MONTHS.includes(x[1].toLowerCase()))
      if (m) {
        out.month = `${m[1]} ${m[2]}`
        out.days = weekdaysOfMonth(+m[2], MONTHS.indexOf(m[1].toLowerCase()))
      }
    }

    // The room header line is the one carrying the M T W T F day columns.
    const header = ls.find((l) => l.items.filter((i) => DAY_LETTERS.has(i.str.trim())).length >= 5)
    if (!header) continue
    const dayCols = header.items.filter((i) => DAY_LETTERS.has(i.str.trim())).map((i) => i.x).sort((a, b) => a - b)
    const firstCol = dayCols[0]
    const headerText = header.items.filter((i) => i.x < firstCol - 2).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim()
    const h = parseRoomHeader(headerText)

    let room = out.rooms[out.rooms.length - 1]
    if (!(h.cont && room && room.label.toLowerCase() === h.label.toLowerCase())) {
      room = { roomKey: roomKeyFor(h.label), label: h.label, age: h.age, teacherNames: h.teacherNames, daily: {} }
      out.rooms.push(room)
    }

    // Daily Count: the numbers on (or a few points around) the "Daily Count:" line,
    // each placed in the nearest day column. Long rows wrap onto 2–3 lines.
    const label = page.find((i) => /Daily Count/i.test(i.str))
    if (!label) continue
    if (dayCols.length !== out.days.length && out.days.length) {
      out.warnings.push(`Page ${pi + 1}: ${dayCols.length} day columns but ${out.month} has ${out.days.length} weekdays.`)
    }
    const nums = page
      .filter((i) => /^\d+$/.test(i.str.trim()) && Math.abs(i.y - label.y) <= SAME_LINE && i.x >= firstCol - 12)
      .sort((a, b) => a.x - b.x)
    // Counts sit a few points right of their day letter, so pair them in order
    // when there's one per column (the normal case). Otherwise shift by the
    // typical offset and take the nearest column.
    const offset = nums.length === dayCols.length
      ? 0
      : median(nums.map((n) => n.x)) - median(dayCols)
    nums.forEach((n, k) => {
      let col = k
      if (nums.length !== dayCols.length) {
        col = 0
        for (let c = 1; c < dayCols.length; c++) if (Math.abs(dayCols[c] + offset - n.x) < Math.abs(dayCols[col] + offset - n.x)) col = c
      }
      const date = out.days[col]
      if (date) room.daily[date] = +n.str.trim()
    })
  }

  if (!out.siteId) out.warnings.push(`Couldn’t tell which school this is${out.schoolName ? ` (“${out.schoolName}”)` : ''}.`)
  if (!out.month) out.warnings.push('Couldn’t find the month on the roll call.')
  for (const r of out.rooms) {
    if (!r.roomKey) out.warnings.push(`“${r.label}” isn’t one of the seven rooms, so it’s left out.`)
    else if (!Object.keys(r.daily).length) out.warnings.push(`${r.label}: no Daily Count found.`)
  }
  return out
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay() // 0 Sun … 6 Sat
  return addIsoDays(date, wd === 0 ? -6 : 1 - wd)
}

/** Busiest scheduled day in the week starting `monday` (null if the roll call has no days that week). */
export function busiestInWeek(daily: Record<string, number>, monday: string): number | null {
  const week = [0, 1, 2, 3, 4].map((i) => addIsoDays(monday, i))
  const counts = week.filter((d) => d in daily).map((d) => daily[d])
  return counts.length ? Math.max(...counts) : null
}

/** One reviewed room, ready to save. */
export interface RollCallRow { roomKey: string; label: string; age: string; kids: number; teachers: number; teacherNames: string[] }

/** Review rows for one school/week: busiest day's children + teacher count. */
export function rollCallRows(rc: RollCall, monday: string): RollCallRow[] {
  return CLASSROOMS.flatMap((c) => {
    const r = rc.rooms.find((x) => x.roomKey === c.key)
    if (!r) return []
    return [{ roomKey: c.key, label: c.name, age: r.age, kids: busiestInWeek(r.daily, monday) ?? 0, teachers: r.teacherNames.length, teacherNames: r.teacherNames }]
  })
}

/** Openings-grid cells for one school (same keys as the ADR grid). */
export function rollCallCells(siteId: SiteId, rows: RollCallRow[]): Record<string, number | string> {
  const cells: Record<string, number | string> = { [STAFFING_CALC_FLAG]: 1 }
  for (const r of rows) {
    cells[staffingKey(siteId, r.roomKey, 'kids')] = r.kids
    cells[staffingKey(siteId, r.roomKey, 'teachers')] = r.teachers
    cells[matrixCellKey(siteId, r.roomKey)] = openingsFor(siteId, r.roomKey, r.kids, r.teachers) ?? ''
  }
  return cells
}
