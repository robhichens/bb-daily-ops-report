import { useState } from 'react'

/** Remember a dashboard card/section's collapsed state per device so the
 *  dashboard stays how you left it. No key = not remembered. */
export function usePersistentOpen(storageKey: string | undefined, defaultOpen: boolean) {
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
