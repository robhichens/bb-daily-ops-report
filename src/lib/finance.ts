// src/lib/finance.ts
// Firestore data layer for the Finance Daily Ops Report (Alicia / Finance).
//  • `financeReports`  — one doc per DAY (id = 'YYYY-MM-DD'); the number sections.
//  • `financeNotes`    — one doc per note; the running Flags & Notes list.
// Both are admin-only (see firestore.rules). Mirrors reports.ts patterns.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from './firebase'
import { weekOf as weekOfFn, weekdayName } from './derive'
import {
  financeDocId,
  type FinanceNote,
  type FinanceNoteComment,
  type FinanceReport,
} from './schema'

// ---------------------------------------------------------------------------
// Daily finance report (the number sections)
// ---------------------------------------------------------------------------

const REPORTS = 'financeReports'
const reportRef = (date: string) => doc(db, REPORTS, financeDocId(date))
const reportsCol = () => collection(db, REPORTS)

/** Fill derived weekday + weekOf from the report's date. */
function withDerived(r: FinanceReport): FinanceReport {
  return { ...r, day: weekdayName(r.date), weekOf: weekOfFn(r.date) }
}

/** Live subscription to one day's finance report (null if none yet). */
export function subscribeFinanceReport(
  date: string,
  cb: (report: FinanceReport | null) => void
): Unsubscribe {
  return onSnapshot(reportRef(date), (snap) =>
    cb(snap.exists() ? (snap.data() as FinanceReport) : null)
  )
}

/** One-shot read of one day's finance report. */
export async function getFinanceReport(date: string): Promise<FinanceReport | null> {
  const snap = await getDoc(reportRef(date))
  return snap.exists() ? (snap.data() as FinanceReport) : null
}

/** Autosave: upsert as a draft (never downgrades a submitted report). */
export async function upsertFinanceDraft(report: FinanceReport): Promise<void> {
  const payload: FinanceReport = {
    ...withDerived(report),
    status: report.status === 'submitted' ? 'submitted' : 'draft',
    updatedAt: new Date().toISOString(),
  }
  await setDoc(reportRef(payload.date), payload, { merge: true })
}

/** Finalize: stamp submitted + submittedAt and write. */
export async function submitFinanceReport(report: FinanceReport, uid: string): Promise<void> {
  const now = new Date().toISOString()
  const payload: FinanceReport = {
    ...withDerived(report),
    status: 'submitted',
    submittedAt: now,
    updatedAt: now,
    createdByUid: report.createdByUid || uid,
  }
  await setDoc(reportRef(payload.date), payload, { merge: true })
}

/** Recent finance reports (newest first) — for the "filed" history strip. */
export function subscribeRecentFinanceReports(
  max: number,
  cb: (rows: FinanceReport[]) => void
): Unsubscribe {
  return onSnapshot(query(reportsCol(), orderBy('date', 'desc'), limit(max)), (snap) =>
    cb(snap.docs.map((d) => d.data() as FinanceReport))
  )
}

// ---------------------------------------------------------------------------
// Flags & Notes (running list — like Day Notes, plus a red flag)
// ---------------------------------------------------------------------------

const NOTES = 'financeNotes'
const notesCol = () => collection(db, NOTES)
const noteRef = (id: string) => doc(db, NOTES, id)

/** Live subscription to the whole running notes list (newest first). Sorting for
 *  the red-flag pin happens in the view so flagged items float up regardless. */
export function subscribeFinanceNotes(cb: (notes: FinanceNote[]) => void): Unsubscribe {
  return onSnapshot(query(notesCol(), orderBy('at', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinanceNote, 'id'>) })))
  )
}

/** Add a note to the running list. */
export async function addFinanceNote(text: string, author: string, uid: string): Promise<void> {
  const t = text.trim()
  if (!t) return
  await addDoc(notesCol(), {
    text: t,
    author,
    authorUid: uid,
    at: new Date().toISOString(),
    acked: false,
    flagged: false,
    comments: [],
  })
}

/** Check off / reopen a note (the read checkbox). */
export async function setFinanceNoteAck(id: string, acked: boolean): Promise<void> {
  await updateDoc(noteRef(id), { acked })
}

/** Red-flag / un-flag a note (pins to top, red border). */
export async function setFinanceNoteFlag(id: string, flagged: boolean): Promise<void> {
  await updateDoc(noteRef(id), { flagged })
}

/** Append one message to a note's thread. */
export async function addFinanceNoteComment(
  id: string,
  existing: FinanceNoteComment[] | undefined,
  comment: FinanceNoteComment
): Promise<void> {
  const text = comment.text.trim()
  if (!text) return
  await updateDoc(noteRef(id), { comments: [...(existing ?? []), { ...comment, text }] })
}

/** Delete a note outright (author or any admin). */
export async function deleteFinanceNote(id: string): Promise<void> {
  await deleteDoc(noteRef(id))
}
