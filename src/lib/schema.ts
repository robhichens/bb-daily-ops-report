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

/** A counted item with an attached notes/names string. */
export interface CountNote {
  count: number;
  notes: string;
}
export const emptyCountNote = (): CountNote => ({ count: 0, notes: '' });

/** Daily target for Enrollment Communication Out / IKS. Drives the goal pill. */
export const ENROLLMENT_COMMS_DAILY_GOAL = 15;

// ---------------------------------------------------------------------------
// Section shapes
// ---------------------------------------------------------------------------

export interface Attendance {
  preschool: number;
  subsidy: number; // DSS, CCA, Foster, United Way
  total: number;   // derived = preschool + subsidy
}

export interface Labor {
  totalHours: number;
  overtimeHours: number;
  directorMinutesInRooms: number;
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
}

export const ENROLLMENT_FIELDS: CountNoteField<keyof EnrollmentMarketing>[] = [
  { key: 'toursGiven', label: 'Number of Tours Given', notesPrompt: 'Add names' },
  { key: 'toursScheduled', label: 'Number of Tours Scheduled', notesPrompt: 'Check IKS' },
  { key: 'callsInEmailsWeb', label: 'Number of Calls In/Emails & Web Inq', notesPrompt: 'Provide all details' },
  { key: 'enrollmentCommsOut', label: 'Enrollment Communication Out/IKS', notesPrompt: 'Provide all details (daily goal is 15 — two-way comms)', goal: ENROLLMENT_COMMS_DAILY_GOAL },
  { key: 'regFeesPaid', label: 'Number of Reg Fees Paid', notesPrompt: 'With Names, Room and Start Date' },
  { key: 'newStarts', label: 'Number of New Starts', notesPrompt: 'With Names, Room' },
  { key: 'enrollmentsToday', label: 'Number of Enrollments (Today)', notesPrompt: 'With Names, Rooms, Start Date (Reg PD, Enhancement PD, Start Date confirmed)' },
  { key: 'terminationsToday', label: 'Number of Terminations (Today)', notesPrompt: 'With Names, Room, Termination Date and Reason' },
];

export const STAFF_FIELDS: CountNoteField<keyof Staff>[] = [
  { key: 'callOutsLate', label: 'Call Outs/Late for Shift', notesPrompt: 'Name and Reason' },
  { key: 'rtoVacation', label: 'RTO/Vacation', notesPrompt: 'Name and Reason' },
  { key: 'sentHome', label: 'Number of Staff Sent Home', notesPrompt: 'Name and Reason (Over staffed, sick, etc.)' },
  { key: 'staffTerminating', label: 'Staff Terminating', notesPrompt: 'Name, Reason and Last Day' },
  { key: 'timeSpentRecruiting', label: 'Time Spent Recruiting', notesPrompt: 'Phone screening, Hiring Correspondence, Interviews' },
  { key: 'futureHires', label: 'Future Hires', notesPrompt: 'Name, Position, Start Date' },
];

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
    labor: { totalHours: 0, overtimeHours: 0, directorMinutesInRooms: 0 },
    enrollmentMarketing: emptyMap(ENROLLMENT_FIELDS),
    staff: emptyMap(STAFF_FIELDS),
    directorPacket: { completed: false, incompleteReason: '' },
    directorReport: [''],
    status: 'draft',
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    createdByUid: uid,
  };
}
