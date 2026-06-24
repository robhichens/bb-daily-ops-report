import type { DashboardView } from '@/lib/dashboard'
import type { DashboardSection } from '@/lib/settings'
import { KpiCards } from './KpiCards'
import { Leaderboard } from './Leaderboard'
import { TeamGoalBar } from './TeamGoalBar'
import { AttendanceBySite, EnrollmentFunnel, StaffWatch, PacketPanel } from './Panels'
import { RedFlags, Celebrations } from './FlagsAndCelebrations'

type Sections = Record<DashboardSection, boolean>

/** Renders the dashboard cards selected in `sections`. Shared by the admin
 *  dashboard (all on) and the curated director view. */
export function DashboardSections({ view, sections }: { view: DashboardView; sections: Sections }) {
  const gameRow = sections.leaderboard || sections.teamGoal || sections.celebrations
  const opsRow = sections.attendance || sections.funnel || sections.staffWatch || sections.packet

  return (
    <div className="space-y-6">
      {sections.kpis && <KpiCards kpis={view.kpis} />}

      {gameRow && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {sections.leaderboard && (
            <Leaderboard rows={view.board} badgesBySite={view.badgesBySite} mostImproved={view.improved} />
          )}
          {(sections.teamGoal || sections.celebrations) && (
            <div className="flex flex-col gap-4">
              {sections.teamGoal && <TeamGoalBar goal={view.teamGoal} />}
              {sections.celebrations && <Celebrations items={view.wins} />}
            </div>
          )}
        </div>
      )}

      {opsRow && (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.attendance && <AttendanceBySite bars={view.attendance} />}
          {sections.funnel && <EnrollmentFunnel stages={view.funnel} />}
          {sections.staffWatch && <StaffWatch rows={view.staff} />}
          {sections.packet && <PacketPanel data={view.packet} />}
        </div>
      )}

      {sections.redFlags && <RedFlags flags={view.flags} />}
    </div>
  )
}
