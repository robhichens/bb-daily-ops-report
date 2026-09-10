// src/lib/reportRegistry.ts
// The report suite: metadata for all five reports (nav dropdown + routing) and
// the field definitions for the three config-driven org reports (ADR/MDR/EDR).
// DDR (/report) and FDR (/finance) keep their bespoke pages; ADR/MDR/EDR render
// through the generic OrgReport engine at /r/:key.

import { ClipboardList, Wallet, Ticket, Megaphone, Compass } from 'lucide-react'
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
  { key: 'adr', short: 'ADR', title: 'Admissions Daily Report', icon: Ticket, route: '/r/adr', kind: 'org' },
  { key: 'mdr', short: 'MDR', title: 'Marketing Daily Report', icon: Megaphone, route: '/r/mdr', kind: 'org' },
  { key: 'edr', short: 'EDR', title: 'Executive Daily Report', icon: Compass, route: '/r/edr', kind: 'org' },
  { key: 'fdr', short: 'FDR', title: 'Finance Daily Report', icon: Wallet, route: '/finance', kind: 'fdr' },
]

export const reportMeta = (key: ReportKey): ReportMeta | undefined => REPORTS.find((r) => r.key === key)

// --- The three config-driven org reports -----------------------------------

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

const MDR: OrgReportDef = {
  key: 'mdr',
  short: 'MDR',
  title: 'Marketing Daily Report',
  accent: 'coral',
  collection: 'marketingReports',
  notesCollection: 'marketingNotes',
  sections: [
    { key: 'leads', title: 'Leads Generated', hint: 'Total + channel split in the note', fields: [
      { key: 'total', label: 'Leads', kind: 'count' },
    ], note: true },
    { key: 'spend', title: 'Ad Spend', fields: [
      { key: 'amount', label: 'Spend today', kind: 'dollar' },
    ], note: true },
    { key: 'inbound', title: 'Inbound', fields: [
      { key: 'formFills', label: 'Website form fills', kind: 'count' },
      { key: 'calls', label: 'Marketing calls', kind: 'count' },
    ], note: true },
    { key: 'social', title: 'Social', fields: [
      { key: 'posts', label: 'Posts published', kind: 'count' },
    ], note: true },
    { key: 'reputation', title: 'Reputation', hint: 'Reviews & referrals', fields: [
      { key: 'reviewsRequested', label: 'Reviews requested', kind: 'count' },
      { key: 'reviewsReceived', label: 'Reviews received', kind: 'count' },
      { key: 'avgRating', label: 'Avg rating', kind: 'number' },
      { key: 'referrals', label: 'Referrals in', kind: 'count' },
    ], note: true },
  ],
}

const EDR: OrgReportDef = {
  key: 'edr',
  short: 'EDR',
  title: 'Executive Daily Report',
  accent: 'gray',
  collection: 'executiveReports',
  notesCollection: 'executiveNotes',
  sections: [
    { key: 'attendance', title: 'Attendance', fields: [
      { key: 'total', label: 'Total across sites', kind: 'count' },
    ], note: true },
    { key: 'enrollment', title: 'Enrollment', fields: [
      { key: 'netChange', label: 'Net change today', kind: 'number' },
      { key: 'capacityPct', label: 'Capacity %', kind: 'number' },
    ], note: true },
    { key: 'cash', title: 'Cash', fields: [
      { key: 'moneyIn', label: 'Money in today', kind: 'dollar' },
    ], note: true },
    { key: 'staffing', title: 'Staffing', fields: [
      { key: 'openRoles', label: 'Open roles', kind: 'count' },
      { key: 'issues', label: 'Ratio / call-out issues', kind: 'text' },
    ] },
    { key: 'priorities', title: 'Priorities', fields: [
      { key: 'redFlags', label: 'Top red flags', kind: 'text' },
      { key: 'wins', label: 'Wins', kind: 'text' },
      { key: 'decisions', label: 'Decisions needed', kind: 'text' },
    ] },
  ],
}

export const ORG_DEFS: Record<'adr' | 'mdr' | 'edr', OrgReportDef> = { adr: ADR, mdr: MDR, edr: EDR }
