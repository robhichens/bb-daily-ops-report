// src/lib/headlines.ts
// The shared "headline" record behind the dashboard's pinned Enrollment &
// Openings block. Everyone who reaches the DOR can read it (firestore.rules
// `headlines`), so co-directors, finance and admissions see the same headline
// numbers for their schools WITHOUT being able to read DDRs or ADRs.
//
//   headlines/ddr_<reportId>  — one per SUBMITTED DDR: that day's full-time
//                               headcount + any withdrawals (written by the
//                               director who files it)
//   headlines/openings        — the latest ADR's Openings-to-Staff grid
//                               (written whenever the ADR is saved)
//
// Mirroring never blocks a save: if a write is refused (e.g. rules not yet
// published) the report still saves and the headline just lags.

import { collection, doc, getDoc, onSnapshot, query, setDoc, where, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { withdrawals, type CensusPoint, type Withdrawal } from './dashboard'
import { STAFFING_CALC_FLAG, type DailyOpsReport, type OrgReport, type SiteId } from './schema'

const COL = 'headlines'
const OPENINGS_ID = 'openings'

export interface DdrHeadline {
  kind: 'ddr'
  siteId: SiteId
  date: string
  fullTime: number
  withdrawals: Withdrawal[]
  updatedAt: string
}

export interface OpeningsHeadline {
  kind: 'openings'
  date: string
  cells: Record<string, unknown>
  updatedAt: string
}

/** Build the headline for a DDR (null unless it's submitted — drafts never count). */
export function ddrHeadline(r: DailyOpsReport): DdrHeadline | null {
  if (r.status !== 'submitted') return null
  return {
    kind: 'ddr',
    siteId: r.siteId,
    date: r.date,
    fullTime: r.enrollmentMarketing.fullTimeEnrollment?.count ?? 0,
    withdrawals: withdrawals([r]),
    updatedAt: new Date().toISOString(),
  }
}

export async function mirrorDdrHeadline(r: DailyOpsReport): Promise<void> {
  const h = ddrHeadline(r)
  if (!h) return
  try {
    await setDoc(doc(db, COL, `ddr_${r.id}`), h)
  } catch (err) {
    console.warn('Headline mirror skipped (DDR)', err)
  }
}

/** Keep the openings headline on the LATEST ADR date (an older day being
 *  edited mustn't overwrite today's grid). */
export async function mirrorOpeningsHeadline(r: OrgReport): Promise<void> {
  // Only a calculated grid replaces the headline — an ADR filed with an empty
  // grid (or the old hand-typed one) mustn't blank out the last good numbers.
  const cells = (r.data?.openingsToStaff ?? {}) as Record<string, unknown>
  if (!cells[STAFFING_CALC_FLAG]) return
  try {
    const ref = doc(db, COL, OPENINGS_ID)
    const cur = await getDoc(ref)
    if (cur.exists() && String(cur.data().date ?? '') > r.date) return
    const h: OpeningsHeadline = {
      kind: 'openings',
      date: r.date,
      cells: (r.data?.openingsToStaff ?? {}) as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    }
    await setDoc(ref, h)
  } catch (err) {
    console.warn('Headline mirror skipped (openings)', err)
  }
}

/** DDR headlines whose date falls in [start, end]. */
export function subscribeDdrHeadlines(start: string, end: string, cb: (rows: DdrHeadline[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, COL), where('date', '>=', start), where('date', '<=', end)),
    (snap) => cb(snap.docs.map((d) => d.data()).filter((d): d is DdrHeadline => d.kind === 'ddr')),
    () => cb([])
  )
}

/** Every DDR headline dated on or before `end` — for "latest headcount so far"
 *  (the pinned enrollment cards never fall back to 0 just because today's DDR
 *  isn't in yet). One small doc per submitted DDR. */
export function subscribeDdrHeadlinesUpTo(end: string, cb: (rows: DdrHeadline[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, COL), where('date', '<=', end)),
    (snap) => cb(snap.docs.map((d) => d.data()).filter((d): d is DdrHeadline => d.kind === 'ddr')),
    () => cb([])
  )
}

export function subscribeOpeningsHeadline(cb: (h: OpeningsHeadline | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, COL, OPENINGS_ID),
    (snap) => cb(snap.exists() ? (snap.data() as OpeningsHeadline) : null),
    () => cb(null)
  )
}

// --- Roll call uploads (Openings to Staff from ProCare's Monthly Roll Call) ---

export interface RollCallRoomCount { kids: number; teachers: number; teacherNames: string[]; age: string }

/** headlines/rollcall_<site>_<monday>: one school's reviewed roll call for a week.
 *  `cells` uses the same keys as the ADR Openings grid, so the dashboard reads
 *  either source the same way. Counts and teacher names only — no children. */
export interface RollCallHeadline {
  kind: 'rollcall'
  siteId: SiteId
  date: string // Monday of the week it covers
  month: string // "October 2026" — which roll call it came from
  rooms: Record<string, RollCallRoomCount>
  cells: Record<string, number | string>
  uploadedBy: string
  updatedAt: string
}

export async function saveRollCall(h: Omit<RollCallHeadline, 'kind' | 'updatedAt'>): Promise<void> {
  const body: RollCallHeadline = { ...h, kind: 'rollcall', updatedAt: new Date().toISOString() }
  await setDoc(doc(db, COL, `rollcall_${h.siteId}_${h.date}`), body)
}

/** Every roll call upload (small: one doc per school per week). */
export function subscribeRollCalls(cb: (rows: RollCallHeadline[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, COL), where('kind', '==', 'rollcall')),
    (snap) => cb(snap.docs.map((d) => d.data() as RollCallHeadline)),
    () => cb([])
  )
}

/** The newest upload per school. */
export function latestRollCalls(rows: RollCallHeadline[]): Partial<Record<SiteId, RollCallHeadline>> {
  const out: Partial<Record<SiteId, RollCallHeadline>> = {}
  for (const r of rows) {
    const cur = out[r.siteId]
    if (!cur || r.date > cur.date || (r.date === cur.date && r.updatedAt > cur.updatedAt)) out[r.siteId] = r
  }
  return out
}

export const headlinePoints = (rows: DdrHeadline[]): CensusPoint[] =>
  rows.map((h) => ({ siteId: h.siteId, date: h.date, fullTime: h.fullTime }))
