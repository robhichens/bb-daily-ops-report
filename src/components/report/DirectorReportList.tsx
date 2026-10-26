import { AnimatePresence, motion } from 'framer-motion'
import { NotebookPen, Plus, X } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from './SectionCard'
import { Composer, Thread } from './NoteThread'
import type { NoteComment } from '@/lib/schema'

interface Props {
  value: string[]
  onChange: (lines: string[]) => void
  disabled: boolean
  /** Leadership/director conversation on each line, shown right under it. */
  commentsFor?: (line: string) => NoteComment[]
  viewerRole?: 'admin' | 'director'
  /** Present once the report is filed (a comment needs a saved report). */
  onComment?: (line: string, text: string) => Promise<void>
  onDeleteComment?: (c: NoteComment) => void
}

export function DirectorReportList({ value, onChange, disabled, commentsFor, viewerRole = 'director', onComment, onDeleteComment }: Props) {
  const lines = value.length ? value : ['']

  const setLine = (i: number, text: string) => {
    const next = [...lines]
    next[i] = text
    onChange(next)
  }
  const addLine = () => onChange([...lines, ''])
  const removeLine = (i: number) => {
    const next = lines.filter((_, idx) => idx !== i)
    onChange(next.length ? next : [''])
  }

  return (
    <SectionCard
      title="Director Report on the Day"
      accent="coral"
      icon={<NotebookPen className="size-4" />}
      description="Notes, follow-ups, write-ups — one item per line."
    >
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
            >
             <div className="flex items-start gap-2">
              <span className="mt-2.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--color-coral-soft)] text-xs font-bold text-[var(--color-coral-dark)]">
                {i + 1}
              </span>
              <Textarea
                value={line}
                onChange={(e) => setLine(i, e.target.value)}
                placeholder="Add a note…"
                disabled={disabled}
                className="min-h-[44px]"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  title="Remove line"
                  className="mt-2 grid size-7 shrink-0 place-items-center rounded-md text-[var(--color-mid-gray)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-coral)]"
                >
                  <X className="size-4" />
                </button>
              )}
             </div>
             {commentsFor && line.trim() && (() => {
               const thread = commentsFor(line.trim())
               // Leadership can open a thread on any filed note; the poster can reply once there is one.
               const canReply = !!onComment && (viewerRole === 'admin' || thread.length > 0)
               if (thread.length === 0 && !canReply) return null
               return (
                 <div className="mt-2 pl-8">
                   <Thread thread={thread} viewerRole={viewerRole} legacyRole="admin" onDelete={onDeleteComment} />
                   {canReply && (
                     <Composer
                       placeholder={viewerRole === 'admin' ? 'Comment or question for the director…' : 'Reply to leadership…'}
                       submitLabel={viewerRole === 'admin' ? 'Send' : 'Reply'}
                       busy={false}
                       onSend={(text) => onComment!(line.trim(), text)}
                     />
                   )}
                 </div>
               )
             })()}
            </motion.div>
          ))}
        </AnimatePresence>

        {!disabled && (
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--color-coral)] transition-colors hover:bg-[var(--color-coral-soft)]"
          >
            <Plus className="size-4" /> Add line
          </button>
        )}
      </div>
    </SectionCard>
  )
}
