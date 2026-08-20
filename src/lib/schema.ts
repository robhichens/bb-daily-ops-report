// src/lib/schema.ts
// SINGLE SOURCE OF TRUTH for the BB Daily Ops Report.
// The form, the dashboard, and the CSV/JSON exporter all import from here so they can never drift.
// Field labels + notes prompts are VERBATIM from the Google Sheet
// "NEW - Daily Ops Report TEMPLATE" (Drive ID 1aHnOmvkfYWUJPrU_EiqjelliBW06WebcYjaoAVmCQRk).
// If the sheet and this file disagree, the sheet wins — re-verify before changing.

export type SiteId = 'crozet' | 'forest-lakes' | 'mill-creek';

export interface SiteConfig {
  id: SiteId;
  name: string;
}

export const SITES: SiteConfig[] = [
  { id: 'crozet', name: 'Crozet' },
  { id: 'forest-lakes', name: 'Forest Lakes' },
  { id: 'mill-creek', name: 'Mill Creek' },
];

export const siteName = (id: SiteId): string =>
  SITES.find((s) => s.id === id)?.name ?? id;

/** Directors for the autocomplete (as of June 2026). */
export const DIRECTORS = ['Jacqueline Lang', 'Jess Rybak', 'Laura Baker'];

/** One structured sub-field shown per item when a line is broken out. */
export interface ItemFieldDef {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'time';
  options?: string[];        // for type === 'select'
  allowOther?: boolean;      // select: add an "Other…" choice that reveals a free-text box
  /** Only render this field when another field on the same item equals a value. */
  showWhen?: { key: string; equals: string };
}
/** A single item's structured details, keyed by ItemFieldDef.key. */
export type ItemDetail = Record<string, string>;

/** A counted line. `notes` is the legacy free-text; `items` holds the
 *  structured per-item breakout (its length follows `count`). */
export interface CountNote {
  count: number;
  notes: string;
  items?: ItemDetail[];
}
export const emptyCountNote = (): CountNote => ({ count: 0, notes: '', items: [] });

/** Daily target for Enrollment Communication Out / IKS. Drives the goal pill. */
export const ENROLLMENT_COMMS_DAILY_GOAL = 15;

/** Flat registration fee ($). Reg Fees Paid count × this = the dashboard $ figure. */
export const REGISTRATION_FEE = 200;

// ---------------------------------------------------------------------------
// Section shapes
// ---------------------------------------------------------------------------

export interface Attendance {
  preschool: number;
  subsidy: number; // DSS, CCA, Foster, United Way
  total: number;   // derived = preschool + subsidy
}

/** One staff member's overtime for the day. */
export interface OvertimeEntry {
  name: string;
  hours: number;
}

export interface Labor {
  totalHours: number;
  overtimeHours: number;   // derived = sum of overtimeEntries (not edited directly)
  directorMinutesInRooms: number;
  overtimeEntries?: OvertimeEntry[];
}

export interface EnrollmentMarketing {
  toursGiven: CountNote;
  toursScheduled: CountNote;
  callsInEmailsWeb: CountNote;
  enrollmentCommsOut: CountNote; // goal 15
  regFeesPaid: CountNote;
  newStarts: CountNote;
  enrollmentsToday: CountNote;
  terminationsToday: CountNote;
}

export interface Staff {
  callOutsLate: CountNote;
  rtoVacation: CountNote;
  sentHome: CountNote;
  staffTerminating: CountNote;
  timeSpentRecruiting: CountNote; // FLAG-2: likely HOURS, not a count — confirm with Rob
  futureHires: CountNote;
}

export interface DirectorPacket {
  completed: boolean;       // "Director Packet Completed Today" Yes/No
  incompleteReason: string; // required when completed === false
}

/** The two admin request lists a Day Note can be filed to. */
export type RequestList = 'purchase' | 'maintenance';

export const REQUEST_LISTS: { id: RequestList; label: string; short: string }[] = [
  { id: 'purchase', label: 'Purchase Requests', short: 'Buy' },
  { id: 'maintenance', label: 'Maintenance Requests', short: 'Fix' },
];

