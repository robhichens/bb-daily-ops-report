import { Input } from '@/components/ui/input'

interface NumberFieldProps {
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  decimals?: boolean
  unit?: string
  disabled?: boolean
}

export function NumberField({ label, hint, value, onChange, decimals = false, unit, disabled }: NumberFieldProps) {
  const set = (raw: string) => {
    if (raw === '') return onChange(0)
    const n = decimals ? parseFloat(raw) : parseInt(raw, 10)
    if (Number.isNaN(n) || n < 0) return
    onChange(n)
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-[var(--color-charcoal)]">{label}</span>
      {hint && <span className="-mt-1 text-xs text-[var(--color-dk-gray)]">{hint}</span>}
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode={decimals ? 'decimal' : 'numeric'}
          min={0}
          step={decimals ? 0.01 : 1}
          value={value === 0 ? '' : value}
          onChange={(e) => set(e.target.value)}
          placeholder="0"
          disabled={disabled}
          className="font-semibold"
        />
        {unit && <span className="shrink-0 text-xs text-[var(--color-dk-gray)]">{unit}</span>}
      </div>
    </label>
  )
}
