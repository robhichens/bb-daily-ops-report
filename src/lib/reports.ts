// src/lib/reports.ts
// Firestore data layer for the BB Daily Ops Report.
// One collection: `dailyOpsReports`, doc id `${siteId}_${date}` (one per site per day).
// Form uses subscribeReport + upsertDraft (autosave) + submitReport.
// Dashboard uses subscribeReportsByWeek + subscribeRecentReports (for the week picker).

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import { withDerived } from './derive';
import {
  reportDocId,
  type DailyOpsReport,
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
