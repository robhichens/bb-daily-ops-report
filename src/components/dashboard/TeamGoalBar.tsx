import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import type { TeamGoal } from '@/lib/gamification'

export function TeamGoalBar({ goal }: { goal: TeamGoal }) {
  return (
    <Card accent={goal.met ? 'sky' : 'yellow'} className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-dk-gray)]">
            Team Goal
          </p>
          <p className="text-sm font-semibold text-[var(--color-charcoal)]">{goal.label}</p>
        </div>
        <span
          className="shrink-0 text-sm font-extrabold"
          style={{ color: goal.met ? 'var(--color-good)' : 'var(--color-coral-dark)' }}
        >
          {goal.met ? '🎉 Done!' : `${goal.current}/${goal.target}`}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--color-secondary)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: goal.met ? 'var(--color-good)' : 'var(--color-yellow)' }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(goal.pct * 100)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </Card>
  )
}
