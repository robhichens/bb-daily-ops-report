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
import type { DailyOpsReport, OrgReport, SiteId } from './schema'

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

export function subscribeOpeningsHeadline(cb: (h: OpeningsHeadline | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, COL, OPENINGS_ID),
    (snap) => cb(snap.exists() ? (snap.data() as OpeningsHeadline) : null),
    () => cb(null)
  )
}

export const headlinePoints = (rows: DdrHeadline[]): CensusPoint[] =>
  rows.map((h) => ({ siteId: h.siteId, date: h.date, fullTime: h.fullTime }))
