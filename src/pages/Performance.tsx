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
          <TrendSection cards={report.cards} weeks={report.weeks} />

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
  { label: 'Overtime', value: (c) => `${c.overtimePct}%` },
  { label: 'Tours scheduled', value: (c) => c.toursScheduled },
  { label: 'Tours given', value: (c) => c.toursGiven },
  { label: 'Reg fees paid', value: (c) => c.regFeesPaid },
  { label: 'New starts', value: (c) => c.newStarts },
  { label: 'Enrollments', value: (c) => c.enrollments },
  { label: 'Terminations', value: (c) => c.terminations },
  { label: 'Net enrollment', value: (c) => (c.netEnrollment > 0 ? `+${c.netEnrollment}` : c.netEnrollment) },
  { label: 'Packet compliance', value: (c) => `${c.packetPct}%` },
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

// --- Weekly trend ------------------------------------------------------------

function TrendSection({ cards, weeks }: { cards: DirectorScorecard[]; weeks: string[] }) {
  return (
    <Card accent="coral" className="break-inside-avoid p-5">
      <h2 className="mb-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-coral-dark)]">
        Weekly consistency trend
      </h2>
      <p className="mb-4 text-xs text-[var(--color-dk-gray)]">
        Consistency (0–100) blends completion, timeliness and quality, week by week
        {weeks.length > 1 ? ` · ${formatShort(weeks[0])} → ${formatShort(weeks[weeks.length - 1])}` : ''}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const series = c.weekly.map((w) => w.consistency)
          const latest = series.length ? series[series.length - 1] : 0
          return (
            <div key={c.siteId} className="rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--color-charcoal)]">{c.director || c.siteName}</p>
                  <p className="text-xs text-[var(--color-dk-gray)]">{c.siteName}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold tabular-nums text-[var(--color-charcoal)]">{latest}</p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-mid-gray)]">latest</p>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline data={series} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Sparkline({ data, width = 240, height = 44 }: { data: number[]; width?: number; height?: number }) {
  if (data.length === 0) return null
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  const stepX = data.length > 1 ? width / (data.length - 1) : 0
  const y = (v: number) => height - (clamp(v) / 100) * height
  const coords = data.map((v, i) => [data.length > 1 ? i * stepX : width / 2, y(v)] as const)
  const path = coords.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(1)}`).join(' ')
  const [lx, ly] = coords[coords.length - 1]
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block">
      {/* baseline at 50 for reference */}
      <line x1="0" y1={y(50)} x2={width} y2={y(50)} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 3" />
      {data.length > 1 && (
        <path d={path} fill="none" stroke="var(--color-coral)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}
      <circle cx={lx} cy={ly} r="3" fill="var(--color-coral)" />
    </svg>
  )
}
