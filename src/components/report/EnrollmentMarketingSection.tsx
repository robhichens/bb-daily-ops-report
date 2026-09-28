import { Megaphone } from 'lucide-react'
import {
  ENROLLMENT_FIELDS,
  type CountNote,
  type EnrollmentMarketing,
} from '@/lib/schema'
import { SectionCard } from './SectionCard'
import { CountNoteRow } from './CountNoteRow'
import { CopyPrevious } from './CopyPrevious'

interface Props {
  value: EnrollmentMarketing
  onChange: (e: EnrollmentMarketing) => void
  disabled: boolean
  /** Pull Full-Time Enrollment forward from this school's last report. */
  onCopyFullTime?: () => Promise<string>
}

export function EnrollmentMarketingSection({ value, onChange, disabled, onCopyFullTime }: Props) {
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
            itemFields={f.itemFields}
            countOnly={f.countOnly}
            required={f.required}
            value={value[f.key]}
            onChange={(next) => setField(f.key, next)}
            disabled={disabled}
            action={
              f.key === 'fullTimeEnrollment' && onCopyFullTime && !disabled
                ? <CopyPrevious onCopy={onCopyFullTime} />
                : undefined
            }
          />
        ))}
      </div>
    </SectionCard>
  )
}
