import { useMemo } from 'react'
import { periodPresets, type Period } from '@/lib/period'
import { inputClass } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Preset buttons + a From/To calendar pair for any day or custom period. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts = useMemo(() => periodPresets(), [])
  const activeKey = opts.find((p) => p.start === value.start && p.end === value.end)?.key ?? null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-0.5 rounded-lg bg-[var(--color-secondary)] p-0.5">
        {opts.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange({ start: p.start, end: p.end })}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors',
              activeKey === p.key
                ? 'bg-[var(--color-coral)] text-white shadow-sm'
                : 'text-[var(--color-dk-gray)] hover:text-[var(--color-charcoal)]'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={value.start}
          max={value.end}
          aria-label="From date"
          onChange={(e) => {
            const start = e.target.value
            if (start) onChange({ start, end: value.end < start ? start : value.end })
          }}
          className={cn(inputClass, 'h-9 w-auto')}
        />
        <span className="text-[var(--color-mid-gray)]">–</span>
        <input
          type="date"
          value={value.end}
          min={value.start}
          aria-label="To date"
          onChange={(e) => {
            const end = e.target.value
            if (end) onChange({ start: value.start, end })
          }}
          className={cn(inputClass, 'h-9 w-auto')}
        />
      </div>
    </div>
  )
}
