// src/lib/exportPdf.ts
// One-click branded "Weekly Ops Summary" PDF for leadership — KPIs, leaderboard,
// flags & celebrations, packet compliance, and the reports table. Reflects the
// dashboard's current week/site selection.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { siteName } from './schema'
import { formatLong, formatShort } from './dates'
import type { DashboardView } from './dashboard'

// Brand palette as RGB tuples.
const C = {
  charcoal: [84, 84, 84] as [number, number, number],
  coral: [240, 135, 130] as [number, number, number],
  coralDark: [196, 94, 89] as [number, number, number],
  yellow: [255, 212, 55] as [number, number, number],
  skyDeep: [59, 155, 163] as [number, number, number],
  good: [91, 185, 140] as [number, number, number],
  cream: [250, 250, 245] as [number, number, number],
  dkGray: [109, 110, 113] as [number, number, number],
  ltGray: [209, 210, 212] as [number, number, number],
  critical: [229, 86, 78] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

/** Load + downscale an image to a small PNG dataURL so it embeds compactly
 *  (the source brand assets are ~1500px; jsPDF stores raw bitmap otherwise). */
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

export async function exportWeeklyPdf(opts: {
  view: DashboardView
  weekOf: string
  siteLabel: string
}): Promise<void> {
  const { view, weekOf, siteLabel } = opts
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const M = 14
  const logo = await loadImage('/brand/bb-tree.png')

  // --- Header band ---------------------------------------------------------
  doc.setFillColor(...C.charcoal)
  doc.rect(0, 0, pageW, 30, 'F')
  if (logo) doc.addImage(logo, 'PNG', M, 6, 18, 18)
  const tx = logo ? M + 23 : M
  doc.setTextColor(...C.coral)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('Daily Ops Report', tx, 14)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Weekly Summary  ·  Bright Beginnings', tx, 21)
  doc.setTextColor(...C.ltGray)
  doc.setFontSize(8)
  doc.text(
    `Week of ${formatLong(weekOf)}   ·   ${siteLabel}   ·   Generated ${formatLong(new Date().toISOString().slice(0, 10))}`,
    tx,
    26.5
  )

  let y = 40

  // --- KPI row -------------------------------------------------------------
  const k = view.kpis
  const kpis = [
    { label: 'Avg Attendance', value: `${k.avgAttendance}`, color: C.skyDeep },
    { label: 'Overtime', value: `${k.overtimeHours} hrs`, sub: `${k.overtimePct}%`, color: k.overtimeFlag ? C.critical : C.dkGray },
    { label: 'Enrollment Comms', value: `${k.commsOut}`, sub: `goal ${k.commsGoal}`, color: k.commsMet ? C.good : C.coralDark },
    { label: 'Net New Starts', value: `${k.netNewStarts > 0 ? '+' : ''}${k.netNewStarts}`, color: C.coral },
  ]
  const boxW = (pageW - M * 2 - 9) / 4
  kpis.forEach((kp, i) => {
    const x = M + i * (boxW + 3)
    doc.setFillColor(...C.cream)
    doc.roundedRect(x, y, boxW, 20, 2, 2, 'F')
    doc.setTextColor(...C.dkGray)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(kp.label.toUpperCase(), x + 3, y + 5)
    doc.setTextColor(...C.charcoal)
    doc.setFontSize(15)
    doc.text(kp.value, x + 3, y + 13)
    if (kp.sub) {
      doc.setTextColor(...kp.color)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text(kp.sub, x + 3, y + 18)
    }
  })
  y += 28

  // --- Leaderboard ---------------------------------------------------------
  doc.setTextColor(...C.coralDark)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Weekly Leaderboard', M, y)
  y += 2
  autoTable(doc, {
    startY: y,
    head: [['#', 'Site', 'Consistency', 'Streak', 'Filed', 'Points']],
    body: view.board.map((r) => [
      `${r.rank}`,
      siteName(r.siteId),
      `${r.consistency}`,
      `${r.streak}`,
      `${r.filed}/${r.expected}`,
      `${r.points}`,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, textColor: C.charcoal, lineColor: [231, 230, 223] },
    headStyles: { fillColor: C.charcoal, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.cream },
    margin: { left: M, right: M },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // --- Flags & celebrations (two columns) ----------------------------------
  const colW = (pageW - M * 2 - 6) / 2
  const startY = y
  const listBlock = (title: string, items: string[], x: number, color: [number, number, number], empty: string) => {
    let yy = startY
    doc.setTextColor(...color)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(title, x, yy)
    yy += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...C.charcoal)
    if (items.length === 0) {
      doc.setTextColor(...C.dkGray)
      doc.text(empty, x, yy)
      yy += 5
    } else {
      for (const it of items.slice(0, 8)) {
        const lines = doc.splitTextToSize(`•  ${it}`, colW - 2) as string[]
        doc.text(lines, x, yy)
        yy += lines.length * 4 + 1
      }
    }
    return yy
  }
  const flagsEnd = listBlock('Red Flags', view.flags.map((f) => f.text), M, C.critical, 'All clear — nothing flagged.')
  const winsEnd = listBlock('Celebrations', view.wins.map((w) => w.text), M + colW + 6, C.skyDeep, 'Wins will appear as reports roll in.')
  y = Math.max(flagsEnd, winsEnd) + 6

  // --- Packet compliance line ---------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...C.charcoal)
  doc.text(
    `Director Packet Compliance:  ${view.packet.pct}%  (${view.packet.completed}/${view.packet.total} completed)`,
    M,
    y
  )
  y += 6

  // --- Reports table -------------------------------------------------------
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Site', 'Director', 'Attend.', 'OT', 'Quality', 'Packet']],
    body: [...view.tableRows]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.siteName.localeCompare(b.siteName)))
      .map((r) => [
        formatShort(r.date),
        r.siteName,
        r.director || '—',
        `${r.attendance.total}`,
        `${r.labor.overtimeHours}`,
        `${r.qualityScore ?? 0}`,
        r.directorPacket.completed ? 'Yes' : 'No',
      ]),
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2, textColor: C.charcoal },
    headStyles: { fillColor: C.coral, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.cream },
    margin: { left: M, right: M },
    didDrawPage: () => {
      // Footer on every page
      const h = doc.internal.pageSize.getHeight()
      const page = doc.getCurrentPageInfo().pageNumber
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.dkGray)
      doc.text('Bright Beginnings · Daily Ops Report', M, h - 8)
      doc.text(`Page ${page}`, pageW - M, h - 8, { align: 'right' })
    },
  })

  const label = `${weekOf}${siteLabel === 'All sites' ? '' : '-' + siteLabel.toLowerCase().replace(/\s+/g, '-')}`
  doc.save(`bb-dor-summary-${label}.pdf`)
}
