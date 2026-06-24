import { Megaphone } from 'lucide-react'
import {
  ENROLLMENT_FIELDS,
  type CountNote,
  type EnrollmentMarketing,
} from '@/lib/schema'
import { SectionCard } from './SectionCard'
import { CountNoteRow } from './CountNoteRow'

interface Props {
  value: EnrollmentMarketing
  onChange: (e: EnrollmentMarketing) => void
  disabled: boolean
}

export function EnrollmentMarketingSection({ value, onChange, disabled }: Props) {
  const setField = (key: keyof EnrollmentMarketing, next: CountNote) =>
    onChange({ ...value, [key]: next })

  return (
    <SectionCard title="Enrollment / Marketing" accent="coral" icon={<Megaphone className="size-4" />}>
      <div className="divide-y divide-[var(--color-border)]">
        {ENROLLMENT_FIELDS.map((f) => (
          <CountNoteRow
            key={f.key}
            label={f.label}
            notesPrompt={f.notesPrompt}
            goal={f.goal}
            value={value[f.key]}
            onChange={(next) => setField(f.key, next)}
            disabled={disabled}
          />
        ))}
      </div>
    </SectionCard>
  )
}
