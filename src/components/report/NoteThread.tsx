import { useState } from 'react'
import { CornerDownRight, Flag, Send, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatStamp } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/** One message in a note's thread (a Day Notes comment, DDR or org-report note). */
export interface ThreadMessage {
  text: string
  author: string
  at: string // ISO — shown as a date/time stamp on every message
  role?: 'admin' | 'director' // 'admin' = leadership; anything else reads as the poster's side
}

/** The conversation under a note: who said what, and exactly when. Admin messages
 *  carry an "Admin" tag so every admin can tell leadership replies at a glance. */
export function Thread<T extends ThreadMessage>({
  thread,
  viewerRole,
  onDelete,
  className,
  legacyRole,
}: {
  thread: T[]
  /** Which side the viewer is on; their own side's messages get a delete button. */
  viewerRole: 'admin' | 'director'
  onDelete?: (c: T) => void
  className?: string
  /** Role to assume for messages saved before roles existed (DDR threads: 'admin'). */
  legacyRole?: 'admin' | 'director'
}) {
  if (thread.length === 0) return null
  return (
    <div className={cn('mb-3 space-y-2', className)}>
      {thread.map((c, i) => {
        const role = c.role ?? legacyRole
        const fromAdmin = role === 'admin'
        const mine = onDelete && role === viewerRole
        return (
          <div
            key={`${c.at}-${i}`}
            className={cn(
              'group rounded-xl border px-3.5 py-2.5',
              fromAdmin
                ? 'border-[var(--color-good)]/30 bg-[var(--color-good-soft)]'
                : 'border-[var(--color-border)] bg-[var(--color-secondary)]'
            )}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p
                className={cn(
                  'text-[11px] font-bold uppercase tracking-wide',
                  fromAdmin ? 'text-[var(--color-good)]' : 'text-[var(--color-dk-gray)]'
                )}
              >
                {fromAdmin ? <Flag className="mr-1 inline size-3" /> : <CornerDownRight className="mr-1 inline size-3" />}
                {c.author}
                {fromAdmin && <span className="ml-1.5 rounded-full bg-white/70 px-1.5 py-px text-[10px] normal-case tracking-normal">Admin</span>}
              </p>
              {c.at && (
                <time dateTime={c.at} className="text-[11px] font-medium text-[var(--color-mid-gray)]">
                  {formatStamp(c.at)}
                </time>
              )}
              {mine && (
                <button
                  type="button"
                  onClick={() => onDelete(c)}
                  title="Delete your message"
                  className="ml-auto text-[var(--color-mid-gray)] opacity-0 transition-opacity hover:text-[var(--color-coral)] focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-charcoal)]">{c.text}</p>
          </div>
        )
      })}
    </div>
  )
}

/** "Reply" / "Add comment / question" — collapsed to a link until opened. */
export function Composer({
  placeholder,
  submitLabel,
  busy,
  onSend,
}: {
  placeholder: string
  submitLabel: string
  busy: boolean
  onSend: (text: string) => Promise<void> | void
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  async function send() {
    const t = text.trim()
    if (!t) return
    await onSend(t)
    setText('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-coral)] hover:underline"
      >
        <Send className="size-3.5" /> {submitLabel === 'Reply' ? 'Reply' : 'Add comment / question'}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="min-h-[60px]"
        autoFocus
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void send()
        }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => void send()}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setText(''); setOpen(false) }}>
          Cancel
        </Button>
        <span className="ml-auto text-[11px] text-[var(--color-mid-gray)]">⌘/Ctrl + Enter</span>
      </div>
    </div>
  )
}