/** Files one Director-Report line onto an admin request list (Day Notes → Dashboard).
 *  `done` moves the item from the active list into the Completed section; it stays
 *  there (with `doneAt`) until deleted. One tag per (note, list). */
export interface NoteTag {
  note: string;      // the exact Director-Report line
  list: RequestList;
  done?: boolean;
  doneAt?: string;   // ISO — when it was marked done
}

/** One message in a Day-Notes thread hanging off a Director-Report line.
 *  Threads are two-way: leadership (role 'admin') and the site's director
 *  (role 'director') both post. Legacy rows written before threading have no
 *  role — treat a missing role as 'admin' (only admins could write then). */
export interface NoteComment {
  note: string;    // the exact Director-Report line this is about
  text: string;    // the message body
  author: string;  // display name of who wrote it
  at: string;      // ISO timestamp
  role?: 'admin' | 'director';
}

export interface DailyOpsReport {
  id: string;        // `${siteId}_${date}`
  siteId: SiteId;
  siteName: string;
  date: string;      // 'YYYY-MM-DD'
  day: string;       // derived weekday
  weekOf: string;    // derived Monday 'YYYY-MM-DD' (grouping key)
  director: string;

  attendance: Attendance;
  labor: Labor;
  enrollmentMarketing: EnrollmentMarketing;
  staff: Staff;
  directorPacket: DirectorPacket;
  directorReport: string[];

  /** Day Notes: exact Director-Report lines an admin has checked off (struck
   *  through / "Seen by" on the director's side). Written only from the Day
   *  Notes view via setNoteAck, never by the report form, so it survives
   *  director autosaves. */
  acknowledgedNotes?: string[];

  /** Day Notes: leadership comments/questions attached to a Director-Report
   *  line. Stored as an array (not a keyed map) because note text can contain
   *  characters illegal in Firestore field keys. One comment per line (v1).
   *  Written only from the Day Notes view, so it survives director autosaves. */
  noteComments?: NoteComment[];

  /** Day Notes: which admin request lists (Buy/Fix) each line is filed to.
   *  Admin-only; derived into the dashboard's Purchase/Maintenance lists. */
  noteTags?: NoteTag[];

  /** Day Notes: exact Director-Report lines an admin has RED-FLAGGED (high
   *  alert). Flagged notes float to the top of Day Notes with a red border.
   *  Written only from the Day Notes view via setNoteFlag. */
  flaggedNotes?: string[];

  qualityScore?: number;   // derived 0–100 (gamification.ts); written on every save

