import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Remember a card's collapsed state per device so the dashboard stays how you left it. */
function usePersistentOpen(storageKey: string | undefined, defaultOpen: boolean) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen
    try {
      const v = localStorage.getItem(`bbdor:collapse:${storageKey}`)
      return v === null ? defaultOpen : v === 'open'
    } catch {
      return defaultOpen
    }
  })
  const set = (v: boolean) => {
    setOpen(v)
    if (storageKey) {
      try {
        localStorage.setItem(`bbdor:collapse:${storageKey}`, v ? 'open' : 'closed')
      } catch {
        /* private mode — collapse just won't persist */
      }
    }
  }
  return [open, set] as const
}

/**
 * A dashboard card whose body collapses behind its header. Keeps each card's
 * existing header markup (passed as `header`) and adds a chevron toggle; the
 * whole header bar is the click target. State persists per `storageKey`.
 */
export function CollapsibleCard({
  header,
  children,
  accent = 'gray',
  className,
  storageKey,
  defaultOpen = true,
}: {
  header: ReactNode
  children: ReactNode
  accent?: 'coral' | 'yellow' | 'sky' | 'gray'
  className?: string
  storageKey?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = usePersistentOpen(storageKey, defaultOpen)
  return (
    <Card accent={accent} className={cn('overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 p-5 text-left transition-colors hover:bg-[var(--color-secondary)]/50',
          open && 'border-b border-[var(--color-border)]'
        )}
      >
        {header}
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 text-[var(--color-mid-gray)] transition-transform',
            !open && '-rotate-90'
          )}
        />
      </button>
      {open && children}
    </Card>
  )
}
