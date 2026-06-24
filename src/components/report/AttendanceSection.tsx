import { Users } from 'lucide-react'
import type { Attendance } from '@/lib/schema'
import { totalAttendance } from '@/lib/derive'
import { SectionCard } from './SectionCard'
import { NumberField } from './NumberField'

interface Props {
  value: Attendance
  onChange: (a: Attendance) => void
  disabled: boolean
}

export function AttendanceSection({ value, onChange, disabled }: Props) {
  const total = totalAttendance(value.preschool, value.subsidy)
  return (
    <SectionCard title="Attendance" accent="sky" icon={<Users className="size-4" />}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <NumberField
          label="Pre-School"
          value={value.preschool}
          onChange={(n) => onChange({ ...value, preschool: n })}
          disabled={disabled}
        />
        <NumberField
          label="Subsidy"
          hint="DSS, CCA, Foster, United Way"
          value={value.subsidy}
          onChange={(n) => onChange({ ...value, subsidy: n })}
          disabled={disabled}
        />
        <div className="rounded-xl bg-[var(--color-sky-soft)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-sky-deep)]">
            Total Attendance
          </p>
          <p className="font-brand text-3xl font-medium text-[var(--color-charcoal)]">{total}</p>
        </div>
      </div>
    </SectionCard>
  )
}
