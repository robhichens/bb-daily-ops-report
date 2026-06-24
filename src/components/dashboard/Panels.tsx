import { motion } from 'framer-motion'
import { BarChart3, Filter, UserCog, ClipboardCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { SiteBar, FunnelStage, StaffWatchRow, PacketCompliance } from '@/lib/dashboard'
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

export function AttendanceBySite({ bars }: { bars: SiteBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <PanelShell title="Attendance by Site" icon={<BarChart3 className="size-4" />} accent="sky">
      <div className="space-y-3">
        {bars.map((b, i) => (
          <div key={b.siteId}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-semibold text-[var(--color-charcoal)]">{b.name}</span>
              <span className="font-bold text-[var(--color-dk-gray)]">{b.value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--color-secondary)]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: BAR_COLORS[i % 3] }}
                initial={{ width: 0 }}
                animate={{ width: `${(b.value / max) * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

export function EnrollmentFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value))
  return (
    <PanelShell title="Enrollment Pipeline" icon={<Filter className="size-4" />} accent="coral">
      <div className="space-y-2.5">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-semibold text-[var(--color-charcoal)]">{s.label}</span>
            <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[var(--color-secondary)]">
              <motion.div
                className="flex h-full items-center justify-end rounded-lg pr-2 text-xs font-bold text-white"
                style={{ background: 'var(--color-coral)', opacity: 1 - i * 0.13 }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(8, (s.value / max) * 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
              >
                {s.value}
              </motion.div>
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
