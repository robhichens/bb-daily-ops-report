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
import type { OrgReportDef, OrgSubField, ReportKey } from './schema'

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

// Reusable list sub-fields for the CDR.
const NAME_SF: OrgSubField = { key: 'name', label: 'Name', type: 'text' }
const CAMPUS_SF: OrgSubField = { key: 'campus', label: 'Campus', type: 'select', optionSet: 'sites' }

// CDR — Co-Director Daily Report (Front Desk / Office Manager / Assistant Director).
// Repurposed from the retired Executive report, so its key stays 'edr' and it writes
// to executiveReports / executiveNotes (no rules change). siteScoped: one co-director
// per campus, so each files their own day (header Name + Campus; doc = site_date).
// Hiring & Social use named line-lists with a per-row campus (a co-director may cover
// another school). Facility & Closing is a Yes/No toggle + a reason shown only on No
// (mirrors the DDR's Director Packet). Kept lean per Rob — no checkbox sprawl.
const CDR: OrgReportDef = {
  key: 'edr',
  short: 'CDR',
  title: 'Co-Director Daily Report',
  accent: 'sky',
  collection: 'executiveReports',
  notesCollection: 'executiveNotes',
  siteScoped: true,
  sections: [
    { key: 'communication', title: 'Communication', hint: 'Emails & voicemails handled today — list any urgent emails (who & what) in the note', fields: [
      { key: 'emails', label: 'Emails answered', kind: 'count' },
      { key: 'voicemails', label: 'Voicemails returned', kind: 'count' },
    ], note: true },
    { key: 'enrollment', title: 'Enrollment / IKS', hint: 'Leads, calls, texts & tours — put names and follow-ups in the note', fields: [
      { key: 'newLeads', label: 'New leads', kind: 'count' },
      { key: 'iksCalls', label: 'IKS calls made', kind: 'count' },
      { key: 'textsSent', label: 'Text messages sent', kind: 'count' },
      { key: 'toursDone', label: 'Tours completed', kind: 'count' },
      { key: 'toursScheduled', label: 'Tours scheduled', kind: 'count' },
    ], note: true },
    { key: 'hiring', title: 'Hiring', hint: 'Count new applicants; add a named row for each phone screen, interview & onboard — tag the campus if it was for another school', fields: [
      { key: 'applicants', label: 'New applicants', kind: 'count' },
      { key: 'phoneScreens', label: 'Phone screens', kind: 'list', subFields: [NAME_SF, CAMPUS_SF] },
      { key: 'interviews', label: 'Interviews', kind: 'list', subFields: [NAME_SF, CAMPUS_SF] },
      { key: 'onboarded', label: 'Oriented / onboarded', kind: 'list', subFields: [NAME_SF, CAMPUS_SF] },
    ], note: true },
    { key: 'social', title: 'Social', hint: 'One row per Facebook post or event — the headline, which page, and the campus it was for', fields: [
      { key: 'posts', label: 'Facebook posts & events', kind: 'list', subFields: [
        { key: 'what', label: 'Headline / what', type: 'text' },
        { key: 'page', label: 'FB page', type: 'text' },
        CAMPUS_SF,
      ] },
    ], note: true },
    { key: 'facility', title: 'Facility & Closing', hint: 'Whiteboards, lobby, trash, 4:30 playground & room check, tour-ready', fields: [
      { key: 'complete', label: 'Closing checklist complete?', kind: 'toggle' },
      { key: 'reason', label: 'What got in the way?', kind: 'text', showWhen: { key: 'complete', equals: false } },
    ] },
    { key: 'tasks', title: 'Tasks & Projects', hint: 'One row per task, project, or classroom coverage — pick the type, give it a title, and say what you did (if covering a room: which room & why)', fields: [
      { key: 'items', label: '', kind: 'list', subFields: [
        { key: 'type', label: 'Type', type: 'select', options: ['Task', 'Project', 'Classroom coverage'] },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'details', label: 'What you did', type: 'text' },
      ] },
    ] },
  ],
}

export const ORG_DEFS: Partial<Record<'adr' | 'mdr' | 'edr', OrgReportDef>> = { adr: ADR, edr: CDR }
