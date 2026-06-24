import * as React from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-charcoal)] outline-none transition placeholder:text-[var(--color-mid-gray)] focus:border-[var(--color-coral)] focus:ring-2 focus:ring-[var(--color-coral)]/30 disabled:cursor-not-allowed disabled:bg-[var(--color-secondary)] disabled:text-[var(--color-dk-gray)]'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />
  )
)
Input.displayName = 'Input'

export { Input }
