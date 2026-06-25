import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Plus, X } from 'lucide-react'
import type { Labor, OvertimeEntry } from '@/lib/schema'
import { totalOvertime } from '@/lib/derive'
import { SectionCard } from './SectionCard'
import { NumberField } from './NumberField'
import { Input } from '@/components/ui/input'

interface Props {
  value: Labor
  onChange: (l: Labor) => void
  disabled: boolean
}

export function LaborSection({ value, onChange, disabled }: Props) {
  const entries = value.overtimeEntries ?? []
  const otTotal = totalOvertime(entries)

  const setEntry = (i: number, patch: Partial<OvertimeEntry>) =>
    onChange({ ...value, overtimeEntries: entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) })
  const addEntry = () => onChange({ ...value, overtimeEntries: [...entries, { name: '', hours: 0 }] })
  const removeEntry = (i: number) =>
    onChange({ ...value, overtimeEntries: entries.filter((_, idx) => idx !== i) })
  const setHours = (i: number, raw: string) => {
    if (raw === '') return setEntry(i, { hours: 0 })
    const n = parseFloat(raw)
    if (Number.isNaN(n) || n < 0) return
    setEntry(i, { hours: n })
  }

  return (
    <SectionCard title="Labor" accent="gray" icon={<Clock className="size-4" />}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <NumberField
          label="Total Labor Hours"
          value={value.totalHours}
          onChange={(n) => onChange({ ...value, totalHours: n })}
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
        <div className="rounded-xl bg-[var(--color-secondary)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
            Total Overtime Hours
          </p>
          <p className="font-brand text-3xl font-medium text-[var(--color-charcoal)]">
            {otTotal}
            <span className="text-base text-[var(--color-dk-gray)]"> hrs</span>
          </p>
          <p className="text-[11px] text-[var(--color-mid-gray)]">Auto-summed from staff below</p>
        </div>
      </div>

      {/* Overtime by staff */}
      <div className="mt-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--color-charcoal)]">Overtime by staff</h3>
          <span className="text-xs text-[var(--color-dk-gray)]">One row per staff member with OT</span>
        </div>

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {entries.map((e, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-start gap-2"
              >
                <div className="flex flex-1 flex-col">
                  <Input
                    value={e.name}
                    onChange={(ev) => setEntry(i, { name: ev.target.value })}
                    placeholder="Staff name"
                    disabled={disabled}
                    className="h-9"
                  />
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-mid-gray)]">
                    Staff name
                  </span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.25}
                      value={e.hours === 0 ? '' : e.hours}
                      onChange={(ev) => setHours(i, ev.target.value)}
                      placeholder="0"
                      disabled={disabled}
                      className="h-9 w-20 text-center font-semibold"
                    />
                    <span className="text-xs text-[var(--color-dk-gray)]">hrs</span>
                  </div>
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-mid-gray)]">
                    OT hours
                  </span>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeEntry(i)}
                    title="Remove"
                    className="mt-1 grid size-7 shrink-0 place-items-center rounded-md text-[var(--color-mid-gray)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-coral)]"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {entries.length === 0 && (
            <p className="text-xs text-[var(--color-mid-gray)]">No overtime logged.</p>
          )}

          {!disabled && (
            <button
              type="button"
              onClick={addEntry}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--color-coral)] transition-colors hover:bg-[var(--color-coral-soft)]"
            >
              <Plus className="size-4" /> Add staff overtime
            </button>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
