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

/** When a Director-Report line was first written, for the Day Notes timestamp.
 *  Stored as an array (not a keyed map) because note text can contain characters
 *  illegal in Firestore field keys. Stamped on autosave/submit in reports.ts. */
export interface NoteStamp {
  note: string; // the exact Director-Report line
  at: string;   // ISO — first time this exact line was saved non-empty
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

  /** Day Notes: first-written timestamp per Director-Report line. Stamped on
   *  autosave/submit (reports.ts), shown on the Day Notes ledger. */
  noteCreatedAt?: NoteStamp[];

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
// FINANCE DAILY OPS REPORT (FDR) — Alicia (Finance Director).
// One doc per DAY (`financeReports/{date}`); Billing & Deposits captured
// PER LOCATION. Line lists (charges, credits, checks, agency payments) auto-add
// a blank row as you type, like the Director Report. Totals are derived, never
// stored. Flags & Notes feed the central Day Notes board (source 'fdr').
// ===========================================================================

/** A who + what + amount line (auto-adds a blank row as you fill it). Used for
 *  billing charges/credits ([Who] + [What for]) and check deposits ([Who paid]
 *  + [For what]). */
export interface FinanceLine { who: string; what: string; amount: number }
/** An agency payment line: agency + parent + child + amount. */
export interface AgencyLine { agency: string; parent: string; child: string; amount: number }
/** A decline or refund line: type toggle + parent + amount (subtracts from deposits). */
export interface DeclineRefund { type: 'Decline' | 'Refund'; parent: string; amount: number }
/** A names + amount block (single line — current or former families outstanding). */
export interface Outstanding { names: string; amount: number }
/** Tuition Express daily totals (not itemized). */
export interface TuitionExpress { achBatch: number; ccBatch: number; ccPos: number; note: string }

/** Everything captured for one location on one day. */
export interface FinanceLocation {
  // Billing
  tuitionCharges: FinanceLine[];
  otherCharges: FinanceLine[];
  credits: FinanceLine[];
  outstandingCurrent: Outstanding;
  outstandingFormer: Outstanding;
  // Deposits
  paymentsByCheck: FinanceLine[];
  paymentsByAgency: AgencyLine[];
  tuitionExpress: TuitionExpress;
  declinesRefunds: DeclineRefund[];
}

/** Agency dropdown options for Payment by Agency (plus a free-type "Other"). */
export const FINANCE_AGENCIES = ['CCA', 'DSS', 'United Way', 'Foster'] as const;

export interface FinanceReport {
  id: string;      // = date 'YYYY-MM-DD' (one per day)
  date: string;
  day: string;
  weekOf: string;
  completedBy: string;
  locations: Record<SiteId, FinanceLocation>;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

export const financeDocId = (date: string): string => date;

export function emptyFinanceLocation(): FinanceLocation {
  return {
    tuitionCharges: [],
    otherCharges: [],
    credits: [],
    outstandingCurrent: { names: '', amount: 0 },
    outstandingFormer: { names: '', amount: 0 },
    paymentsByCheck: [],
    paymentsByAgency: [],
    tuitionExpress: { achBatch: 0, ccBatch: 0, ccPos: 0, note: '' },
    declinesRefunds: [],
  };
}

export function emptyFinanceReport(date: string, uid = ''): FinanceReport {
  const now = new Date().toISOString();
  const locations = {} as Record<SiteId, FinanceLocation>;
  for (const s of SITES) locations[s.id] = emptyFinanceLocation();
  return {
    id: financeDocId(date), date, day: '', weekOf: '', completedBy: '',
    locations,
    status: 'draft', submittedAt: null, createdAt: now, updatedAt: now, createdByUid: uid,
  };
}

// Derived finance totals (computed in the UI, never stored).
export const sumLines = (ls: { amount: number }[]): number =>
  ls.reduce((a, l) => a + (Number(l.amount) || 0), 0);
export const totalBilling = (loc: FinanceLocation): number =>
  sumLines(loc.tuitionCharges) + sumLines(loc.otherCharges) - sumLines(loc.credits);
export const totalOutstanding = (loc: FinanceLocation): number =>
  (loc.outstandingCurrent.amount || 0) + (loc.outstandingFormer.amount || 0);
export const tuitionExpressTotal = (te: TuitionExpress): number =>
  (te.achBatch || 0) + (te.ccBatch || 0) + (te.ccPos || 0);
export const subtotalDeposits = (loc: FinanceLocation): number =>
  sumLines(loc.paymentsByCheck) + sumLines(loc.paymentsByAgency) + tuitionExpressTotal(loc.tuitionExpress);
export const totalDeposits = (loc: FinanceLocation): number =>
  subtotalDeposits(loc) - sumLines(loc.declinesRefunds);

// ===========================================================================
// REPORT SUITE — generic, config-driven org-wide daily reports (ADR/MDR/EDR).
// DDR (dailyOpsReports) and FDR (financeReports) stay bespoke; these three
// share one engine. A report = a set of sections, each a set of typed fields.
// ===========================================================================

export type ReportKey = 'ddr' | 'fdr' | 'adr' | 'mdr' | 'edr';
export type ReportAccessLevel = 'view' | 'fill';

/** Field input kinds. dollar/count clamp ≥ 0; number allows decimals + negatives. */
export type FieldKind = 'dollar' | 'count' | 'number' | 'text';

export interface OrgFieldDef {
  key: string;
  label: string;
  kind: FieldKind;
}
export interface OrgSectionDef {
  key: string;
  title: string;
  hint?: string;
  fields: OrgFieldDef[];
  note?: boolean; // append a free-text "Note" field
}
export interface OrgReportDef {
  key: 'adr' | 'mdr' | 'edr';
  short: string;   // "ADR"
  title: string;   // "Admissions Daily Report"
  accent: 'coral' | 'yellow' | 'sky' | 'gray';
  collection: string;      // e.g. 'admissionsReports'
  notesCollection: string; // e.g. 'admissionsNotes'
  sections: OrgSectionDef[];
}

/** One org-report doc (one per DAY). `data[sectionKey][fieldKey]` holds values. */
export interface OrgReport {
  id: string;     // = date 'YYYY-MM-DD'
  date: string;
  day: string;
  weekOf: string;
  completedBy: string;
  data: Record<string, Record<string, number | string>>;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

/** One message in any Flags-&-Notes ledger thread. */
export interface LedgerNoteComment {
  text: string;
  author: string;
  at: string;
}
/** A running Flags-&-Notes entry. All reports write these to ONE central
 *  `orgDayNotes` collection, tagged by `source` (report) + optional `siteId`,
 *  so they aggregate onto the main Day Notes board. Red-flag pins to the top. */
export interface LedgerNote {
  id: string;
  source: ReportKey;        // which report this note came from
  siteId?: SiteId | null;   // optional location tag (org reports usually null)
  text: string;
  author: string;
  authorUid: string;
  at: string;
  acked: boolean;
  flagged: boolean;
  comments: LedgerNoteComment[];
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
