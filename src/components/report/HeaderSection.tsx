import { type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { SITES, DIRECTORS, siteName, type SiteId } from '@/lib/schema'
import { weekdayName } from '@/lib/derive'
import { Input, inputClass } from '@/components/ui/input'
import { SectionCard } from './SectionCard'

interface HeaderSectionProps {
  siteId: SiteId
  date: string
  director: string
  onSite: (s: SiteId) => void
  onDate: (d: string) => void
  onDirector: (name: string) => void
  /** Admins can change site; directors are locked to theirs. */
  canEditSite: boolean
  disabled: boolean
}

export function HeaderSection({
  siteId,
  date,
  director,
  onSite,
  onDate,
  onDirector,
  canEditSite,
  disabled,
}: HeaderSectionProps) {
  return (
    <SectionCard title="Report Details" accent="gray" icon={<CalendarDays className="size-4" />}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Site">
          {canEditSite ? (
            <select
              value={siteId}
              onChange={(e) => onSite(e.target.value as SiteId)}
              disabled={disabled}
              className={inputClass}
            >
              {SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <Input value={siteName(siteId)} disabled readOnly />
          )}
        </Field>

        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} disabled={disabled} />
        </Field>

        <Field label="Day">
          <Input value={weekdayName(date)} disabled readOnly />
        </Field>

        <Field label="Director">
          <Input
            list="director-names"
            value={director}
            onChange={(e) => onDirector(e.target.value)}
            placeholder="Name"
            disabled={disabled}
          />
          <datalist id="director-names">
            {DIRECTORS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
      </div>
    </SectionCard>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
        {label}
      </span>
      {children}
    </label>
  )
}
