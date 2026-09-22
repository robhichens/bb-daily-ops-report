// src/lib/reportRegistry.ts
// The report suite: metadata for the active reports (nav dropdown + routing) and
// the field definitions for the config-driven org reports (ADR/CDR). DDR (/report)
// and FDR (/finance) keep their bespoke pages; ADR/CDR render through the generic
// OrgReport engine at /r/:key.
//
// CDR (Co-Director Daily Report) is built on the RETIRED Executive report's slot:
// it deliberately keeps the internal key 'edr' and the Firestore collections
// 'executiveReports' / 'executiveNotes', so NO firestore.rules change is needed —
// only its labels and sections changed. MDR (Marketing) was retired 2026-09-21
// (its work is covered by the CDR); removed from the nav and the engine.

import { ClipboardList, Wallet, Ticket, Users } from 'lucide-react'
import { CLASSROOMS, SITES } from './schema'
import type { OrgReportDef, ReportKey } from './schema'

export interface ReportMeta {
  key: ReportKey
  short: string
  title: string
  icon: typeof ClipboardList
  route: string
  kind: 'ddr' | 'fdr' | 'org'
}

export const REPORTS: ReportMeta[] = [
  { key: 'ddr', short: 'DDR', title: 'Director Daily Report', icon: ClipboardList, route: '/report', kind: 'ddr' },
  { key: 'edr', short: 'CDR', title: 'Co-Director Daily Report', icon: Users, route: '/r/edr', kind: 'org' },
  { key: 'adr', short: 'ADR', title: 'Admissions Daily Report', icon: Ticket, route: '/r/adr', kind: 'org' },
  { key: 'fdr', short: 'FDR', title: 'Finance Daily Report', icon: Wallet, route: '/finance', kind: 'fdr' },
]

export const reportMeta = (key: ReportKey): ReportMeta | undefined => REPORTS.find((r) => r.key === key)

// --- The config-driven org reports -----------------------------------------

const ADR: OrgReportDef = {
  key: 'adr',
  short: 'ADR',
  title: 'Admissions Daily Report',
  accent: 'yellow',
  collection: 'admissionsReports',
  notesCollection: 'admissionsNotes',
  sections: [
    { key: 'inquiries', title: 'New Inquiries', hint: 'New leads today (note the source split)', fields: [
      { key: 'total', label: 'Inquiries', kind: 'count' },
    ], note: true },
    { key: 'tours', title: 'Tours', fields: [
      { key: 'scheduled', label: 'Scheduled', kind: 'count' },
      { key: 'given', label: 'Given', kind: 'count' },
    ], note: true },
    { key: 'conversion', title: 'Conversion', hint: 'Reg fees + confirmed enrollments', fields: [
      { key: 'regFees', label: 'Reg fees paid', kind: 'count' },
      { key: 'regFeesAmt', label: 'Reg fees $', kind: 'dollar' },
      { key: 'newEnrollments', label: 'New enrollments', kind: 'count' },
    ], note: true },
    { key: 'outreach', title: 'Community Outreach', hint: 'Flyer drops & local business visits — name the spots in the note', fields: [
      { key: 'locationsVisited', label: 'Locations visited', kind: 'count' },
      { key: 'flyersDistributed', label: 'Flyers distributed', kind: 'count' },
    ], note: true },
    { key: 'pipeline', title: 'Pipeline', hint: 'Snapshot of where the funnel stands', fields: [
      { key: 'activeLeads', label: 'Active leads', kind: 'count' },
      { key: 'toursPending', label: 'Tours pending', kind: 'count' },
      { key: 'waitlist', label: 'Waitlist', kind: 'count' },
    ], note: true },
    { key: 'attrition', title: 'Attrition & Follow-up', fields: [
      { key: 'withdrawals', label: 'Withdrawals', kind: 'count' },
      { key: 'followUps', label: 'Follow-ups outstanding', kind: 'count' },
    ], note: true },
    { key: 'openingsToStaff', title: 'Openings to Staff', hint: 'Spots open per room based on today’s teacher count + ratio — not raw licensed capacity. Can go negative if a room is over ratio for its current staffing.', fields: [],
      matrix: { rows: CLASSROOMS.map((c) => ({ key: c.key, label: c.name, sub: c.ageGroup })), columns: SITES.map((s) => ({ key: s.id, label: s.name })), kind: 'number' },
      note: true },
  ],
}

// CDR — Co-Director Daily Report (Front Desk / Office Manager / Assistant Director).
// Repurposed from the retired Executive report, so its key stays 'edr' and it writes
// to executiveReports / executiveNotes (no rules change). Kept deliberately lean per
// Rob: a few counts per area plus one note. The Facility checklist collapses into a
// single confirm-and-list-exceptions note — the engine has no checkbox field by design,
// which keeps the daily report fast rather than a 30-field chore.
const CDR: OrgReportDef = {
  key: 'edr',
  short: 'CDR',
  title: 'Co-Director Daily Report',
  accent: 'sky',
  collection: 'executiveReports',
  notesCollection: 'executiveNotes',
  sections: [
    { key: 'communication', title: 'Communication', hint: 'Emails & voicemails handled today — list any urgent emails (who & what) in the note', fields: [
      { key: 'emails', label: 'Emails answered', kind: 'count' },
      { key: 'voicemails', label: 'Voicemails returned', kind: 'count' },
    ], note: true },
    { key: 'enrollment', title: 'Enrollment / IKS', hint: 'Leads, calls & tours — put names and follow-ups in the note', fields: [
      { key: 'newLeads', label: 'New leads', kind: 'count' },
      { key: 'iksCalls', label: 'IKS calls made', kind: 'count' },
      { key: 'toursDone', label: 'Tours completed', kind: 'count' },
      { key: 'toursScheduled', label: 'Tours scheduled', kind: 'count' },
    ], note: true },
    { key: 'hiring', title: 'Hiring', hint: 'Pipeline movement — names, interviews & offers out go in the note', fields: [
      { key: 'applicants', label: 'New applicants', kind: 'count' },
      { key: 'phoneScreens', label: 'Phone screens', kind: 'count' },
      { key: 'interviews', label: 'Interviews', kind: 'count' },
      { key: 'onboarded', label: 'Oriented / onboarded', kind: 'count' },
    ], note: true },
    { key: 'social', title: 'Social', hint: 'Facebook activity — note the headline and which page', fields: [
      { key: 'posts', label: 'FB posts', kind: 'count' },
      { key: 'events', label: 'FB events', kind: 'count' },
    ], note: true },
    { key: 'facility', title: 'Facility & Closing', hint: 'Whiteboards, lobby, trash, 4:30 playground & room check, tour-ready — confirm the walkthrough is done and list any exceptions in the note', fields: [], note: true },
    { key: 'tasks', title: 'Tasks & Projects', hint: 'Director-binder tasks (matrix / day-of-week / 1–31), minutes in a classroom + why, and projects assigned or completed', fields: [], note: true },
  ],
}

export const ORG_DEFS: Partial<Record<'adr' | 'mdr' | 'edr', OrgReportDef>> = { adr: ADR, edr: CDR }
