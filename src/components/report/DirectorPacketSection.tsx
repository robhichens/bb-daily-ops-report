import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardCheck } from 'lucide-react'
import type { DirectorPacket } from '@/lib/schema'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from './SectionCard'

interface Props {
  value: DirectorPacket
  onChange: (p: DirectorPacket) => void
  disabled: boolean
}

export function DirectorPacketSection({ value, onChange, disabled }: Props) {
  return (
    <SectionCard title="Director Packet" accent="sky" icon={<ClipboardCheck className="size-4" />}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[var(--color-charcoal)]">
            Director Packet completed today?
          </span>
          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-white p-0.5">
            {[
              { label: 'Yes', val: true },
              { label: 'No', val: false },
            ].map((opt) => {
              const active = value.completed === opt.val
              return (
                <button
                  key={opt.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, completed: opt.val })}
                  className="rounded-md px-5 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed"
                  style={
                    active
                      ? opt.val
                        ? { background: 'var(--color-good)', color: 'white' }
                        : { background: 'var(--color-coral)', color: 'white' }
                      : { color: 'var(--color-dk-gray)' }
                  }
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!value.completed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <label className="flex flex-col gap-1.5 pt-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
                  What didn’t get completed, and what got in the way?
                </span>
                <Textarea
                  value={value.incompleteReason}
                  onChange={(e) => onChange({ ...value, incompleteReason: e.target.value })}
                  placeholder="Required when marked “No”"
                  disabled={disabled}
                />
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SectionCard>
  )
}
