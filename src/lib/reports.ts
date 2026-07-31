// src/lib/reports.ts
// Firestore data layer for the BB Daily Ops Report.
// One collection: `dailyOpsReports`, doc id `${siteId}_${date}` (one per site per day).
// Form uses subscribeReport + upsertDraft (autosave) + submitReport.
// Dashboard uses subscribeReportsByWeek + subscribeRecentReports (for the week picker).

import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import { withDerived } from './derive';
import {
  reportDocId,
  siteName,
  type DailyOpsReport,
  type NoteComment,
  type NoteTag,
  type RequestList,
  type SiteId,
} from './schema';

const COL = 'dailyOpsReports';
const reportsCol = () => collection(db, COL);
const reportRef = (id: string) => doc(db, COL, id);

// ---------------------------------------------------------------------------
// Single report (the form)
// ---------------------------------------------------------------------------

/** Live subscription to one site/day report. Calls back with null if none yet. */
export function subscribeReport(
  siteId: SiteId,
  date: string,
  cb: (report: DailyOpsReport | null) => void
): Unsubscribe {
  return onSnapshot(reportRef(reportDocId(siteId, date)), (snap) => {
    cb(snap.exists() ? (snap.data() as DailyOpsReport) : null);
  });
}

/** One-shot read of a single site/day report. */
export async function getReport(
  siteId: SiteId,
  date: string
): Promise<DailyOpsReport | null> {
  const snap = await getDoc(reportRef(reportDocId(siteId, date)));
  return snap.exists() ? (snap.data() as DailyOpsReport) : null;
}

/**
 * Autosave. Upserts as a draft, recomputing derived fields and updatedAt.
 * Never downgrades an already-submitted report back to draft.
 */
export async function upsertDraft(report: DailyOpsReport): Promise<void> {
  const derived = withDerived(report);
  const payload: DailyOpsReport = {
    ...derived,
    status: derived.status === 'submitted' ? 'submitted' : 'draft',
    updatedAt: new Date().toISOString(),
  };
  await setDoc(reportRef(payload.id), payload, { merge: true });
}

// ---------------------------------------------------------------------------
// Submit + validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const isNegative = (n: number) => typeof n === 'number' && n < 0;

/** Pre-submit validation. Returns all problems at once. */
export function validateForSubmit(r: DailyOpsReport): ValidationResult {
  const errors: string[] = [];

  if (!r.siteId) errors.push('Select a site.');
  if (!r.date) errors.push('Enter the report date.');
  if (!r.director.trim()) errors.push('Enter the director name.');

  if (!r.directorPacket.completed && !r.directorPacket.incompleteReason.trim()) {
    errors.push('Director Packet marked "No" — say what was not completed and what got in the way.');
  }

  const laborAttendance = [
    r.attendance.preschool,
    r.attendance.subsidy,
    r.labor.totalHours,
    r.labor.overtimeHours,
    r.labor.directorMinutesInRooms,
  ];
  if (laborAttendance.some(isNegative)) errors.push('Attendance and labor numbers cannot be negative.');

  const counts = [
    ...Object.values(r.enrollmentMarketing),
    ...Object.values(r.staff),
  ].map((c) => c.count);
  if (counts.some(isNegative)) errors.push('Counts cannot be negative.');

  return { ok: errors.length === 0, errors };
}

/**
 * Finalize a report. Validates, stamps status/submittedAt, strips empty
 * director-report lines, and writes. Returns the validation result; on failure
 * nothing is written.
 */
export async function submitReport(
  report: DailyOpsReport,
  uid: string
): Promise<ValidationResult> {
  const result = validateForSubmit(report);
  if (!result.ok) return result;

  const now = new Date().toISOString();
  const derived = withDerived(report);
  const payload: DailyOpsReport = {
    ...derived,
    directorReport: derived.directorReport.map((s) => s.trim()).filter(Boolean),
    status: 'submitted',
    submittedAt: now,
    updatedAt: now,
    createdByUid: derived.createdByUid || uid,
  };

  await setDoc(reportRef(payload.id), payload, { merge: true });
  return { ok: true, errors: [] };
}

// ---------------------------------------------------------------------------
// Dashboard queries
// ---------------------------------------------------------------------------

/** Live subscription to all reports in a week (optionally one site). */
export function subscribeReportsByWeek(
  weekOf: string,
  siteId: SiteId | null,
  cb: (rows: DailyOpsReport[]) => void
): Unsubscribe {
  const clauses = [where('weekOf', '==', weekOf)];
  if (siteId) clauses.push(where('siteId', '==', siteId));
  return onSnapshot(query(reportsCol(), ...clauses), (snap) => {
    cb(snap.docs.map((d) => d.data() as DailyOpsReport));
  });
}

