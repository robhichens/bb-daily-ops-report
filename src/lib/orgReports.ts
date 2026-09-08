// src/lib/orgReports.ts
// Generic Firestore layer for the config-driven org reports (ADR/MDR/EDR).
// Each report has two collections named in its OrgReportDef:
//   • <collection>       — one doc per DAY (id = 'YYYY-MM-DD'); the field values.
//   • <notesCollection>  — one doc per note; the running Flags & Notes ledger.
// All admin/assignment gating is enforced in firestore.rules.

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

import { where } from 'firebase/firestore'
import { db } from './firebase'
import { weekOf as weekOfFn, weekdayName } from './derive'
import type { LedgerNote, LedgerNoteComment, OrgReport, OrgReportDef, ReportKey, SiteId } from './schema'

// --- Daily report doc -------------------------------------------------------

const reportRef = (col: string, date: string) => doc(db, col, date)

/** A blank report for a def/date — every field seeded (0 for numeric, '' text). */
export function emptyOrgReport(def: OrgReportDef, date: string, uid = ''): OrgReport {
  const now = new Date().toISOString()
  const data: Record<string, Record<string, number | string>> = {}
  for (const s of def.sections) {
    data[s.key] = {}
    for (const f of s.fields) data[s.key][f.key] = f.kind === 'text' ? '' : 0
    if (s.note) data[s.key].note = ''
  }
  return {
    id: date, date, day: '', weekOf: '', completedBy: '',
    data,
    status: 'draft', submittedAt: null, createdAt: now, updatedAt: now, createdByUid: uid,
  }
}

function withDerived(r: OrgReport): OrgReport {
  return { ...r, day: weekdayName(r.date), weekOf: weekOfFn(r.date) }
}

export function subscribeOrgReport(
  col: string,
  date: string,
  cb: (report: OrgReport | null) => void
): Unsubscribe {
  return onSnapshot(reportRef(col, date), (snap) =>
    cb(snap.exists() ? (snap.data() as OrgReport) : null)
  )
}

export async function getOrgReport(col: string, date: string): Promise<OrgReport | null> {
  const snap = await getDoc(reportRef(col, date))
  return snap.exists() ? (snap.data() as OrgReport) : null
}

export async function upsertOrgDraft(col: string, report: OrgReport): Promise<void> {
  const payload: OrgReport = {
    ...withDerived(report),
    status: report.status === 'submitted' ? 'submitted' : 'draft',
    updatedAt: new Date().toISOString(),
  }
  await setDoc(reportRef(col, payload.date), payload, { merge: true })
}

export async function submitOrgReport(col: string, report: OrgReport, uid: string): Promise<void> {
  const now = new Date().toISOString()
  const payload: OrgReport = {
    ...withDerived(report),
    status: 'submitted', submittedAt: now, updatedAt: now,
    createdByUid: report.createdByUid || uid,
  }
  await setDoc(reportRef(col, payload.date), payload, { merge: true })
}

// --- Flags & Notes — ONE central ledger for every report --------------------
// All reports (FDR/ADR/MDR/EDR) write to `orgDayNotes`, tagged by `source`.
// A report page subscribes to its own source; the main Day Notes board (admins)
// subscribes to all of them.

const NOTES = 'orgDayNotes'
const notesCol = () => collection(db, NOTES)
const noteRef = (id: string) => doc(db, NOTES, id)

const mapNotes = (docs: { id: string; data: () => unknown }[]): LedgerNote[] =>
  docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerNote, 'id'>) }))

/** One report's notes (for the report page). No orderBy — avoids needing a
 *  composite index; the NotesLedger sorts (flagged first, newest first). */
export function subscribeOrgNotesBySource(source: ReportKey, cb: (notes: LedgerNote[]) => void): Unsubscribe {
  return onSnapshot(
    query(notesCol(), where('source', '==', source), limit(500)),
    (snap) => cb(mapNotes(snap.docs))
  )
}

/** Every report's notes (for the admin Day Notes board). */
export function subscribeAllOrgNotes(cb: (notes: LedgerNote[]) => void): Unsubscribe {
  return onSnapshot(query(notesCol(), orderBy('at', 'desc'), limit(1000)), (snap) => cb(mapNotes(snap.docs)))
}

export async function addOrgNote(
  source: ReportKey, text: string, author: string, uid: string, siteId: SiteId | null = null
): Promise<void> {
  const t = text.trim()
  if (!t) return
  await addDoc(notesCol(), {
    source, siteId, text: t, author, authorUid: uid, at: new Date().toISOString(),
    acked: false, flagged: false, comments: [],
  })
}

export async function setOrgNoteAck(id: string, acked: boolean): Promise<void> {
  await updateDoc(noteRef(id), { acked })
}

export async function setOrgNoteFlag(id: string, flagged: boolean): Promise<void> {
  await updateDoc(noteRef(id), { flagged })
}

export async function addOrgNoteComment(
  id: string,
  existing: LedgerNoteComment[] | undefined,
  comment: LedgerNoteComment
): Promise<void> {
  const text = comment.text.trim()
  if (!text) return
  await updateDoc(noteRef(id), { comments: [...(existing ?? []), { ...comment, text }] })
}

export async function deleteOrgNote(id: string): Promise<void> {
  await deleteDoc(noteRef(id))
}
