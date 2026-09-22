// src/lib/printModel.ts
// Turns any report's data into a neutral "print model" — a simple, single-column
// description that PrintableReport renders for print/PDF. Empty reports produce
// blank fields (rendered as fillable lines) so a printout can be filled by hand.

import {
  ENROLLMENT_FIELDS, STAFF_FIELDS, SITES, countNoteSummary, matrixCellKey, siteName,
  type DailyOpsReport, type EnrollmentMarketing, type Staff,
  type FinanceReport, type OrgListItem, type OrgReport, type OrgReportDef, type SiteId,
  totalBilling, totalOutstanding, subtotalDeposits, totalDeposits,
} from './schema'
import { formatLong } from './dates'
import { weekdayName } from './derive'

export interface PrintField { label: string; value?: string }
export interface PrintTable { label?: string; columns: string[]; rows: string[][]; minRows?: number }
export type PrintBlock =
  | { kind: 'fields'; fields: PrintField[] }
  | { kind: 'table'; table: PrintTable }
  | { kind: 'lines'; label?: string; values: string[]; minRows?: number }
  | { kind: 'note'; label: string; value?: string }
export interface PrintSection { title: string; hint?: string; blocks: PrintBlock[] }
export interface PrintModel {
  reportName: string
  short: string
  meta: PrintField[]
  sections: PrintSection[]
}

const numStr = (n?: number) => (n ? String(n) : '')
const moneyStr = (n?: number) => (n ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '')
const dateMeta = (date: string): PrintField[] => [
  { label: 'Date', value: date ? formatLong(date) : '' },
  { label: 'Day', value: date ? weekdayName(date) : '' },
]

// --- DDR --------------------------------------------------------------------

export function buildDdrPrintModel(r: DailyOpsReport): PrintModel {
  const filed = r.status === 'submitted'
  return {
    reportName: 'Director Daily Report',
    short: 'DDR',
    meta: [
      { label: 'Site', value: r.siteName || siteName(r.siteId) },
      ...dateMeta(r.date),
      { label: 'Director', value: r.director },
    ],
    sections: [
      { title: 'Attendance', blocks: [{ kind: 'fields', fields: [
        { label: 'Pre-School', value: numStr(r.attendance.preschool) },
        { label: 'Subsidy (DSS, CCA, Foster, United Way)', value: numStr(r.attendance.subsidy) },
        { label: 'Total Attendance', value: numStr(r.attendance.total) },
      ] }] },
      { title: 'Labor', blocks: [
        { kind: 'fields', fields: [
          { label: 'Total Labor Hours', value: numStr(r.labor.totalHours) },
          { label: 'Director Minutes in Rooms', value: numStr(r.labor.directorMinutesInRooms) },
          { label: 'Total Overtime Hours', value: numStr(r.labor.overtimeHours) },
        ] },
        { kind: 'table', table: {
          columns: ['Overtime — staff name', 'Hours'],
          rows: (r.labor.overtimeEntries ?? []).filter((e) => e.name.trim() || e.hours).map((e) => [e.name, numStr(e.hours)]),
          minRows: 4,
        } },
      ] },
      { title: 'Enrollment / Marketing', blocks: [{ kind: 'table', table: {
        columns: ['Item', '#', 'Details'],
        rows: ENROLLMENT_FIELDS.map((f) => {
          const c = r.enrollmentMarketing[f.key as keyof EnrollmentMarketing]
          return [f.label, numStr(c.count), countNoteSummary(c, f.itemFields)]
        }),
      } }] },
      { title: 'Staff', blocks: [{ kind: 'table', table: {
        columns: ['Item', '#', 'Details'],
        rows: STAFF_FIELDS.map((f) => {
          const c = r.staff[f.key as keyof Staff]
          const label = f.key === 'timeSpentRecruiting' ? 'Time Spent Recruiting (hrs)' : f.label
          return [label, numStr(c.count), countNoteSummary(c, f.itemFields)]
        }),
      } }] },
      { title: 'Director Packet', blocks: [{ kind: 'fields', fields: [
        { label: 'Completed today? (Yes / No)', value: filed ? (r.directorPacket.completed ? 'Yes' : 'No') : '' },
        { label: 'If no, what got in the way', value: r.directorPacket.incompleteReason },
      ] }] },
      { title: 'Director Report on the Day', blocks: [{ kind: 'lines',
        values: r.directorReport.map((s) => s.trim()).filter(Boolean), minRows: 6 }] },
    ],
  }
}

// --- FDR (per location) -----------------------------------------------------

