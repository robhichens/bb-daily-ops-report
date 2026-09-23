import { useState } from 'react'
import { ArrowUpRight, ArrowDownRight, DoorOpen } from 'lucide-react'
import type { EnrollmentCensus, SiteCensus, Withdrawal, OpeningsToStaff, RoomOpening } from '@/lib/dashboard'
import type { SiteId } from '@/lib/schema'
import { formatShort } from '@/lib/dates'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Bar color per campus, matching the Day Notes / brand site accents. */
const SITE_BAR: Record<SiteId, string> = {
  crozet: 'var(--color-coral)',
  'forest-lakes': 'var(--color-sky-deep)',
  'mill-creek': 'var(--color-yellow)',
}

function Delta({ n }: { n: number }) {
  if (!n) return null
  const up = n > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold',
        up ? 'bg-[var(--color-good-soft)] text-[var(--color-good)]' : 'bg-[var(--color-critical-soft)] text-[var(--color-critical)]'
      )}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {up ? '+' : ''}{n} this week
    </span>
  )
}

/** The dashboard's headline: where we have room to place children right now
 *  (ratio-adjusted openings), then current enrollment per campus and who left. */
export function CensusPanel({
  census,
  withdrawals,
  openings,
}: {
  census: EnrollmentCensus
  withdrawals: Withdrawal[]
  openings: OpeningsToStaff
}) {
  return (
    <div className="space-y-4">
      <OpeningsHero openings={openings} />

      <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          {census.bySite.map((s) => <SiteCard key={s.siteId} s={s} />)}
        </div>
        <WithdrawalsCard items={withdrawals} />
      </div>
    </div>
  )
}

function OpeningsHero({ openings }: { openings: OpeningsToStaff }) {
  const [showAll, setShowAll] = useState(false)
  const positive = openings.rooms.filter((r) => r.open > 0)
  const shown = showAll ? openings.rooms : positive.slice(0, 5)
  const canToggle = openings.rooms.length > shown.length || (showAll && openings.rooms.length > positive.slice(0, 5).length)

  return (
    <Card accent="coral" className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-dk-gray)]">
            <DoorOpen className="size-3.5" /> Openings to staff · placeable spots
          </p>
          <div className="mt-1 flex items-end gap-3">
            <span className="text-5xl font-extrabold leading-none text-[var(--color-charcoal)]">{openings.totalOpen}</span>
            <span className="pb-1.5 text-sm text-[var(--color-dk-gray)]">spots open right now</span>
          </div>
          <p className="mt-2 text-xs text-[var(--color-mid-gray)]">
            Ratio-adjusted for today’s staffing — not licensed capacity{openings.asOfDate && ` · from the ADR ${formatShort(openings.asOfDate)}`}
          </p>
        </div>
        {canToggle && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-coral)] transition-colors hover:bg-[var(--color-secondary)]"
          >
            {showAll ? 'Show top rooms' : `Read more · all ${openings.rooms.length} rooms`}
          </button>
        )}
      </div>

      {openings.rooms.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-dk-gray)]">Openings appear here once Admissions logs the Openings to Staff grid on the ADR.</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-dk-gray)]">No open spots right now — every logged room is at or over ratio. Use “Read more” to see them.</p>
      ) : (
        <ol className="mt-3">
          {shown.map((r, i) => <RoomRow key={`${r.siteId}-${r.room}`} r={r} rank={i + 1} />)}
        </ol>
      )}
    </Card>
  )
}

function RoomRow({ r, rank }: { r: RoomOpening; rank: number }) {
  const badge =
    r.open > 0
      ? { cls: 'bg-[var(--color-good-soft)] text-[var(--color-good)]', text: `+${r.open} open` }
      : r.open < 0
        ? { cls: 'bg-[var(--color-critical-soft)] text-[var(--color-critical)]', text: `${r.open} over ratio` }
        : { cls: 'bg-[var(--color-secondary)] text-[var(--color-dk-gray)]', text: 'full' }
  return (
    <li className="flex items-center gap-3 border-t border-[var(--color-border)] py-2.5 first:border-t-0">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--color-secondary)] text-xs font-bold text-[var(--color-dk-gray)]">{rank}</span>
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-[var(--color-charcoal)]">{r.room}</span>
        <span className="text-xs text-[var(--color-dk-gray)]"> · {r.site} · {r.ageGroup}</span>
      </div>
      <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold', badge.cls)}>{badge.text}</span>
    </li>
  )
}

function SiteCard({ s }: { s: SiteCensus }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-[var(--color-charcoal)]">{s.name}</span>
        <Delta n={s.delta} />
      </div>
      <div className="mt-2 flex items-end gap-1.5">
        <span className="text-3xl font-extrabold leading-none text-[var(--color-charcoal)]">{s.enrolled}</span>
        <span className="pb-1 text-sm text-[var(--color-mid-gray)]">/ {s.capacity} enrolled</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-secondary)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.pct)}%`, background: SITE_BAR[s.siteId] }} />
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-mid-gray)]">{s.pct}% full · {s.open} under licensed cap</p>
    </Card>
  )
}

function WithdrawalsCard({ items }: { items: Withdrawal[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-critical)]">Withdrawals — who &amp; why</p>
        <span className="shrink-0 text-xs text-[var(--color-mid-gray)]">{items.length} shown</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-dk-gray)]">No withdrawals logged for this view. They appear here as directors log terminations with a reason.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--color-border)]">
          {items.slice(0, 8).map((w, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[var(--color-charcoal)]">{w.name}</div>
                <div className="truncate text-xs text-[var(--color-dk-gray)]">
                  {[w.site, w.room, w.date && `last day ${formatShort(w.date)}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              {w.reason && (
                <span className="shrink-0 rounded-full bg-[var(--color-critical-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-coral-dark)]">
                  {w.reason}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
