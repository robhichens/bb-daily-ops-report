import { useState } from 'react'
import { motion } from 'framer-motion'
import type { CountNote, ItemDetail, ItemFieldDef } from '@/lib/schema'
import { Input, inputClass } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const OTHER = '__other__'

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
  /** When set, the count expands into this many structured item rows. */
  itemFields?: ItemFieldDef[]
}

const MAX_ROWS = 40

function ensureLen(items: ItemDetail[], n: number): ItemDetail[] {
  const out = items.slice(0, n)
  while (out.length < n) out.push({})
  return out
}

const colsClass = (n: number) =>
  n <= 1 ? '' : n === 2 ? 'sm:grid-cols-2' : n === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'

export function CountNoteRow({
  label,
  notesPrompt,
  value,
  onChange,
  goal,
  decimals = false,
  unit,
  disabled = false,
  itemFields,
}: CountNoteRowProps) {
  const hasItems = !!itemFields && itemFields.length > 0
  // Tracks which (row, field) selects are in free-type "Other" mode, keyed `${i}:${key}`.
  const [otherKeys, setOtherKeys] = useState<Set<string>>(new Set())
  const toggleOther = (id: string, on: boolean) =>
    setOtherKeys((prev) => {
      const next = new Set(prev)
      on ? next.add(id) : next.delete(id)
      return next
    })

  const setCount = (raw: string) => {
    if (raw === '') {
      onChange({ ...value, count: 0, items: hasItems ? [] : value.items })
      return
    }
    const n = decimals ? parseFloat(raw) : parseInt(raw, 10)
    if (Number.isNaN(n) || n < 0) return
    onChange({
      ...value,
      count: n,
      items: hasItems ? ensureLen(value.items ?? [], Math.min(n, MAX_ROWS)) : value.items,
    })
  }

  const setItem = (i: number, key: string, v: string) => {
    const items = ensureLen(value.items ?? [], Math.min(value.count, MAX_ROWS))
    items[i] = { ...items[i], [key]: v }
    onChange({ ...value, items })
  }

  const goalMet = goal != null && value.count >= goal
  const rows = hasItems ? Math.min(value.count, MAX_ROWS) : 0

  return (
    <div className="py-3">
      {/* Header: label + goal pill + count */}
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
        <div className="ml-auto flex items-center gap-1.5">
          <Input
            type="number"
            inputMode={decimals ? 'decimal' : 'numeric'}
            min={0}
            step={decimals ? 0.25 : 1}
            value={value.count === 0 ? '' : value.count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="0"
            disabled={disabled}
            className="h-9 w-20 text-center font-semibold"
          />
          {unit && <span className="text-xs text-[var(--color-dk-gray)]">{unit}</span>}
        </div>
      </div>

      {/* Body: structured item rows, or the legacy notes box */}
      {hasItems ? (
        rows > 0 && (
          <div className="mt-2.5 space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary)]/50 p-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--color-coral-soft)] text-[10px] font-bold text-[var(--color-coral-dark)]">
                    {i + 1}
                  </span>
                  {(() => {
                    const item = value.items?.[i] ?? {}
                    const visible = itemFields!.filter(
                      (f) => !f.showWhen || (item[f.showWhen.key] ?? '') === f.showWhen.equals
                    )
                    return (
                      <div className={cn('grid flex-1 gap-2', colsClass(visible.length))}>
                        {visible.map((f) => {
                          const val = item[f.key] ?? ''
                          const id = `${i}:${f.key}`
                          const isOther =
                            !!f.allowOther && (otherKeys.has(id) || (!!val && !f.options?.includes(val)))
                          return (
                            <div key={f.key} className="flex flex-col">
                              {f.type === 'select' ? (
                                <>
                                  <select
                                    value={isOther ? OTHER : val}
                                    disabled={disabled}
                                    onChange={(e) => {
                                      if (e.target.value === OTHER) {
                                        toggleOther(id, true)
                                        setItem(i, f.key, '')
                                      } else {
                                        toggleOther(id, false)
                                        setItem(i, f.key, e.target.value)
                                      }
                                    }}
                                    className={cn(inputClass, 'h-9')}
                                  >
                                    <option value="">Select…</option>
                                    {f.options?.map((o) => (
                                      <option key={o} value={o}>
                                        {o}
                                      </option>
                                    ))}
                                    {f.allowOther && <option value={OTHER}>Other…</option>}
                                  </select>
                                  {isOther && (
                                    <Input
                                      value={val}
                                      disabled={disabled}
                                      onChange={(e) => setItem(i, f.key, e.target.value)}
                                      placeholder="Type it in…"
                                      className="mt-1 h-9"
                                    />
                                  )}
                                </>
                              ) : (
                                <Input
                                  type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
                                  value={val}
                                  disabled={disabled}
                                  onChange={(e) => setItem(i, f.key, e.target.value)}
                                  className="h-9"
                                />
                              )}
                              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-mid-gray)]">
                                {f.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>
            ))}
            {value.count > MAX_ROWS && (
              <p className="text-xs text-[var(--color-dk-gray)]">
                Showing the first {MAX_ROWS} of {value.count}.
              </p>
            )}
          </div>
        )
      ) : (
        <Input
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder={notesPrompt}
          disabled={disabled}
          className="mt-2"
        />
      )}
    </div>
  )
}
