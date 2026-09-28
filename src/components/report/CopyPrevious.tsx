import { useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** "Copy from last report" — pulls a number (or a school's grid) forward from
 *  the most recent earlier report. `onCopy` does the work and returns what to
 *  tell the person ("Copied from Sep 25", "Nothing earlier to copy"). */
export function CopyPrevious({
  onCopy,
  disabled,
  label = 'Copy from last report',
  className,
}: {
  onCopy: () => Promise<string>
  disabled?: boolean
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setNote(null)
    try {
      setNote(await onCopy())
    } catch {
      setNote('Couldn’t reach the last report. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <button
        type="button"
        onClick={() => void run()}
        disabled={disabled || busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-sky-deep)] transition-colors hover:bg-[var(--color-sky-soft)] disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <History className="size-3.5" />}
        {label}
      </button>
      {note && <span className="text-xs text-[var(--color-dk-gray)]">{note}</span>}
    </span>
  )
}
