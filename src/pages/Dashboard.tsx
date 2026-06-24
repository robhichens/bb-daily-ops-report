import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, Download, FileJson, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin as isAdminRole } from '@/lib/users'
import { SITES, type SiteId, type DailyOpsReport } from '@/lib/schema'
import { weekOf as weekOfFn } from '@/lib/derive'
import { todayIso, addIsoDays, formatShort } from '@/lib/dates'
import {
  subscribeReportsByWeek,
  subscribeRecentReports,
  getReportsByWeek,
  distinctWeeks,
} from '@/lib/reports'
import { buildDashboardView } from '@/lib/dashboard'
import {
  subscribeDirectorView,
  DEFAULT_DIRECTOR_VIEW,
  SECTION_META,
  type DirectorViewConfig as Config,
  type DashboardSection,
} from '@/lib/settings'
import { exportCsv, exportJson } from '@/lib/exportReports'
import { inputClass } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardSections } from '@/components/dashboard/DashboardSections'
import { DirectorViewConfig } from '@/components/dashboard/DirectorViewConfig'
import { ReportsTable } from '@/components/dashboard/ReportsTable'

const ALL_ON = Object.fromEntries(SECTION_META.map((s) => [s.key, true])) as Record<DashboardSection, boolean>

/** Subscribe to a week's reports (+ prior week for "most improved"). */
function useWeekData(weekOf: string) {
  const [rows, setRows] = useState<DailyOpsReport[]>([])
  const [lastWeekRows, setLastWeekRows] = useState<DailyOpsReport[]>([])
  useEffect(() => subscribeReportsByWeek(weekOf, null, setRows), [weekOf])
  useEffect(() => {
    let on = true
    getReportsByWeek(addIsoDays(weekOf, -7)).then((r) => on && setLastWeekRows(r)).catch(() => on && setLastWeekRows([]))
    return () => { on = false }
  }, [weekOf])
  return { rows, lastWeekRows }
}

export function Dashboard() {
  const { profile } = useAuth()
  return isAdminRole(profile?.role) ? <AdminDashboard /> : <DirectorDashboard />
}

// --- Admin: full dashboard + filters + director-view config -----------------
function AdminDashboard() {
  const today = todayIso()
  const currentWeek = weekOfFn(today)
  const [weeks, setWeeks] = useState<string[]>([currentWeek])
  const [weekOf, setWeekOf] = useState(currentWeek)
  const [site, setSite] = useState<SiteId | 'all'>('all')
  const [config, setConfig] = useState<Config>(DEFAULT_DIRECTOR_VIEW)
  const { rows, lastWeekRows } = useWeekData(weekOf)

  useEffect(
    () =>
      subscribeRecentReports(200, (recent) =>
        setWeeks(Array.from(new Set([currentWeek, ...distinctWeeks(recent)])).sort().reverse())
      ),
    [currentWeek]
  )
  useEffect(() => subscribeDirectorView(setConfig), [])

  const view = useMemo(
    () => buildDashboardView(rows, lastWeekRows, weekOf, site, today),
    [rows, lastWeekRows, weekOf, site, today]
  )
  const exportLabel = `${weekOf}${site === 'all' ? '' : '-' + site}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading icon={<LayoutDashboard className="size-5" />} title="Dashboard" subtitle="Live insights, red flags & celebrations" />
        <div className="flex flex-wrap items-center gap-2">
          <select value={weekOf} onChange={(e) => setWeekOf(e.target.value)} className={`${inputClass} h-9 w-auto`}>
            {weeks.map((w) => <option key={w} value={w}>Week of {formatShort(w)}</option>)}
          </select>
          <select value={site} onChange={(e) => setSite(e.target.value as SiteId | 'all')} className={`${inputClass} h-9 w-auto`}>
            <option value="all">All sites</option>
            {SITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => exportCsv(view.tableRows, exportLabel)}><Download className="size-3.5" /> CSV</Button>
          <Button size="sm" variant="ghost" onClick={() => exportJson(view.tableRows, exportLabel)}><FileJson className="size-3.5" /> JSON</Button>
        </div>
      </div>

      <DashboardSections view={view} sections={ALL_ON} />
      <ReportsTable rows={view.tableRows} />
      <DirectorViewConfig config={config} />
    </div>
  )
}

// --- Director: curated view of just the cards the admin published -----------
function DirectorDashboard() {
  const today = todayIso()
  const weekOf = weekOfFn(today)
  const [config, setConfig] = useState<Config>(DEFAULT_DIRECTOR_VIEW)
  const { rows, lastWeekRows } = useWeekData(weekOf)

  useEffect(() => subscribeDirectorView(setConfig), [])

  const view = useMemo(
    () => buildDashboardView(rows, lastWeekRows, weekOf, 'all', today),
    [rows, lastWeekRows, weekOf, today]
  )
  const anyOn = Object.values(config.sections).some(Boolean)

  return (
    <div className="space-y-6">
      <PageHeading icon={<Sparkles className="size-5" />} title="Team Dashboard" subtitle={`Week of ${formatShort(weekOf)}`} />
      {anyOn ? (
        <DashboardSections view={view} sections={config.sections} />
      ) : (
        <Card accent="sky" className="p-8 text-center">
          <p className="text-sm text-[var(--color-dk-gray)]">
            Your team dashboard isn’t set up yet. Check back soon!
          </p>
        </Card>
      )}
    </div>
  )
}

function PageHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-charcoal)] text-white">{icon}</span>
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">{title}</h1>
        <p className="text-sm text-[var(--color-dk-gray)]">{subtitle}</p>
      </div>
    </div>
  )
}
