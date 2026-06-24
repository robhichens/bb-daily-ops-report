import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[68px] w-full resize-y rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--color-charcoal)] outline-none transition placeholder:text-[var(--color-mid-gray)] focus:border-[var(--color-coral)] focus:ring-2 focus:ring-[var(--color-coral)]/30 disabled:cursor-not-allowed disabled:bg-[var(--color-secondary)] disabled:text-[var(--color-dk-gray)]',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }
