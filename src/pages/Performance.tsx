import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { BarChart3, Printer, ClipboardCheck, Building2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin } from '@/lib/users'
import { SITES, type DailyOpsReport } from '@/lib/schema'
import { subscribeRecentReports } from '@/lib/reports'
import { buildPerformanceReport, type DirectorScorecard } from '@/lib/performance'
import { todayIso, formatShort } from '@/lib/dates'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function Performance() {
  const { profile } = useAuth()
  const [reports, setReports] = useState<DailyOpsReport[]>([])
  useEffect(() => subscribeRecentReports(500, setReports), [])

  const today = todayIso()
  const report = useMemo(() => buildPerformanceReport(reports, SITES, today), [reports, today])

  if (!isAdmin(profile?.role)) return <Navigate to="/dashboard" replace />

  const hasData = report.cards.some((c) => c.reportsFiled > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-charcoal)] text-white">
            <BarChart3 className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">Director Performance</h1>
            <p className="text-sm text-[var(--color-dk-gray)]">
              {hasData
                ? `Since launch · ${formatShort(report.periodStart)} – ${formatShort(report.asOf)}${
                    report.excludedWeeks.length
                      ? ` · excludes wk of ${report.excludedWeeks.map(formatShort).join(', ')}`
                      : ''
                  }`
                : 'Side-by-side view of every director'}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()} className="print:hidden">
          <Printer className="size-3.5" /> Print / Save PDF
        </Button>
      </div>

      {!hasData ? (
        <Card accent="sky" className="p-8 text-center">
          <p className="text-sm text-[var(--color-dk-gray)]">
            No submitted reports yet. This report fills in as directors file their daily reports.
          </p>
        </Card>
      ) : (
        <>
          <MetricSection
            icon={<ClipboardCheck className="size-4 text-[var(--color-coral-dark)]" />}
            title="Report discipline & quality"
            caption="How consistently and thoroughly each director files the DOR — the fairest read on their own habits."
            cards={report.cards}
            rows={DISCIPLINE_ROWS}
          />

          <MetricSection
            icon={<Building2 className="size-4 text-[var(--color-sky-deep)]" />}
            title="Operational snapshot"
            caption="Site outcomes over the same period. These are shaped by market and staffing conditions, not just the director — read them as context, not a grade."
            cards={report.cards}
            rows={OPERATIONAL_ROWS}
          />
        </>
      )}
    </div>
  )
}

// --- Metric row specs --------------------------------------------------------

interface Row {
  label: string
  value: (c: DirectorScorecard) => ReactNode
}

const DISCIPLINE_ROWS: Row[] = [
  { label: 'Days filed', value: (c) => c.reportsFiled },
  { label: 'Completion (of workdays)', value: (c) => `${c.completionPct}%` },
  { label: 'On-time', value: (c) => `${c.onTimePct}%` },
  { label: 'Early-bird (before 6 PM)', value: (c) => `${c.earlyBirdPct}%` },
  { label: 'Avg quality (/100)', value: (c) => c.avgQuality },
  { label: 'Current streak', value: (c) => c.currentStreak },
  { label: 'Longest streak', value: (c) => c.longestStreak },
  { label: 'Points', value: (c) => c.points },
]

const OPERATIONAL_ROWS: Row[] = [
  { label: 'Avg attendance', value: (c) => c.avgAttendance },
  { label: 'Overtime (OT hours as % of all labor hours)', value: (c) => `${c.overtimePct}%` },
  { label: 'Tours scheduled', value: (c) => c.toursScheduled },
  { label: 'Tours given', value: (c) => c.toursGiven },
  { label: 'Reg fees paid', value: (c) => c.regFeesPaid },
  { label: 'New starts', value: (c) => c.newStarts },
  { label: 'Enrollments', value: (c) => c.enrollments },
  { label: 'Terminations', value: (c) => c.terminations },
  { label: 'Net enrollment (new starts − terminations)', value: (c) => (c.netEnrollment > 0 ? `+${c.netEnrollment}` : c.netEnrollment) },
  { label: 'Packet compliance (% of filed days with packet done)', value: (c) => `${c.packetPct}%` },
  { label: 'Comms out', value: (c) => c.commsOut },
  { label: 'Call-outs / late', value: (c) => c.callOuts },
  { label: 'Time recruiting (hrs)', value: (c) => c.timeRecruiting },
]

// --- Table -------------------------------------------------------------------

function MetricSection({
  icon,
  title,
  caption,
  cards,
  rows,
}: {
  icon: ReactNode
  title: string
  caption: string
  cards: DirectorScorecard[]
  rows: Row[]
}) {
  return (
    <Card accent="gray" className="overflow-hidden break-inside-avoid">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-5">
        {icon}
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-mid-gray)]">
                Metric
              </th>
              {cards.map((c) => (
                <th key={c.siteId} className="px-5 py-3 text-right">
                  <div className="font-bold text-[var(--color-charcoal)]">{c.director || c.siteName}</div>
                  <div className="text-xs font-normal text-[var(--color-dk-gray)]">{c.siteName}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={i % 2 ? 'bg-[var(--color-secondary)]/40' : undefined}
              >
                <td className="px-5 py-2.5 text-left text-[var(--color-dk-gray)]">{row.label}</td>
                {cards.map((c) => (
                  <td
                    key={c.siteId}
                    className="px-5 py-2.5 text-right font-semibold tabular-nums text-[var(--color-charcoal)]"
                  >
                    {row.value(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-dk-gray)]">{caption}</p>
    </Card>
  )
}

