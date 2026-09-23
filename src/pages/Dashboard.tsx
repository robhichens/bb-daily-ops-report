import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, Download, FileText } from 'lucide-react'
import type { Unsubscribe } from 'firebase/firestore'
import { useAuth } from '@/auth/AuthProvider'
import { accessibleReportKeys, isAdmin as isAdminRole, userSites } from '@/lib/users'
import { SITES, siteName, type SiteId, type DailyOpsReport, type FinanceReport, type LedgerNote, type OrgReport } from '@/lib/schema'
import { weekOf as weekOfFn } from '@/lib/derive'
import { todayIso, addIsoDays, daysBetween, formatRange } from '@/lib/dates'
import { subscribeRecentReports, subscribeReportsByRange } from '@/lib/reports'
import { buildDashboardView, openingsToStaff, type DashboardView } from '@/lib/dashboard'
import { adrSummary, cdrSummary, fdrSummary } from '@/lib/dashboardReports'
import {
  subscribeDirectorView,
  DEFAULT_DIRECTOR_VIEW,
  SECTION_META,
  type DirectorViewConfig as Config,
  type DashboardSection,
} from '@/lib/settings'
import { exportCsv } from '@/lib/exportReports'
import { exportReportsPdf } from '@/lib/exportPdf'
import { subscribeFinanceReportsByRange } from '@/lib/finance'
import { subscribeAllOrgNotes, subscribeLatestOrgReport, subscribeOrgReportsByRange } from '@/lib/orgReports'
import { ORG_DEFS, reportMeta } from '@/lib/reportRegistry'
import { inputClass } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardSections } from '@/components/dashboard/DashboardSections'
import { AdrSection, CdrSection, FdrSection, ReportSection } from '@/components/dashboard/ReportSections'
import { PeriodPicker } from '@/components/dashboard/PeriodPicker'
import { thisWeekPeriod, type Period } from '@/lib/period'
import { DirectorViewConfig } from '@/components/dashboard/DirectorViewConfig'
import { ReportsTable } from '@/components/dashboard/ReportsTable'
import { RequestLists } from '@/components/dashboard/RequestLists'
import { UsersPanel } from '@/components/dashboard/UsersPanel'

// ONE dashboard for everyone, assembled from the reports a person can access
// (Users & Access) and limited to their schools:
//   • DDR  → admins + directors. Directors see the cards switched on in
//            "Director view"; the leaderboard / team goal / celebrations stay
//            team-wide so the friendly competition still works.
//   • CDR  → co-directors (their campus) + anyone granted the CDR.
//   • ADR  → admissions + anyone granted it (org-wide, incl. Openings to Staff).
//   • FDR  → finance + anyone granted it, per location.
// Admins see every section across every school, plus the admin tools.
// Data subscriptions only open for reports the person can read (firestore.rules
// would refuse the rest).

const ALL_ON = Object.fromEntries(SECTION_META.map((s) => [s.key, true])) as Record<DashboardSection, boolean>
const ALL_SITE_IDS = SITES.map((s) => s.id)
const CDR_COL = ORG_DEFS.edr!.collection
const ADR_COL = ORG_DEFS.adr!.collection

type RangeSub<T> = (start: string, end: string, cb: (rows: T[]) => void) => Unsubscribe

/** Docs for the chosen period + the prior equal-length period (for deltas). */
function usePeriodRows<T extends { date: string }>(enabled: boolean, subscribe: RangeSub<T>, range: Period) {
  const [cur, setCur] = useState<T[]>([])
  const [prev, setPrev] = useState<T[]>([])
  useEffect(() => {
    if (!enabled) return
    const len = daysBetween(range.start, range.end) + 1
    const prevStart = addIsoDays(range.start, -len)
    return subscribe(prevStart, range.end, (all) => {
      setCur(all.filter((r) => r.date >= range.start && r.date <= range.end))
      setPrev(all.filter((r) => r.date >= prevStart && r.date < range.start))
    })
  }, [enabled, subscribe, range.start, range.end])
  return { cur, prev }
}

const subCdr: RangeSub<OrgReport> = (s, e, cb) => subscribeOrgReportsByRange(CDR_COL, s, e, cb)
const subAdr: RangeSub<OrgReport> = (s, e, cb) => subscribeOrgReportsByRange(ADR_COL, s, e, cb)
const subFdr: RangeSub<FinanceReport> = subscribeFinanceReportsByRange
const subDdr: RangeSub<DailyOpsReport> = subscribeReportsByRange