export function buildFdrPrintModel(r: FinanceReport): PrintModel {
  const sections: PrintSection[] = []
  for (const s of SITES) {
    const loc = r.locations[s.id]
    sections.push({ title: `Billing — ${s.name}`, blocks: [
      { kind: 'table', table: { columns: ['Tuition Charges — Who', 'What for', 'Amount'], rows: loc.tuitionCharges.map((l) => [l.who, l.what, moneyStr(l.amount)]), minRows: 4 } },
      { kind: 'table', table: { columns: ['Other Charges — Who', 'What for', 'Amount'], rows: loc.otherCharges.map((l) => [l.who, l.what, moneyStr(l.amount)]), minRows: 3 } },
      { kind: 'table', table: { columns: ['Credits — Who', 'What for', 'Amount'], rows: loc.credits.map((l) => [l.who, l.what, moneyStr(l.amount)]), minRows: 2 } },
      { kind: 'fields', fields: [
        { label: 'Total Billing', value: moneyStr(totalBilling(loc)) },
        { label: 'Outstanding — Current families (names)', value: loc.outstandingCurrent.names },
        { label: 'Current families — amount', value: moneyStr(loc.outstandingCurrent.amount) },
        { label: 'Outstanding — Former families (names)', value: loc.outstandingFormer.names },
        { label: 'Former families — amount', value: moneyStr(loc.outstandingFormer.amount) },
        { label: 'Total Outstanding', value: moneyStr(totalOutstanding(loc)) },
      ] },
    ] })
    sections.push({ title: `Deposits — ${s.name}`, blocks: [
      { kind: 'table', table: { columns: ['Check — Who paid', 'For what', 'Amount'], rows: loc.paymentsByCheck.map((l) => [l.who, l.what, moneyStr(l.amount)]), minRows: 4 } },
      { kind: 'table', table: { columns: ['Agency', 'Parent', 'Child', 'Amount'], rows: loc.paymentsByAgency.map((l) => [l.agency, l.parent, l.child, moneyStr(l.amount)]), minRows: 3 } },
      { kind: 'fields', fields: [
        { label: 'Tuition Express — ACH Batch', value: moneyStr(loc.tuitionExpress.achBatch) },
        { label: 'Tuition Express — CC Batch', value: moneyStr(loc.tuitionExpress.ccBatch) },
        { label: 'Tuition Express — CC POS', value: moneyStr(loc.tuitionExpress.ccPos) },
        { label: 'SubTotal Deposits', value: moneyStr(subtotalDeposits(loc)) },
      ] },
      { kind: 'table', table: { columns: ['Declines / Refunds — Type', 'Parent', 'Amount'], rows: loc.declinesRefunds.map((d) => [d.type, d.parent, moneyStr(d.amount)]), minRows: 2 } },
      { kind: 'fields', fields: [{ label: 'Total Deposits', value: moneyStr(totalDeposits(loc)) }] },
    ] })
  }
  return {
    reportName: 'Finance Daily Report',
    short: 'FDR',
    meta: [...dateMeta(r.date), { label: 'Completed by', value: r.completedBy }],
    sections,
  }
}

// --- ADR / MDR / EDR (config-driven) ----------------------------------------

export function buildOrgPrintModel(def: OrgReportDef, r: OrgReport): PrintModel {
  const submitted = r.status === 'submitted'
  const sections: PrintSection[] = def.sections.map((s) => {
    const vals = r.data[s.key] ?? {}
    const blocks: PrintBlock[] = []
    if (s.matrix) {
      const m = s.matrix
      blocks.push({ kind: 'table', table: {
        columns: ['', ...m.columns.map((c) => c.label)],
        rows: m.rows.map((row) => [
          row.sub ? `${row.label} (${row.sub})` : row.label,
          ...m.columns.map((c) => { const v = vals[matrixCellKey(c.key, row.key)]; return typeof v === 'number' && v ? String(v) : (v ? String(v) : '') }),
        ]),
      } })
    } else {
      // Scalar fields (count/dollar/number/text/toggle) render as a fields block;
      // each list field renders as its own table below.
      const scalar = s.fields.filter((f) => f.kind !== 'list')
      const lists = s.fields.filter((f) => f.kind === 'list')
      if (scalar.length) {
        blocks.push({ kind: 'fields', fields: scalar.map((f) => {
          const v = vals[f.key]
          let value = ''
          if (f.kind === 'toggle') value = submitted ? (v ? 'Yes' : 'No') : ''
          else if (f.kind === 'text') value = v ? String(v) : ''
          else { const n = typeof v === 'number' ? v : Number(v || 0); value = n ? (f.kind === 'dollar' ? moneyStr(n) : String(n)) : '' }
          return { label: f.label, value }
        }) })
      }
      for (const f of lists) {
        const items = Array.isArray(vals[f.key]) ? (vals[f.key] as OrgListItem[]) : []
        const subs = f.subFields ?? []
        blocks.push({ kind: 'table', table: {
          label: f.label,
          columns: subs.map((sf) => sf.label),
          rows: items
            .map((it) => subs.map((sf) => (sf.optionSet === 'sites' && it[sf.key] ? siteName(it[sf.key] as SiteId) : (it[sf.key] ?? ''))))
            .filter((row) => row.some((cell) => cell.trim() !== '')),
          minRows: 3,
        } })
      }
    }
    if (s.note) blocks.push({ kind: 'note', label: 'Note', value: String(vals.note ?? '') })
    return { title: s.title, hint: s.hint, blocks }
  })
  return {
    reportName: def.title,
    short: def.short,
    meta: [
      ...(def.siteScoped && r.siteId ? [{ label: 'Campus', value: siteName(r.siteId) }] : []),
      ...dateMeta(r.date),
      { label: 'Completed by', value: r.completedBy },
    ],
    sections,
  }
}
