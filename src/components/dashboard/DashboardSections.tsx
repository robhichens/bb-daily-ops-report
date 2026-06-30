import type { DashboardView } from '@/lib/dashboard'
import type { DashboardSection } from '@/lib/settings'
import { KpiCards } from './KpiCards'
import { Leaderboard } from './Leaderboard'
import { TeamGoalBar } from './TeamGoalBar'
import { EnrollmentFunnelBySite, StaffWatch, PacketPanel } from './Panels'
import { RedFlags, Celebrations } from './FlagsAndCelebrations'

type Sections = Record<DashboardSection, boolean>

/** Renders the dashboard cards selected in `sections`. Shared by the admin
 *  dashboard (all on) and the curated director view. Gamification (leaderboard,
 *  team goal, celebrations) sits at the bottom; operational cards up top. */
export function DashboardSections({ view, sections }: { view: DashboardView; sections: Sections }) {
  const gameRow = sections.leaderboard || sections.teamGoal || sections.celebrations
  const opsRow = sections.staffWatch || sections.packet

  return (
    <div className="space-y-6">
      {sections.kpis && (
        <KpiCards kpis={view.kpis} overtimeStaff={view.overtimeStaff} singleSite={view.singleSite} />
      )}

      {sections.funnel && <EnrollmentFunnelBySite groups={view.funnelBySite} />}

      {opsRow && (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.staffWatch && <StaffWatch rows={view.staff} />}
          {sections.packet && <PacketPanel data={view.packet} />}
        </div>
      )}

      {sections.redFlags && <RedFlags flags={view.flags} />}

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
    </div>
  )
}
