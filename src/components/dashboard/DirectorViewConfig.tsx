import { useState } from 'react'
import { Eye, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  SECTION_META,
  updateDirectorView,
  type DirectorViewConfig as Config,
} from '@/lib/settings'

/** Admin control: choose which cards directors see on their dashboard. */
export function DirectorViewConfig({ config }: { config: Config }) {
  const [saved, setSaved] = useState(false)

  async function toggle(key: string, on: boolean) {
    await updateDirectorView({ sections: { ...config.sections, [key]: on } })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Card accent="sky">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-5">
        <Eye className="size-4 text-[var(--color-sky-deep)]" />
        <div className="flex-1">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-sky-deep)]">
            Director View
          </h2>
          <p className="text-xs text-[var(--color-dk-gray)]">
            Choose which cards the directors see on their dashboard
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-good)]">
            <Check className="size-3.5" /> Saved
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2">
        {SECTION_META.map(({ key, label, hint }) => {
          const on = config.sections[key]
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--color-charcoal)]">{label}</span>
                <span className="block text-xs text-[var(--color-dk-gray)]">{hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(key, !on)}
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                style={{ background: on ? 'var(--color-good)' : 'var(--color-lt-gray)' }}
              >
                <span
                  className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all"
                  style={{ left: on ? '22px' : '2px' }}
                />
              </button>
            </label>
          )
        })}
      </div>
    </Card>
  )
}
