import { motion } from 'framer-motion'
import { PartyPopper, TriangleAlert } from 'lucide-react'
import { CollapsibleCard } from './CollapsibleCard'
import type { Flag } from '@/lib/dashboard'

export function RedFlags({ flags }: { flags: Flag[] }) {
  return (
    <CollapsibleCard
      accent="coral"
      storageKey="redFlags"
      className="flex flex-col"
      header={
        <>
          <TriangleAlert className="size-4 text-[var(--color-critical)]" />
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-critical)]">
            Red Flags
          </h2>
          {flags.length > 0 && (
            <span className="ml-auto rounded-full bg-[var(--color-critical-soft)] px-2 py-0.5 text-xs font-bold text-[var(--color-critical)]">
              {flags.length}
            </span>
          )}
        </>
      }
    >
      <div className="flex-1 p-5">
        {flags.length === 0 ? (
          <p className="text-sm text-[var(--color-good)]">All clear — nothing needs attention. ✅</p>
        ) : (
          <ul className="space-y-2">
            {flags.map((f, i) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-2 rounded-lg bg-[var(--color-critical-soft)] px-3 py-2 text-sm text-[var(--color-charcoal)]"
              >
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[var(--color-critical)]" />
                {f.text}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </CollapsibleCard>
  )
}

export function Celebrations({ items }: { items: Flag[] }) {
  return (
    <CollapsibleCard
      accent="sky"
      storageKey="celebrations"
      className="flex flex-col"
      header={
        <>
          <PartyPopper className="size-4 text-[var(--color-sky-deep)]" />
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-sky-deep)]">
            Celebrations
          </h2>
        </>
      }
    >
      <div className="flex-1 p-5">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--color-dk-gray)]">Wins will show up here as reports roll in.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((c, i) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-2 rounded-lg bg-[var(--color-sky-soft)] px-3 py-2 text-sm text-[var(--color-charcoal)]"
              >
                {c.text}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </CollapsibleCard>
  )
}
