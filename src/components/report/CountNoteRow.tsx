import { motion } from 'framer-motion'
import type { CountNote } from '@/lib/schema'
import { Input } from '@/components/ui/input'

interface CountNoteRowProps {
  label: string
  notesPrompt: string
  value: CountNote
  onChange: (next: CountNote) => void
  goal?: number
  /** Allow decimals (e.g. hours). Default integer. */
  decimals?: boolean
  /** Small unit suffix shown by the number, e.g. 'hrs'. */
  unit?: string
  disabled?: boolean
}

export function CountNoteRow({
  label,
  notesPrompt,
  value,
  onChange,
  goal,
  decimals = false,
  unit,
  disabled = false,
}: CountNoteRowProps) {
  const setCount = (raw: string) => {
    if (raw === '') return onChange({ ...value, count: 0 })
    const n = decimals ? parseFloat(raw) : parseInt(raw, 10)
    if (Number.isNaN(n) || n < 0) return
    onChange({ ...value, count: n })
  }

  const goalMet = goal != null && value.count >= goal

  return (
    <div className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold text-[var(--color-charcoal)]">{label}</label>
          {goal != null && (
            <motion.span
              key={goalMet ? 'met' : 'below'}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={
                goalMet
                  ? { background: 'var(--color-good-soft)', color: 'var(--color-good)' }
                  : { background: 'var(--color-yellow-soft)', color: 'var(--color-coral-dark)' }
              }
            >
              {goalMet ? '✓ Goal met' : `${Math.max(0, goal - value.count)} to goal of ${goal}`}
            </motion.span>
          )}
        </div>
        <Input
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder={notesPrompt}
          disabled={disabled}
          className="mt-1.5"
        />
      </div>

      <div className="flex items-center gap-1.5 sm:pt-6">
        <Input
          type="number"
          inputMode={decimals ? 'decimal' : 'numeric'}
          min={0}
          step={decimals ? 0.25 : 1}
          value={value.count === 0 ? '' : value.count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="0"
          disabled={disabled}
          className="w-20 text-center font-semibold sm:w-24"
        />
        {unit && <span className="text-xs text-[var(--color-dk-gray)]">{unit}</span>}
      </div>
    </div>
  )
}