  status: 'draft' | 'submitted';
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

// ---------------------------------------------------------------------------
// Field config — iterate these to render rows AND build export columns.
// ---------------------------------------------------------------------------

export interface CountNoteField<K extends string = string> {
  key: K;
  label: string;
  notesPrompt: string;
  goal?: number; // when set, render a goal pill (green at >= goal, amber below)
  /** When set, the count expands into this many structured item rows. */
  itemFields?: ItemFieldDef[];
}

// Reusable per-item sub-fields for the structured breakouts.
const F_NAME: ItemFieldDef = { key: 'name', label: 'First & last name', type: 'text' };
const F_ROOM: ItemFieldDef = { key: 'room', label: 'Room', type: 'text' };
const F_REASON: ItemFieldDef = { key: 'reason', label: 'Reason', type: 'text' };

export const ENROLLMENT_FIELDS: CountNoteField<keyof EnrollmentMarketing>[] = [
  { key: 'toursGiven', label: 'Number of Tours Given', notesPrompt: 'Add names', itemFields: [F_NAME] },
  { key: 'toursScheduled', label: 'Number of Tours Scheduled', notesPrompt: 'Check IKS', itemFields: [F_NAME, { key: 'tourDate', label: 'Tour date', type: 'date' }] },
  { key: 'callsInEmailsWeb', label: 'Number of Calls In/Emails & Web Inq', notesPrompt: 'Provide all details', itemFields: [{ key: 'type', label: 'Type', type: 'select', options: ['Call', 'Email', 'Web', 'Walk-in'], allowOther: true }, F_NAME] },
  { key: 'enrollmentCommsOut', label: 'Enrollment Communication Out/IKS', notesPrompt: 'Provide all details (daily goal is 15 — two-way comms)', goal: ENROLLMENT_COMMS_DAILY_GOAL, itemFields: [{ key: 'type', label: 'Type', type: 'select', options: ['Call', 'Email', 'Text', 'IKS'], allowOther: true }, F_NAME, { key: 'detail', label: 'Detail', type: 'text' }] },
  { key: 'regFeesPaid', label: 'Number of Reg Fees Paid', notesPrompt: 'With Names, Room and Start Date', itemFields: [F_NAME, F_ROOM, { key: 'startDate', label: 'Start date', type: 'date' }] },
  { key: 'newStarts', label: 'Number of New Starts', notesPrompt: 'With Names, Room', itemFields: [F_NAME, F_ROOM] },
  { key: 'enrollmentsToday', label: 'Number of Enrollments (Today)', notesPrompt: 'With Names, Rooms, Start Date (Reg PD, Enhancement PD, Start Date confirmed)', itemFields: [F_NAME, F_ROOM, { key: 'startDate', label: 'Start date', type: 'date' }] },
  { key: 'terminationsToday', label: 'Number of Terminations (Today)', notesPrompt: 'With Names, Room, Termination Date and Reason', itemFields: [F_NAME, F_ROOM, { key: 'terminationDate', label: 'Termination date', type: 'date' }, F_REASON] },
];

export const STAFF_FIELDS: CountNoteField<keyof Staff>[] = [
  { key: 'callOutsLate', label: 'Call Outs/Late for Shift', notesPrompt: 'Name and Reason', itemFields: [F_NAME, { key: 'status', label: 'Call out or late?', type: 'select', options: ['Call Out', 'Late'] }, { key: 'arrivalTime', label: 'Arrival time', type: 'time', showWhen: { key: 'status', equals: 'Late' } }, F_REASON] },
  { key: 'rtoVacation', label: 'RTO/Vacation', notesPrompt: 'Name and Reason', itemFields: [F_NAME, F_REASON] },
  { key: 'sentHome', label: 'Number of Staff Sent Home', notesPrompt: 'Name and Reason (Over staffed, sick, etc.)', itemFields: [F_NAME, F_REASON] },
  { key: 'staffTerminating', label: 'Staff Terminating', notesPrompt: 'Name, Reason and Last Day', itemFields: [F_NAME, F_REASON, { key: 'lastDay', label: 'Last day', type: 'date' }] },
  { key: 'timeSpentRecruiting', label: 'Time Spent Recruiting', notesPrompt: 'Phone screening, Hiring Correspondence, Interviews' },
  { key: 'futureHires', label: 'Future Hires', notesPrompt: 'Name, Position, Start Date', itemFields: [F_NAME, { key: 'position', label: 'Position', type: 'text' }, { key: 'startDate', label: 'Start date', type: 'date' }] },
];

/** Human-readable summary of a counted line — prefers the structured items,
 *  falling back to the legacy notes string. Used by exports + dashboard. */
export function countNoteSummary(cn: CountNote, itemFields?: ItemFieldDef[]): string {
  if (itemFields && cn.items?.length) {
    const parts = cn.items
      .map((it) => itemFields.map((f) => (it[f.key] ?? '').trim()).filter(Boolean).join(' · '))
      .filter(Boolean);
    if (parts.length) return parts.join('  |  ');
  }
  return cn.notes ?? '';
}

/** Section accent colors (left border) — matches the bbonboard internal brand. */
export const SECTION_ACCENT = {
  attendance: 'teal',
  labor: 'purple',
  enrollmentMarketing: 'orange',
  staff: 'navy',
  directorReport: 'teal',
} as const;

// ---------------------------------------------------------------------------
// Factories / helpers
// ---------------------------------------------------------------------------

export const reportDocId = (siteId: SiteId, date: string): string => `${siteId}_${date}`;

function emptyMap<K extends string>(fields: CountNoteField<K>[]): Record<K, CountNote> {
  return fields.reduce((acc, f) => {
    acc[f.key] = emptyCountNote();
    return acc;
  }, {} as Record<K, CountNote>);
}

// ===========================================================================
// FINANCE DAILY OPS REPORT — Alicia (Finance Director).
// Org-wide (one report per DAY, not per site), admin-only. Lives alongside the
// site DORs in its own `financeReports` collection. Deliberately lean: three
// number sections + a running Flags & Notes list (see FinanceNote below).
// ===========================================================================

/** One org-wide finance line: an amount ($) and/or a count (#), plus a note. */
export interface FinanceValue {
  amount: number; // dollars
  count: number;  // occurrences
  note: string;
}
export const emptyFinanceValue = (): FinanceValue => ({ amount: 0, count: 0, note: '' });

/** Money collected today, split per location (+ a shared note). Total is derived. */
export interface MoneyIn {
  crozet: number;
  forestLakes: number;
  millCreek: number;
  note: string;
}

export interface FinanceReport {
  id: string;      // = date 'YYYY-MM-DD' (one per day)
  date: string;    // 'YYYY-MM-DD'
  day: string;     // derived weekday
  weekOf: string;  // derived Monday 'YYYY-MM-DD'
  completedBy: string;

