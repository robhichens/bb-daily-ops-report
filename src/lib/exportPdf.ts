// src/lib/exportPdf.ts
// PDF export of the actual SUBMISSION data — a faithful, printable copy of each
// Daily Ops Report (every field + notes as entered), one report per page.
// Reflects the dashboard's current week/site selection.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  ENROLLMENT_FIELDS,
  STAFF_FIELDS,
  countNoteSummary,
  type DailyOpsReport,
  type EnrollmentMarketing,
  type Staff,
} from './schema'
import { formatLong } from './dates'

const C = {
  charcoal: [84, 84, 84] as [number, number, number],
  coral: [240, 135, 130] as [number, number, number],
  coralDark: [196, 94, 89] as [number, number, number],
  skyDeep: [59, 155, 163] as [number, number, number],
  good: [91, 185, 140] as [number, number, number],
  cream: [250, 250, 245] as [number, number, number],
  dkGray: [109, 110, 113] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

async function loadImage(url: string, maxPx = 96): Promise<string | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    await img.decode()
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

function fmtSubmitted(r: DailyOpsReport): string {
  if (r.status !== 'submitted' || !r.submittedAt) return 'Draft (not submitted)'
  const d = new Date(r.submittedAt)
  return `Submitted ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export async function exportReportsPdf(opts: {
  reports: DailyOpsReport[]
  weekOf: string
  siteLabel: string
}): Promise<void> {
  const { reports, weekOf, siteLabel } = opts
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 14
  const logo = await loadImage('/brand/bb-tree.png')

  const band = (title: string, sub: string, meta: string) => {
    doc.setFillColor(...C.charcoal)
    doc.rect(0, 0, pageW, 30, 'F')
    if (logo) doc.addImage(logo, 'PNG', M, 6, 18, 18)
    const tx = logo ? M + 23 : M
    doc.setTextColor(...C.coral)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(title, tx, 13)
    doc.setTextColor(...C.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(sub, tx, 20)
    doc.setTextColor(209, 210, 212)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(meta, tx, 26)
  }

  const heading = (y: number, text: string, color: [number, number, number]) => {
    doc.setTextColor(...color)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text(text, M, y)
    return y + 2.5
  }

  const ensureSpace = (y: number, needed: number) => {
    if (y + needed > pageH - 16) {
      doc.addPage()
      return 20
    }
    return y
  }

  const sorted = [...reports].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.siteName.localeCompare(b.siteName)
  )

  if (sorted.length === 0) {
    band('Daily Ops Report', siteLabel, `Week of ${formatLong(weekOf)}`)
    doc.setTextColor(...C.dkGray)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text('No submitted reports for this selection.', M, 44)
    doc.save(`bb-dor-reports-${weekOf}.pdf`)
    return
  }

  const tableBase = {
    margin: { left: M, right: M },
    styles: { fontSize: 8.6, cellPadding: 1.8, textColor: C.charcoal, valign: 'top' as const },
  }

  sorted.forEach((r, i) => {
    if (i > 0) doc.addPage()
    band(
      'Daily Ops Report',
      `${r.siteName} · ${formatLong(r.date)}`,
      `Director: ${r.director || '—'}    ·    ${fmtSubmitted(r)}    ·    Quality ${r.qualityScore ?? 0}/100`
    )

    let y = 38

    // Attendance & Labor
    y = heading(y, 'Attendance & Labor', C.skyDeep)
    autoTable(doc, {
      ...tableBase,
      startY: y,
      theme: 'plain',
      body: [
        ['Pre-School', `${r.attendance.preschool}`],
        ['Subsidy (DSS, CCA, Foster, United Way)', `${r.attendance.subsidy}`],
        ['Total Attendance', `${r.attendance.total}`],
        ['Total Labor Hours', `${r.labor.totalHours}`],
        ['Total Overtime Hours', `${r.labor.overtimeHours}`],
        ['Director Minutes in Rooms', `${r.labor.directorMinutesInRooms}`],
      ],
      columnStyles: { 0: { cellWidth: 95, textColor: C.dkGray }, 1: { fontStyle: 'bold' } },
    })
    y = lastY(doc) + 7

    // Enrollment / Marketing
    y = ensureSpace(y, 30)
    y = heading(y, 'Enrollment / Marketing', C.coralDark)
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Field', 'Count', 'Notes']],
      body: ENROLLMENT_FIELDS.map((f) => {
        const c = r.enrollmentMarketing[f.key as keyof EnrollmentMarketing]
        return [f.label, `${c.count}`, countNoteSummary(c, f.itemFields) || '—']
      }),
      headStyles: { fillColor: C.coral, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.cream },
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 'auto' } },
    })
    y = lastY(doc) + 7

    // Staff
    y = ensureSpace(y, 30)
    y = heading(y, 'Staff', C.charcoal)
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Field', 'Count', 'Notes']],
      body: STAFF_FIELDS.map((f) => {
        const c = r.staff[f.key as keyof Staff]
        const isHours = f.key === 'timeSpentRecruiting'
        return [isHours ? 'Time Spent Recruiting (hrs)' : f.label, `${c.count}`, countNoteSummary(c, f.itemFields) || '—']
      }),
      headStyles: { fillColor: C.charcoal, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.cream },
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 'auto' } },
    })
    y = lastY(doc) + 7

    // Director Packet
    y = ensureSpace(y, 18)
    y = heading(y, 'Director Packet', C.skyDeep)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...C.charcoal)
    doc.text(`Completed today:  ${r.directorPacket.completed ? 'Yes' : 'No'}`, M, y + 3)
    y += 3
    if (!r.directorPacket.completed && r.directorPacket.incompleteReason) {
      const lines = doc.splitTextToSize(`What got in the way: ${r.directorPacket.incompleteReason}`, pageW - M * 2) as string[]
      doc.setTextColor(...C.dkGray)
      doc.text(lines, M, y + 6)
      y += 6 + lines.length * 4
    }
    y += 6

    // Director Report
    const reportLines = r.directorReport.map((l) => l.trim()).filter(Boolean)
    if (reportLines.length) {
      y = ensureSpace(y, 20)
      y = heading(y, 'Director Report on the Day', C.coralDark)
      autoTable(doc, {
        ...tableBase,
        startY: y,
        body: reportLines.map((l, idx) => [`${idx + 1}`, l]),
        theme: 'plain',
        columnStyles: { 0: { cellWidth: 8, fontStyle: 'bold', textColor: C.coral }, 1: { cellWidth: 'auto' } },
      })
    }
  })

  // Footers on every page
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.dkGray)
    doc.text('Bright Beginnings · Daily Ops Report', M, pageH - 8)
    doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 8, { align: 'right' })
  }

  const label = `${weekOf}${siteLabel === 'All sites' ? '' : '-' + siteLabel.toLowerCase().replace(/\s+/g, '-')}`
  doc.save(`bb-dor-reports-${label}.pdf`)
}
