import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, Download, FileText, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin as isAdminRole, userSites } from '@/lib/users'
import { SITES, siteName, type SiteId, type DailyOpsReport, type SiteConfig, type LedgerNote, type OrgReport } from '@/lib/schema'
import { weekOf as weekOfFn } from '@/lib/derive'
import { todayIso, addIsoDays, formatShort, daysBetween, formatRange } from '@/lib/dates'
import {
  subscribeReportsByWeek,
  subscribeRecentReports,
  getReportsByWeek,
  subscribeReportsByRange,
} from '@/lib/reports'
import { buildDashboardView } from '@/lib/dashboard'
import {
  subscribeDirectorView,
  DEFAULT_DIRECTOR_VIEW,
  SECTION_META,
  type DirectorViewConfig as Config,
  type DashboardSection,
} from '@/lib/settings'
import { exportCsv } from '@/lib/exportReports'
import { exportReportsPdf } from '@/lib/exportPdf'
import { inputClass } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardSections } from '@/components/dashboard/DashboardSections'
import { PeriodPicker } from '@/components/dashboard/PeriodPicker'
import { thisWeekPeriod, type Period } from '@/lib/period'
import { DirectorViewConfig } from '@/components/dashboard/DirectorViewConfig'
import { ReportsTable } from '@/components/dashboard/ReportsTable'
import { RequestLists } from '@/components/dashboard/RequestLists'
import { subscribeAllOrgNotes, subscribeLatestOrgReport } from '@/lib/orgReports'
import { UsersPanel } from '@/components/dashboard/UsersPanel'

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
  if (isAdminRole(profile?.role)) return <FullDashboard sites={SITES} admin />
  const mySites = SITES.filter((s) => userSites(profile).includes(s.id))
  // Directors covering 2+ schools get the full dashboard scoped to their sites.
  if (mySites.length > 1) return <FullDashboard sites={mySites} admin={false} />
  return <DirectorDashboard />
}

// --- Full dashboard: filters + table + exports. Admins see every site plus the
// --- director-view config and user management; multi-site directors see only
// --- their schools' data.
function FullDashboard({ sites, admin }: { sites: SiteConfig[]; admin: boolean }) {
  const today = todayIso()
  const scope = sites.map((s) => s.id)
  const [range, setRange] = useState<Period>(() => thisWeekPeriod())
  const [site, setSite] = useState<SiteId | 'all'>('all')
  const [config, setConfig] = useState<Config>(DEFAULT_DIRECTOR_VIEW)
  const [recentRows, setRecentRows] = useState<DailyOpsReport[]>([])
  const [orgNotes, setOrgNotes] = useState<LedgerNote[]>([])
  const [latestAdr, setLatestAdr] = useState<OrgReport | null>(null)
  const [rangeRows, setRangeRows] = useState<DailyOpsReport[]>([])
  const [prevRows, setPrevRows] = useState<DailyOpsReport[]>([])

  // Reports for the selected period + the prior equal-length period (for deltas).
  useEffect(() => {
    const len = daysBetween(range.start, range.end) + 1
    const prevStart = addIsoDays(range.start, -len)
    return subscribeReportsByRange(prevStart, range.end, (all) => {
      setRangeRows(all.filter((r) => r.date >= range.start && r.date <= range.end))
      setPrevRows(all.filter((r) => r.date >= prevStart && r.date < range.start))
    })
  }, [range.start, range.end])

  useEffect(() => subscribeRecentReports(200, setRecentRows), [])
  useEffect(() => (admin ? subscribeDirectorView(setConfig) : undefined), [admin])
  useEffect(() => (admin ? subscribeAllOrgNotes(setOrgNotes) : undefined), [admin])
  useEffect(() => (admin ? subscribeLatestOrgReport('admissionsReports', setLatestAdr) : undefined), [admin])

  const view = useMemo(
    () => buildDashboardView(rangeRows, prevRows, weekOfFn(range.end), site, today, scope, latestAdr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeRows, prevRows, range.end, site, today, scope.join(), latestAdr]
  )
  const fileTag = `${range.start}_${range.end}`
  const exportLabel = `${fileTag}${site === 'all' ? '' : '-' + site}`
  const periodLabel = formatRange(range.start, range.end)
  const siteLabel = site === 'all' ? (admin ? 'All sites' : 'My schools') : siteName(site)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          icon={<LayoutDashboard className="size-5" />}
          title="Dashboard"
          subtitle={admin ? 'Live insights, red flags & celebrations' : `Your schools: ${sites.map((s) => s.name).join(' · ')}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={range} onChange={setRange} />
          <select value={site} onChange={(e) => setSite(e.target.value as SiteId | 'all')} className={`${inputClass} h-9 w-auto`}>
            <option value="all">{admin ? 'All sites' : 'All my schools'}</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => exportCsv(view.tableRows, exportLabel)}><Download className="size-3.5" /> CSV</Button>
          <Button size="sm" onClick={() => void exportReportsPdf({ reports: view.tableRows, periodLabel, fileTag, siteLabel })}><FileText className="size-3.5" /> PDF</Button>
        </div>
      </div>

      <DashboardSections view={view} sections={ALL_ON} />
      <ReportsTable rows={view.tableRows} />
      {admin && <RequestLists reports={recentRows} orgNotes={orgNotes} />}
      {admin && <DirectorViewConfig config={config} />}
      {admin && <UsersPanel />}
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
