import { LayoutDashboard, Flame, Trophy, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const previews = [
  { icon: Flame, accent: 'orange' as const, title: 'Streaks', body: 'Daily completion streaks per director, with comeback protection.' },
  { icon: Trophy, accent: 'purple' as const, title: 'Leaderboard', body: 'Friendly weekly ranking on consistency + a shared team goal.' },
  { icon: TriangleAlert, accent: 'navy' as const, title: 'Red flags', body: 'Missed reports, overtime, packet gaps — surfaced for leadership.' },
]

/** Phase 1 placeholder. Live KPIs, charts, leaderboard, and celebrations land in Phases 4–5. */
export function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-purple)] text-white">
          <LayoutDashboard className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">Dashboard</h1>
          <p className="text-sm text-[var(--color-muted-ink)]">
            One place for real-time insights, red flags, and celebrations
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {previews.map(({ icon: Icon, accent, title, body }) => (
          <Card key={title} accent={accent}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--color-muted-ink)]">{body}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
