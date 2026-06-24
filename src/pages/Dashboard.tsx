import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, Download, FileJson } from 'lucide-react'
import { SITES, type SiteId, type DailyOpsReport } from '@/lib/schema'
import { weekOf as weekOfFn } from '@/lib/derive'
import { todayIso, addIsoDays, formatShort } from '@/lib/dates'
import {
  subscribeReportsByWeek,
  subscribeRecentReports,
  getReportsByWeek,
  distinctWeeks,
} from '@/lib/reports'
import { leaderboard, teamGoalProgress, badgesForSite, type Badge } from '@/lib/gamification'
import {
  computeKpis,
  attendanceBySite,
  enrollmentFunnel,
  staffWatch,
  packetCompliance,
  redFlags,
  celebrations,
  mostImproved,
} from '@/lib/dashboard'
import { exportCsv, exportJson } from '@/lib/exportReports'
import { inputClass } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { KpiCards } from '@/components/dashboard/KpiCards'
import { Leaderboard } from '@/components/dashboard/Leaderboard'
import { TeamGoalBar } from '@/components/dashboard/TeamGoalBar'
import { AttendanceBySite, EnrollmentFunnel, StaffWatch, PacketPanel } from '@/components/dashboard/Panels'
import { RedFlags, Celebrations } from '@/components/dashboard/FlagsAndCelebrations'
import { ReportsTable } from '@/components/dashboard/ReportsTable'

const SITE_IDS = SITES.map((s) => s.id)

export function Dashboard() {
  const today = todayIso()
  const currentWeek = weekOfFn(today)

  const [weeks, setWeeks] = useState<string[]>([currentWeek])
  const [weekOf, setWeekOf] = useState<string>(currentWeek)
  const [site, setSite] = useState<SiteId | 'all'>('all')
  const [rows, setRows] = useState<DailyOpsReport[]>([])
  const [lastWeekRows, setLastWeekRows] = useState<DailyOpsReport[]>([])

  // Available weeks for the picker.
  useEffect(() => {
    return subscribeRecentReports(200, (recent) => {
      const found = distinctWeeks(recent)
      const merged = Array.from(new Set([currentWeek, ...found])).sort().reverse()
      setWeeks(merged)
    })
  }, [currentWeek])

  // Live reports for the selected week (all sites; we filter client-side).
  useEffect(() => {
    return subscribeReportsByWeek(weekOf, null, setRows)
  }, [weekOf])

  // Prior week (one-shot) for "most improved".
  useEffect(() => {
    let on = true
    getReportsByWeek(addIsoDays(weekOf, -7))
      .then((r) => on && setLastWeekRows(r))
      .catch(() => on && setLastWeekRows([]))
    return () => {
      on = false
    }
  }, [weekOf])

  const view = useMemo(() => {
    const weekFri = addIsoDays(weekOf, 4)
    const asOf = today < weekFri ? today : weekFri
    const lastWeekOf = addIsoDays(weekOf, -7)
    const lastAsOf = addIsoDays(lastWeekOf, 4)

    const submitted = rows.filter((r) => r.status === 'submitted')
    const allSites = submitted // leaderboard / flags / celebrations span all sites
    const filtered = site === 'all' ? submitted : submitted.filter((r) => r.siteId === site)

    const board = leaderboard(allSites, SITE_IDS, weekOf, asOf)
    const badgesBySite: Record<string, Badge[]> = {}
    for (const id of SITE_IDS) badgesBySite[id] = badgesForSite(allSites, id, weekOf, asOf)

    return {
      asOf,
      kpis: computeKpis(filtered),
      board,
      badgesBySite,
      teamGoal: teamGoalProgress(allSites, SITE_IDS, weekOf, asOf),
      attendance: attendanceBySite(allSites),
      funnel: enrollmentFunnel(filtered),
      staff: staffWatch(filtered),
      packet: packetCompliance(filtered),
      flags: redFlags(allSites, weekOf, asOf, today),
      wins: celebrations(allSites, weekOf, asOf),
      improved: mostImproved(allSites, lastWeekRows, weekOf, lastWeekOf, asOf, lastAsOf),
      tableRows: filtered,
    }
  }, [rows, lastWeekRows, weekOf, site, today])

  const exportLabel = `${weekOf}${site === 'all' ? '' : '-' + site}`

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-charcoal)] text-white">
            <LayoutDashboard className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">Dashboard</h1>
            <p className="text-sm text-[var(--color-dk-gray)]">Live insights, red flags & celebrations</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={weekOf} onChange={(e) => setWeekOf(e.target.value)} className={`${inputClass} h-9 w-auto`}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week of {formatShort(w)}
              </option>
            ))}
          </select>
          <select value={site} onChange={(e) => setSite(e.target.value as SiteId | 'all')} className={`${inputClass} h-9 w-auto`}>
            <option value="all">All sites</option>
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => exportCsv(view.tableRows, exportLabel)} title="Export CSV">
            <Download className="size-3.5" /> CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={() => exportJson(view.tableRows, exportLabel)} title="Export JSON">
            <FileJson className="size-3.5" /> JSON
          </Button>
        </div>
      </div>

      <KpiCards kpis={view.kpis} />

      {/* Gamification row */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Leaderboard rows={view.board} badgesBySite={view.badgesBySite} mostImproved={view.improved} />
        <div className="flex flex-col gap-4">
          <TeamGoalBar goal={view.teamGoal} />
          <Celebrations items={view.wins} />
        </div>
      </div>

      {/* Operational row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AttendanceBySite bars={view.attendance} />
        <EnrollmentFunnel stages={view.funnel} />
        <StaffWatch rows={view.staff} />
        <PacketPanel data={view.packet} />
      </div>

      <RedFlags flags={view.flags} />

      <ReportsTable rows={view.tableRows} />
    </div>
  )
}
