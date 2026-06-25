// src/lib/exportReports.ts
// CSV / JSON export of a filtered report set. Columns are built by iterating the
// schema field config (ENROLLMENT_FIELDS / STAFF_FIELDS) so they never drift
// from the form.

import {
  ENROLLMENT_FIELDS,
  STAFF_FIELDS,
  countNoteSummary,
  type DailyOpsReport,
} from './schema'

function csvCell(v: string | number | boolean): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function reportsToCsv(rows: DailyOpsReport[]): string {
  const headers = [
    'Date', 'Day', 'Site', 'Director', 'Status', 'Quality',
    'Pre-School', 'Subsidy', 'Total Attendance',
    'Labor Hours', 'Overtime Hours', 'Director Minutes in Rooms',
    ...ENROLLMENT_FIELDS.flatMap((f) => [f.label, `${f.label} — notes`]),
    ...STAFF_FIELDS.flatMap((f) => [f.label, `${f.label} — notes`]),
    'Packet Completed', 'Packet Incomplete Reason',
    'Director Report',
  ]

  const lines = rows.map((r) => {
    const cells: (string | number | boolean)[] = [
      r.date, r.day, r.siteName, r.director, r.status, r.qualityScore ?? '',
      r.attendance.preschool, r.attendance.subsidy, r.attendance.total,
      r.labor.totalHours, r.labor.overtimeHours, r.labor.directorMinutesInRooms,
      ...ENROLLMENT_FIELDS.flatMap((f) => {
        const c = r.enrollmentMarketing[f.key as keyof typeof r.enrollmentMarketing]
        return [c.count, countNoteSummary(c, f.itemFields)]
      }),
      ...STAFF_FIELDS.flatMap((f) => {
        const c = r.staff[f.key as keyof typeof r.staff]
        return [c.count, countNoteSummary(c, f.itemFields)]
      }),
      r.directorPacket.completed ? 'Yes' : 'No', r.directorPacket.incompleteReason,
      r.directorReport.filter(Boolean).join(' | '),
    ]
    return cells.map(csvCell).join(',')
  })

  return [headers.map(csvCell).join(','), ...lines].join('\n')
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportCsv(rows: DailyOpsReport[], label: string) {
  download(`bb-dor-${label}.csv`, reportsToCsv(rows), 'text/csv;charset=utf-8')
}

export function exportJson(rows: DailyOpsReport[], label: string) {
  download(`bb-dor-${label}.json`, JSON.stringify(rows, null, 2), 'application/json')
}
