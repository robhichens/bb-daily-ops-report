import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Clock, CalendarCheck, DollarSign, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { Kpis, OvertimeStaffRow } from '@/lib/dashboard'
import { CountUp } from './CountUp'

export function KpiCards({
  kpis,
  overtimeStaff,
  singleSite,
}: {
  kpis: Kpis
  overtimeStaff: OvertimeStaffRow[]
  singleSite: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi
        accent="sky"
        icon={<Users className="size-4" />}
        label="Avg Daily Attendance"
        value={<CountUp value={kpis.avgAttendance} />}
      />

      <OvertimeCard kpis={kpis} staff={overtimeStaff} canFlip={singleSite} />

      <Kpi
        accent="sky"
        icon={<CalendarCheck className="size-4" />}
        label="Tours Scheduled Today"
        value={<CountUp value={kpis.toursScheduledToday} />}
        sub={
          <span style={{ color: 'var(--color-dk-gray)' }}>
            {kpis.toursScheduledWeek} this week
          </span>
        }
      />

      <Kpi
        accent="coral"
        icon={<DollarSign className="size-4" />}
        label="Reg Fees Paid"
        value={<CountUp value={kpis.regFeesPaid} />}
        sub={
          <span style={{ color: 'var(--color-good)' }}>
            ${kpis.regFeesRevenue.toLocaleString()} collected
          </span>
        }
      />
    </div>
  )
}

/** Overtime KPI. In single-location view, click to flip and reveal the staff + hours. */
function OvertimeCard({
  kpis,
  staff,
  canFlip,
}: {
  kpis: Kpis
  staff: OvertimeStaffRow[]
  canFlip: boolean
}) {
  const [flipped, setFlipped] = useState(false)
  const accent = kpis.overtimeFlag ? 'var(--color-coral)' : 'var(--color-dk-gray)'
  const flippable = canFlip && staff.length > 0

  const sub = (
    <span style={{ color: kpis.overtimeFlag ? 'var(--color-critical)' : 'var(--color-dk-gray)' }}>
      {kpis.overtimePct}% of labor{kpis.overtimeFlag ? ' · over 5%' : ''}
    </span>
  )

  if (!flippable) {
    return (
      <Kpi
        accent={kpis.overtimeFlag ? 'coral' : 'gray'}
        icon={<Clock className="size-4" />}
        label="Overtime"
        value={<CountUp value={kpis.overtimeHours} decimals={1} suffix=" hrs" />}
        sub={sub}
      />
    )
  }

  return (
    <div style={{ perspective: 1000 }} className="relative">
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative h-full"
      >
        {/* Front */}
        <button
          type="button"
          onClick={() => setFlipped(true)}
          style={{ backfaceVisibility: 'hidden' }}
          className="block w-full text-left"
        >
          <Card accent={kpis.overtimeFlag ? 'coral' : 'gray'} className="cursor-pointer p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-2 text-[var(--color-dk-gray)]">
              <Clock className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Overtime</span>
            </div>
            <p className="mt-2 font-brand text-3xl font-medium text-[var(--color-charcoal)]">
              <CountUp value={kpis.overtimeHours} decimals={1} suffix=" hrs" />
            </p>
            <p className="mt-0.5 text-xs font-semibold">{sub}</p>
            <p className="mt-1 text-[11px] font-semibold" style={{ color: accent }}>
              Tap to see staff →
            </p>
          </Card>
        </button>

        {/* Back */}
        <div
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          className="absolute inset-0"
        >
          <Card accent={kpis.overtimeFlag ? 'coral' : 'gray'} className="flex h-full flex-col p-4">
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="mb-1.5 flex items-center gap-1.5 text-[var(--color-dk-gray)]"
            >
              <RotateCcw className="size-3.5" />
              <span className="text-xs font-bold uppercase tracking-wide">OT by staff</span>
            </button>
            <ul className="flex-1 space-y-1 overflow-y-auto text-sm">
              {staff.map((s, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[var(--color-charcoal)]">{s.name}</span>
                  <span className="shrink-0 font-bold" style={{ color: accent }}>
                    {s.hours} hrs
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </motion.div>
    </div>
  )
}

function Kpi({
  accent,
  icon,
  label,
  value,
  sub,
}: {
  accent: 'coral' | 'yellow' | 'sky' | 'gray'
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <Card accent={accent} className="p-4">
      <div className="flex items-center gap-2 text-[var(--color-dk-gray)]">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-brand text-3xl font-medium text-[var(--color-charcoal)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold">{sub}</p>}
    </Card>
  )
}
