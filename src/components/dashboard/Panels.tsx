import { motion } from 'framer-motion'
import { Filter, UserCog, ClipboardCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { SiteFunnel, StaffWatchRow, PacketCompliance } from '@/lib/dashboard'
import { formatShort } from '@/lib/dates'

function PanelShell({
  title,
  icon,
  accent,
  children,
}: {
  title: string
  icon: React.ReactNode
  accent: 'coral' | 'yellow' | 'sky' | 'gray'
  children: React.ReactNode
}) {
  const color = { coral: 'var(--color-coral)', yellow: 'var(--color-coral-dark)', sky: 'var(--color-sky-deep)', gray: 'var(--color-dk-gray)' }[accent]
  return (
    <Card accent={accent} className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-5">
        <span style={{ color }}>{icon}</span>
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color }}>
          {title}
        </h2>
      </div>
      <div className="flex-1 p-5">{children}</div>
    </Card>
  )
}

const BAR_COLORS = ['var(--color-coral)', 'var(--color-yellow)', 'var(--color-sky)']

/** Full-width Enrollment Pipeline broken out per location (always all sites). */
export function EnrollmentFunnelBySite({ groups }: { groups: SiteFunnel[] }) {
  // Shared max across all sites so the bars are comparable.
  const max = Math.max(1, ...groups.flatMap((g) => g.stages.map((s) => s.value)))
  return (
    <PanelShell title="Enrollment Pipeline" icon={<Filter className="size-4" />} accent="coral">
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-3">
        {groups.map((g, gi) => (
          <div key={g.siteId}>
            <p
              className="mb-2.5 text-xs font-extrabold uppercase tracking-wide"
              style={{ color: BAR_COLORS[gi % 3] }}
            >
              {g.name}
            </p>
            <div className="space-y-2">
              {g.stages.map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[11px] font-semibold text-[var(--color-charcoal)]">
                    {s.label}
                  </span>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-[var(--color-secondary)]">
                    <motion.div
                      className="flex h-full items-center justify-end rounded-lg pr-2 text-[11px] font-bold text-white"
                      style={{ background: 'var(--color-coral)', opacity: 1 - i * 0.13 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(10, (s.value / max) * 100)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.04 }}
                    >
                      {s.value}
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

export function StaffWatch({ rows }: { rows: StaffWatchRow[] }) {
  return (
    <PanelShell title="Staff Watch" icon={<UserCog className="size-4" />} accent="gray">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-[var(--color-secondary)] px-3 py-2.5">
            <p className="font-brand text-2xl font-medium text-[var(--color-charcoal)]">
              {r.value}
              {r.unit && <span className="text-sm text-[var(--color-dk-gray)]"> {r.unit}</span>}
            </p>
            <p className="text-[11px] font-semibold text-[var(--color-dk-gray)]">{r.label}</p>
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

export function PacketPanel({ data }: { data: PacketCompliance }) {
  const good = data.pct >= 80
  return (
    <PanelShell title="Director Packet Compliance" icon={<ClipboardCheck className="size-4" />} accent="sky">
      <div className="flex items-center gap-4">
        <div className="relative grid size-20 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-secondary)" strokeWidth="4" />
            <motion.circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={good ? 'var(--color-good)' : 'var(--color-warning)'}
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15.5}
              initial={{ strokeDashoffset: 2 * Math.PI * 15.5 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 15.5 * (1 - data.pct / 100) }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <span className="absolute font-brand text-lg font-medium text-[var(--color-charcoal)]">{data.pct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-charcoal)]">
            {data.completed}/{data.total} packets completed
          </p>
          {data.misses.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-xs text-[var(--color-dk-gray)]">
              {data.misses.slice(0, 4).map((m, i) => (
                <li key={i} className="truncate">
                  <span className="font-semibold text-[var(--color-coral-dark)]">{m.site} · {formatShort(m.date)}:</span>{' '}
                  {m.reason || 'no reason given'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-good)]">All packets completed 🎉</p>
          )}
        </div>
      </div>
    </PanelShell>
  )
}