export function Dashboard() {
  const { profile } = useAuth()
  const admin = isAdminRole(profile?.role)
  const keys = accessibleReportKeys(profile)
  const has = { ddr: keys.includes('ddr'), cdr: keys.includes('edr'), adr: keys.includes('adr'), fdr: keys.includes('fdr') }

  // Schools this person covers. Org-wide roles (finance, admissions) have none
  // assigned, so their per-location reports span every school.
  const mySites = admin ? SITES : SITES.filter((s) => userSites(profile).includes(s.id))
  const sites = mySites.length ? mySites : SITES
  const siteIds = sites.map((s) => s.id)

  const today = todayIso()
  const [range, setRange] = useState<Period>(() => thisWeekPeriod())
  const [site, setSite] = useState<SiteId | 'all'>('all')
  const scope = site === 'all' ? siteIds : [site]

  const ddr = usePeriodRows(has.ddr, subDdr, range)
  const cdr = usePeriodRows(has.cdr, subCdr, range)
  const adr = usePeriodRows(has.adr, subAdr, range)
  const fdr = usePeriodRows(has.fdr, subFdr, range)

  const [config, setConfig] = useState<Config>(DEFAULT_DIRECTOR_VIEW)
  const [recentRows, setRecentRows] = useState<DailyOpsReport[]>([])
  const [orgNotes, setOrgNotes] = useState<LedgerNote[]>([])
  const [latestAdr, setLatestAdr] = useState<OrgReport | null>(null)
  useEffect(() => (has.ddr ? subscribeDirectorView(setConfig) : undefined), [has.ddr])
  useEffect(() => (admin ? subscribeRecentReports(200, setRecentRows) : undefined), [admin])
  useEffect(() => (admin ? subscribeAllOrgNotes(setOrgNotes) : undefined), [admin])
  useEffect(() => (has.adr ? subscribeLatestOrgReport(ADR_COL, setLatestAdr) : undefined), [has.adr])

  const ddrSections = admin ? ALL_ON : config.sections
  const anyDdrCard = has.ddr && Object.values(ddrSections).some(Boolean)

  const view = useMemo<DashboardView | null>(() => {
    if (!has.ddr) return null
    const weekEnd = weekOfFn(range.end)
    const mine = buildDashboardView(ddr.cur, ddr.prev, weekEnd, site, today, siteIds, latestAdr)
    if (admin) return mine
    // Directors: their schools' numbers, but the game cards cover the whole team.
    const team = buildDashboardView(ddr.cur, ddr.prev, weekEnd, 'all', today, ALL_SITE_IDS)
    return { ...mine, board: team.board, badgesBySite: team.badgesBySite, teamGoal: team.teamGoal, wins: team.wins, improved: team.improved }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has.ddr, admin, ddr.cur, ddr.prev, range.end, site, today, siteIds.join(), latestAdr])

  const cdrData = useMemo(() => (has.cdr ? cdrSummary(cdr.cur, cdr.prev, scope) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [has.cdr, cdr.cur, cdr.prev, scope.join()])
  const adrData = useMemo(() => (has.adr ? adrSummary(adr.cur, adr.prev) : null), [has.adr, adr.cur, adr.prev])
  const fdrData = useMemo(() => (has.fdr ? fdrSummary(fdr.cur, fdr.prev, scope) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [has.fdr, fdr.cur, fdr.prev, scope.join()])

  // The Openings hero sits in the DDR enrollment section when that's showing;
  // otherwise it leads the ADR section.
  const openingsInDdr = has.adr && anyDdrCard && ddrSections.enrollment
  const adrOpenings = has.adr && !openingsInDdr ? openingsToStaff(latestAdr, scope) : undefined

  const reportCount = [anyDdrCard, has.cdr, has.adr, has.fdr].filter(Boolean).length
  // Sections fold away behind their headings once there's more than one to scroll past.
  const multi = reportCount > 1
  const showSitePicker = sites.length > 1 && (has.ddr || has.cdr || has.fdr)

  const ddrBody = view && (
    <>
      <DashboardSections
        view={view}
        sections={ddrSections}
        showOpenings={has.adr}
      />
      <ReportsTable rows={view.tableRows} />
    </>
  )

  const fileTag = `${range.start}_${range.end}`
  const exportLabel = `${fileTag}${site === 'all' ? '' : '-' + site}`
  const periodLabel = formatRange(range.start, range.end)
  const siteLabel = site === 'all' ? (admin ? 'All sites' : 'My schools') : siteName(site)

  const subtitle = admin
    ? 'Live insights, red flags & celebrations'
    : [
        mySites.length ? mySites.map((s) => s.name).join(' · ') : 'All schools',
        keys.filter((k) => k !== 'mdr').map((k) => reportMeta(k)?.short).filter(Boolean).join(' · '),
      ].filter(Boolean).join(' — ')

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading icon={<LayoutDashboard className="size-5" />} title="Dashboard" subtitle={subtitle} />
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={range} onChange={setRange} />
          {showSitePicker && (
            <select value={site} onChange={(e) => setSite(e.target.value as SiteId | 'all')} className={`${inputClass} h-9 w-auto`}>
              <option value="all">{admin ? 'All sites' : 'All my schools'}</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {view && (
            <>
              <Button size="sm" variant="outline" onClick={() => exportCsv(view.tableRows, exportLabel)}><Download className="size-3.5" /> CSV</Button>
              <Button size="sm" onClick={() => void exportReportsPdf({ reports: view.tableRows, periodLabel, fileTag, siteLabel })}><FileText className="size-3.5" /> PDF</Button>
            </>
          )}
        </div>
      </div>

      {reportCount === 0 && (
        <Card accent="sky" className="p-8 text-center">
          <p className="text-sm text-[var(--color-dk-gray)]">
            {has.ddr ? 'Your team dashboard isn’t set up yet. Check back soon!' : 'No reports are assigned to you yet — ask an admin to add you in Users & Access.'}
          </p>
        </Card>
      )}

      {view && anyDdrCard && (multi ? (
        <ReportSection
          title="Director Daily Report"
          sub={site === 'all' ? undefined : siteName(site)}
          summary={`${view.tableRows.length} report${view.tableRows.length === 1 ? '' : 's'} filed`}
          storageKey="ddr"
        >
          {ddrBody}
        </ReportSection>
      ) : (
        <div className="space-y-4">{ddrBody}</div>
      ))}

      {admin && <RequestLists reports={recentRows} orgNotes={orgNotes} />}

      {cdrData && <CdrSection summary={cdrData} title="Co-Director Daily Report" collapsible={multi} />}
      {adrData && <AdrSection summary={adrData} openings={adrOpenings} collapsible={multi} />}
      {fdrData && <FdrSection summary={fdrData} collapsible={multi} />}

      {admin && <DirectorViewConfig config={config} />}
      {admin && <UsersPanel />}
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
