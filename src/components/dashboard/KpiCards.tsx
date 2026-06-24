import { Users, Clock, Megaphone, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { Kpis } from '@/lib/dashboard'
import { CountUp } from './CountUp'

export function KpiCards({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi
        accent="sky"
        icon={<Users className="size-4" />}
        label="Avg Daily Attendance"
        value={<CountUp value={kpis.avgAttendance} />}
      />
      <Kpi
        accent={kpis.overtimeFlag ? 'coral' : 'gray'}
        icon={<Clock className="size-4" />}
        label="Overtime"
        value={<CountUp value={kpis.overtimeHours} decimals={1} suffix=" hrs" />}
        sub={
          <span style={{ color: kpis.overtimeFlag ? 'var(--color-critical)' : 'var(--color-dk-gray)' }}>
            {kpis.overtimePct}% of labor{kpis.overtimeFlag ? ' · over 5%' : ''}
          </span>
        }
      />
      <Kpi
        accent={kpis.commsMet ? 'sky' : 'yellow'}
        icon={<Megaphone className="size-4" />}
        label="Enrollment Comms"
        value={<CountUp value={kpis.commsOut} />}
        sub={
          <span style={{ color: kpis.commsMet ? 'var(--color-good)' : 'var(--color-coral-dark)' }}>
            goal {kpis.commsGoal}{kpis.commsMet ? ' · met ✓' : ''}
          </span>
        }
      />
      <Kpi
        accent="coral"
        icon={<TrendingUp className="size-4" />}
        label="Net New Starts"
        value={
          <span>
            {kpis.netNewStarts > 0 ? '+' : ''}
            <CountUp value={kpis.netNewStarts} />
          </span>
        }
      />
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
