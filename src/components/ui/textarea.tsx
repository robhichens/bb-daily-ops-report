import * as React from 'react'
import { cn } from '@/lib/utils'

/** Grow a textarea to fit its text (on every value change and when its width
 *  changes, e.g. a phone rotating), so long entries wrap and stay readable
 *  instead of scrolling sideways out of view. */
function useAutoGrow(forwarded: React.ForwardedRef<HTMLTextAreaElement>, value: unknown) {
  const inner = React.useRef<HTMLTextAreaElement | null>(null)

  const fit = React.useCallback(() => {
    const el = inner.current
    if (!el) return
    el.style.height = 'auto'
    // + border so the last line isn't clipped
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
  }, [])

  React.useLayoutEffect(fit, [value, fit])

  React.useEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastWidth = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth
        fit()
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  return React.useCallback(
    (el: HTMLTextAreaElement | null) => {
      inner.current = el
      if (typeof forwarded === 'function') forwarded(el)
      else if (forwarded) forwarded.current = el
    },
    [forwarded]
  )
}

const baseClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-charcoal)] outline-none transition placeholder:text-[var(--color-mid-gray)] focus:border-[var(--color-coral)] focus:ring-2 focus:ring-[var(--color-coral)]/30 disabled:cursor-not-allowed disabled:bg-[var(--color-secondary)] disabled:text-[var(--color-dk-gray)]'

/** Multi-line box (notes, reasons). Starts a few lines tall and grows with the text. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, value, ...props }, ref) => {
    const setRef = useAutoGrow(ref, value)
    return (
      <textarea
        ref={setRef}
        value={value}
        className={cn(baseClass, 'min-h-[68px] resize-none overflow-hidden py-2 leading-relaxed', className)}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

/** Looks like a one-line text box, but wraps and grows as the entry gets longer.
 *  Use for free text; keep <Input> for numbers, dates and suggestion lists. */
const TextField = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, value, rows = 1, ...props }, ref) => {
    const setRef = useAutoGrow(ref, value)
    return (
      <textarea
        ref={setRef}
        rows={rows}
        value={value}
        className={cn(baseClass, 'block min-h-11 resize-none overflow-hidden py-2.5 leading-snug', className)}
        {...props}
      />
    )
  }
)
TextField.displayName = 'TextField'

export { Textarea, TextField }