/** One-shot read of all reports in a week (optionally one site). */
export async function getReportsByWeek(
  weekOf: string,
  siteId?: SiteId
): Promise<DailyOpsReport[]> {
  const clauses = [where('weekOf', '==', weekOf)];
  if (siteId) clauses.push(where('siteId', '==', siteId));
  const snap = await getDocs(query(reportsCol(), ...clauses));
  return snap.docs.map((d) => d.data() as DailyOpsReport);
}

/** Recent reports (newest first) — use to populate the dashboard week picker. */
export function subscribeRecentReports(
  max: number,
  cb: (rows: DailyOpsReport[]) => void
): Unsubscribe {
  return onSnapshot(
    query(reportsCol(), orderBy('date', 'desc'), limit(max)),
    (snap) => cb(snap.docs.map((d) => d.data() as DailyOpsReport))
  );
}

/** Distinct weekOf values (most recent first) from a set of reports. */
export function distinctWeeks(rows: DailyOpsReport[]): string[] {
  return Array.from(new Set(rows.map((r) => r.weekOf))).sort().reverse();
}

// ---------------------------------------------------------------------------
// Day Notes — admin acknowledgement of Director-Report lines
// ---------------------------------------------------------------------------

/**
 * Check/uncheck a single Director-Report line on a report (the "Day Notes"
 * strike-through). Stores the exact note text in the doc's `acknowledgedNotes`
 * array via arrayUnion/arrayRemove — an atomic single-field write that never
 * touches the director's own data, so it can't clobber a same-day autosave.
 * Admin-only per firestore.rules (admins may update any dailyOpsReports doc),
 * so no rules change is needed and the state syncs across devices.
 */
export async function setNoteAck(
  reportId: string,
  note: string,
  acked: boolean
): Promise<void> {
  await updateDoc(reportRef(reportId), {
    acknowledgedNotes: acked ? arrayUnion(note) : arrayRemove(note),
  });
}

/**
 * Append one message to a Director-Report line's thread. Pass the report's
 * current `noteComments` (from the live subscription) so we rewrite the array
 * without an extra read. Single-field write, merge-safe against director
 * autosaves. Admins may write any report; a director may write their own site's
 * report (firestore.rules already allow that — request.resource.data.siteId is
 * unchanged), so no rules change is needed for two-way threads.
 */
export async function addNoteComment(
  reportId: string,
  existing: NoteComment[] | undefined,
  comment: NoteComment
): Promise<void> {
  const text = comment.text.trim();
  if (!text) return;
  const next = [...(existing ?? []), { ...comment, text }];
  await updateDoc(reportRef(reportId), { noteComments: next });
}

/** Remove one message from a thread (delete-your-own). Matches on the full
 *  tuple so identical-but-distinct messages aren't both dropped. */
export async function removeNoteComment(
  reportId: string,
  existing: NoteComment[] | undefined,
  comment: NoteComment
): Promise<void> {
  const next = (existing ?? []).filter(
    (c) =>
      !(c.note === comment.note && c.at === comment.at && c.author === comment.author && c.text === comment.text)
  );
  await updateDoc(reportRef(reportId), { noteComments: next });
}

// ---------------------------------------------------------------------------
// Day Notes — file a note onto an admin request list (Buy / Fix)
// ---------------------------------------------------------------------------

/** Add/remove a note from a request list. Pass the report's current `noteTags`
 *  so we rewrite the array without a re-read. Admin-only single-field write,
 *  merge-safe against director autosaves — no rules change needed. */
export async function setNoteTag(
  reportId: string,
  existing: NoteTag[] | undefined,
  note: string,
  list: RequestList,
  on: boolean
): Promise<void> {
  const rest = (existing ?? []).filter((t) => !(t.note === note && t.list === list));
  const next = on ? [...rest, { note, list }] : rest;
  await updateDoc(reportRef(reportId), { noteTags: next });
}

/** One filed request, flattened from the reports for a dashboard list. */
export interface RequestItem {
  reportId: string;
  siteId: SiteId;
  siteName: string;
  date: string;
  director: string;
  note: string;
  tags: NoteTag[]; // the report's full tag array (for removal writes)
}

/** Collect every note filed to `list`, newest first. */
export function collectRequests(reports: DailyOpsReport[], list: RequestList): RequestItem[] {
  const out: RequestItem[] = [];
  for (const r of reports) {
    const tags = r.noteTags ?? [];
    for (const t of tags) {
      if (t.list !== list) continue;
      out.push({
        reportId: r.id,
        siteId: r.siteId,
        siteName: r.siteName || siteName(r.siteId),
        date: r.date,
        director: r.director,
        note: t.note,
        tags,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.siteName.localeCompare(b.siteName)));
}
