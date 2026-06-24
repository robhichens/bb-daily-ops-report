import { Clock } from 'lucide-react'
import type { Labor } from '@/lib/schema'
import { SectionCard } from './SectionCard'
import { NumberField } from './NumberField'

interface Props {
  value: Labor
  onChange: (l: Labor) => void
  disabled: boolean
}

export function LaborSection({ value, onChange, disabled }: Props) {
  return (
    <SectionCard title="Labor" accent="gray" icon={<Clock className="size-4" />}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NumberField
          label="Total Labor Hours"
          value={value.totalHours}
          onChange={(n) => onChange({ ...value, totalHours: n })}
          decimals
          unit="hrs"
          disabled={disabled}
        />
        <NumberField
          label="Total Overtime Hours"
          hint="Add names in the day report"
          value={value.overtimeHours}
          onChange={(n) => onChange({ ...value, overtimeHours: n })}
          decimals
          unit="hrs"
          disabled={disabled}
        />
        <NumberField
          label="Director Minutes in Rooms"
          hint="Bathroom breaks, Sub, Classroom Management"
          value={value.directorMinutesInRooms}
          onChange={(n) => onChange({ ...value, directorMinutesInRooms: n })}
          unit="min"
          disabled={disabled}
        />
      </div>
    </SectionCard>
  )
}