  moneyIn: MoneyIn;        // per location $
  collections: FinanceValue; // late fees / returned payments / AR $
  dss: FinanceValue;         // subsidy $ posted / missed check-ins

  status: 'draft' | 'submitted';
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

export const financeDocId = (date: string): string => date;

/** Per-location money-in fields, for iterating the form + the total. */
export const MONEY_IN_SITES: { key: keyof Omit<MoneyIn, 'note'>; label: string }[] = [
  { key: 'crozet', label: 'Crozet' },
  { key: 'forestLakes', label: 'Forest Lakes' },
  { key: 'millCreek', label: 'Mill Creek' },
];

export const moneyInTotal = (m: MoneyIn): number =>
  (m.crozet || 0) + (m.forestLakes || 0) + (m.millCreek || 0);

export function emptyFinanceReport(date: string, uid = ''): FinanceReport {
  const now = new Date().toISOString();
  return {
    id: financeDocId(date),
    date,
    day: '',
    weekOf: '',
    completedBy: '',
    moneyIn: { crozet: 0, forestLakes: 0, millCreek: 0, note: '' },
    collections: emptyFinanceValue(),
    dss: emptyFinanceValue(),
    status: 'draft',
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    createdByUid: uid,
  };
}

/** One message in a Finance Flags-&-Notes thread (all authors are admins). */
export interface FinanceNoteComment {
  text: string;
  author: string;
  at: string; // ISO
}

/** A single Finance Flags-&-Notes entry — a running list (like Day Notes), with
 *  a read check-off, a comment thread, and a red-flag that pins it to the top. */
export interface FinanceNote {
  id: string;
  text: string;
  author: string;
  authorUid: string;
  at: string;       // created ISO
  acked: boolean;   // read / checked off
  flagged: boolean; // red flag → pin to top, red border
  comments: FinanceNoteComment[];
}

/** A blank report for a given site/date. Derived fields are filled by derive.ts. */
export function emptyReport(siteId: SiteId, date: string, uid = ''): DailyOpsReport {
  const now = new Date().toISOString();
  return {
    id: reportDocId(siteId, date),
    siteId,
    siteName: siteName(siteId),
    date,
    day: '',
    weekOf: '',
    director: '',
    attendance: { preschool: 0, subsidy: 0, total: 0 },
    labor: { totalHours: 0, overtimeHours: 0, directorMinutesInRooms: 0, overtimeEntries: [] },
    enrollmentMarketing: emptyMap(ENROLLMENT_FIELDS),
    staff: emptyMap(STAFF_FIELDS),
    directorPacket: { completed: false, incompleteReason: '' },
    directorReport: [''],
    qualityScore: 0,
    status: 'draft',
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    createdByUid: uid,
  };
}
