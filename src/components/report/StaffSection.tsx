import { UserCog } from 'lucide-react'
import { STAFF_FIELDS, type CountNote, type Staff } from '@/lib/schema'
import { SectionCard } from './SectionCard'
import { CountNoteRow } from './CountNoteRow'

interface Props {
  value: Staff
  onChange: (s: Staff) => void
  disabled: boolean
}

export function StaffSection({ value, onChange, disabled }: Props) {
  const setField = (key: keyof Staff, next: CountNote) => onChange({ ...value, [key]: next })

  return (
    <SectionCard title="Staff" accent="gray" icon={<UserCog className="size-4" />}>
      <div className="divide-y divide-[var(--color-border)]">
        {STAFF_FIELDS.map((f) => {
          // FLAG-2: "Time Spent Recruiting" is HOURS, not a count.
          const isHours = f.key === 'timeSpentRecruiting'
          return (
            <CountNoteRow
              key={f.key}
              label={isHours ? 'Time Spent Recruiting' : f.label}
              notesPrompt={f.notesPrompt}
              value={value[f.key]}
              onChange={(next) => setField(f.key, next)}
              decimals={isHours}
              unit={isHours ? 'hrs' : undefined}
              disabled={disabled}
            />
          )
        })}
      </div>
    </SectionCard>
  )
}
