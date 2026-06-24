import { motion } from 'framer-motion'
import { Flame, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { siteName } from '@/lib/schema'
import type { LeaderboardRow, Badge } from '@/lib/gamification'

const medal = ['🥇', '🥈', '🥉']

export function Leaderboard({
  rows,
  badgesBySite,
  mostImproved,
}: {
  rows: LeaderboardRow[]
  badgesBySite: Record<string, Badge[]>
  mostImproved: { site: string; delta: number } | null
}) {
  const top = rows[0]
  return (
    <Card accent="yellow" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-5">
        <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-yellow)] text-[var(--color-charcoal)]">
          <Trophy className="size-4" />
        </span>
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-coral-dark)]">
            Weekly Leaderboard
          </h2>
          <p className="text-xs text-[var(--color-dk-gray)]">
            Ranked by consistency — showing up & filing thoroughly
          </p>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {rows.map((row, i) => (
          <motion.div
            key={row.siteId}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 px-5 py-3.5"
            style={i === 0 ? { background: 'var(--color-yellow-soft)' } : undefined}
          >
            <span className="w-7 text-center text-lg">{medal[i] ?? row.rank}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-bold text-[var(--color-charcoal)]">{siteName(row.siteId)}</p>
                {row.streak > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[var(--color-coral)]">
                    <Flame className="size-3.5" />
                    {row.streak}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {(badgesBySite[row.siteId] ?? []).map((b) => (
                  <span
                    key={b.id}
                    title={b.description}
                    className="rounded-full bg-[var(--color-secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-dk-gray)]"
                  >
                    {b.emoji} {b.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-brand text-xl font-medium text-[var(--color-charcoal)]">{row.consistency}</p>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-mid-gray)]">
                {row.filed}/{row.expected} days · {row.points} pts
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-cream)] px-5 py-3 text-xs">
        {top && top.filed > 0 ? (
          <span className="font-semibold text-[var(--color-charcoal)]">
            🏆 Top of the week: <span className="text-[var(--color-coral)]">{siteName(top.siteId)}</span>
          </span>
        ) : (
          <span className="text-[var(--color-dk-gray)]">No reports filed yet this week</span>
        )}
        {mostImproved && (
          <span className="font-semibold text-[var(--color-charcoal)]">
            📈 Most improved: <span className="text-[var(--color-sky-deep)]">{mostImproved.site}</span> (+{mostImproved.delta})
          </span>
        )}
      </div>
    </Card>
  )
}
