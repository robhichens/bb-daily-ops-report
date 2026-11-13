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
  roomKey: string | null // matched CLASSROOMS key, null if neither the name nor the age was recognised
  byAge?: boolean // name wasn't one of the seven, so the room was placed by its age
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

// Words that belong to the age description rather than a teacher's name
// ("0-8 months", "2-year olds", "early threes", "Jr. K", "Toddlers").
const AGE_WORDS = new Set(['mo', 'mos', 'month', 'months', 'wk', 'wks', 'week', 'weeks', 'yr', 'yrs', 'year', 'years', 'old', 'olds',
  'toddler', 'toddlers', 'infant', 'infants', 'early', 'late', 'young', 'older', 'twos', 'threes', 'fours', 'ages', 'age',
  '&', 'and', '-', '/', 'jr', 'k', 'prek', 'pre', 'kindergarten', 'junior'])
const isAgeWord = (w: string) => /\d/.test(w) || AGE_WORDS.has(w.toLowerCase().replace(/[^a-z&/-]/g, ''))

/** "Lions:2-9mo Reagan/Saundra" → name, age, teachers. The age is the run of
 *  leading words that have a digit or are age words ("3s & 4s", "0-8 months",
 *  "early threes", "Jr. K"); the rest are teachers. Blank lines ("______") and
 *  "Closed" aren't teachers. */
export function parseRoomHeader(raw: string): { label: string; age: string; teacherNames: string[]; cont: boolean } {
  const cont = /\(cont\)/i.test(raw)
  const text = raw.replace(/\(cont\)/gi, '').trim()
  const colon = text.indexOf(':')
  const label = (colon >= 0 ? text.slice(0, colon) : text.split(' ')[0]).trim()
  const rest = (colon >= 0 ? text.slice(colon + 1) : text.slice(label.length)).trim()
  const words = rest.split(/\s+/).filter(Boolean)
  let n = 0
  while (n < words.length && isAgeWord(words[n])) n++
  const age = words.slice(0, n).join(' ').replace(/\.$/, '')
  const teacherNames = words.slice(n).join(' ').split('/')
    .map((t) => t.replace(/_+/g, ' ').trim())
    .filter((t) => /[a-z]/i.test(t) && !/^closed$/i.test(t))
  return { label, age, teacherNames, cont }
}

/** "Elephant", "ELEPHANTS", "Tigers's" → "elephant" / "tiger". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/s+$/, '')

/** Room by printed name, forgiving case, plurals and stray apostrophes. */
export const roomKeyFor = (label: string): string | null =>
  CLASSROOMS.find((c) => norm(c.name) === norm(label))?.key ?? null

/** Room by age, for a ProCare room still under an old name (e.g. Crozet's
 *  "Giraffe: 2's" → Monkeys, "Alligator: 3's & 4's" → Zebras). */
export function roomKeyForAge(age: string): string | null {
  const a = age.toLowerCase()
  if (/jr\.?\s*k|pre-?\s*k|kinder/.test(a)) return 'cheetahs'
  if (/\b3'?s?\s*(&|and|\/|-)\s*4|late\s*three|fours/.test(a)) return 'zebras'
  if (/\b3'?s\b|three/.test(a)) return 'tigers'
  if (/\b2'?s\b|\b2[\s-]*y(ea)?r|twos/.test(a)) return 'monkeys'
  if (/toddler|\b1[5-8]\s*-\s*2[4-9]/.test(a)) return 'elephants'
  if (/infant|week|wk|\b0\s*-|\b[0-3]\s*-\s*[6-9]\b|-\s*[6-9]\s*m/.test(a)) return 'lions'
  if (/\b(9|1[0-2])\s*-\s*1[2-8]/.test(a)) return 'hippos'
  return null
}

export function parseRollCall(pages: PdfPage[]): RollCall {
  const out: RollCall = { siteId: null, schoolName: '', month: '', days: [], rooms: [], warnings: [] }

  for (const [pi, page] of pages.entries()) {
    const ls = lines(page)

    if (!out.schoolName) {
      // "Crozet Roll Call", "Forest lakes Rollcall" — and the school's name is
      // also printed on its own at the top of every page.
      const m = ls.map((l) => l.text.match(/^(.+?)\s+Roll\s*-?\s*call$/i)).find(Boolean)
      const siteIn = (t: string) => SITES.find((s) => norm(t).includes(norm(s.name)))
      if (m) out.schoolName = m[1].trim()
      const site = (m && siteIn(m[1])) || SITES.find((s) => ls.some((l) => norm(l.text) === norm(s.name)))
      if (site) {
        out.siteId = site.id
        out.schoolName = site.name
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
      const byName = roomKeyFor(h.label)
      const byAge = byName ? null : roomKeyForAge(h.age)
      room = { roomKey: byName ?? byAge, label: h.label, age: h.age, teacherNames: h.teacherNames, daily: {} }
      if (byAge) room.byAge = true
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
  // A room placed by age only stands in when the real room isn't on the roll
  // call (Crozet's "Alligator" → Zebras). If the real room is there too it's a
  // separate room (Crozet's "Giraffe" beside Monkeys), so it's kept out of the
  // seven rather than merged into one.
  const extra = new Set<RollCallRoom>()
  for (const r of out.rooms) {
    if (!r.byAge || !r.roomKey) continue
    const first = out.rooms.find((x) => x.roomKey === r.roomKey && !x.byAge) ?? out.rooms.find((x) => x.roomKey === r.roomKey)
    if (first !== r) extra.add(r)
  }
  for (const r of out.rooms) {
    if (extra.has(r)) {
      const name = CLASSROOMS.find((c) => c.key === r.roomKey)?.name
      out.warnings.push(`“${r.label}” (${r.age}) is its own room, not one of the seven, so it isn’t counted — ${name} shows only the ${name} room.`)
      r.roomKey = null
      delete r.byAge
      continue
    }
    const name = CLASSROOMS.find((c) => c.key === r.roomKey)?.name
    if (!r.roomKey) out.warnings.push(`Couldn’t place “${r.label}${r.age ? ` (${r.age})` : ''}” in one of the seven rooms, so it’s left out.`)
    else if (!Object.keys(r.daily).length) out.warnings.push(`${r.label}: no Daily Count found.`)
    if (r.roomKey && r.byAge) out.warnings.push(`ProCare still calls one room “${r.label}” (${r.age}) — counted as ${name}.`)
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
