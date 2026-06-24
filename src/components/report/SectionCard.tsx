import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'

type Accent = 'coral' | 'yellow' | 'sky' | 'gray'

interface SectionCardProps {
  title: string
  accent: Accent
  icon?: ReactNode
  description?: string
  children: ReactNode
}

const accentText: Record<Accent, string> = {
  coral: 'var(--color-coral)',
  yellow: 'var(--color-coral-dark)', // yellow text is illegible; use warm coral-dark
  sky: 'var(--color-sky-deep)',
  gray: 'var(--color-dk-gray)',
}

const accentBg: Record<Accent, string> = {
  coral: 'var(--color-coral)',
  yellow: 'var(--color-yellow)',
  sky: 'var(--color-sky)',
  gray: 'var(--color-mid-gray)',
}

export function SectionCard({ title, accent, icon, description, children }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Card accent={accent}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] p-5">
          {icon && (
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl text-white"
              style={{ backgroundColor: accentBg[accent], color: accent === 'yellow' ? 'var(--color-charcoal)' : 'white' }}
            >
              {icon}
            </span>
          )}
          <div>
            <h2
              className="text-xs font-extrabold uppercase tracking-[0.14em]"
              style={{ color: accentText[accent] }}
            >
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-[var(--color-dk-gray)]">{description}</p>
            )}
          </div>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </motion.div>
  )
}
