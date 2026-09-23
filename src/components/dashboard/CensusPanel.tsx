import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { EnrollmentCensus, SiteCensus, Withdrawal } from '@/lib/dashboard'
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

/** The dashboard's headline: full-time enrollment vs capacity, per-site, plus
 *  who withdrew and why. */
export function CensusPanel({ census, withdrawals }: { census: EnrollmentCensus; withdrawals: Withdrawal[] }) {
  return (
    <div className="space-y-4">
      <Card accent="coral" className="flex flex-wrap items-center gap-6 p-6">
        <div className="min-w-[200px] flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-dk-gray)]">Full-time enrollment</p>
          <div className="mt-1 flex items-end gap-3">
            <span className="text-6xl font-extrabold leading-none text-[var(--color-charcoal)]">{census.total}</span>
            <span className="pb-2"><Delta n={census.delta} /></span>
          </div>
          <p className="mt-2 text-sm text-[var(--color-dk-gray)]">of {census.capacity} licensed spots · {census.open} open</p>
        </div>
        <div className="w-full sm:w-[320px]">
          <div className="flex justify-between text-sm font-semibold text-[var(--color-charcoal)]">
            <span>Capacity filled</span><span>{census.pct}%</span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-[var(--color-secondary)]">
            <div className="h-full rounded-full bg-[var(--color-coral)]" style={{ width: `${Math.min(100, census.pct)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-[var(--color-mid-gray)]">
            <span>{census.total} enrolled</span><span>{census.open} open</span>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          {census.bySite.map((s) => <SiteCard key={s.siteId} s={s} />)}
        </div>
        <WithdrawalsCard items={withdrawals} />
      </div>
    </div>
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
        <span className="pb-1 text-sm text-[var(--color-mid-gray)]">/ {s.capacity}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-secondary)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.pct)}%`, background: SITE_BAR[s.siteId] }} />
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-mid-gray)]">{s.pct}% full · {s.open} open</p>
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
