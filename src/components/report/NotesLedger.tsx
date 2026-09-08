import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, Trash2, Send, CornerDownRight, AlertTriangle, Check } from 'lucide-react'
import type { LedgerNote, ReportKey } from '@/lib/schema'
import {
  subscribeOrgNotesBySource, addOrgNote, setOrgNoteAck, setOrgNoteFlag,
  addOrgNoteComment, deleteOrgNote,
} from '@/lib/orgReports'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/** A running Flags & Notes list for one report source. Writes to the central
 *  orgDayNotes ledger (also shown on the main Day Notes board). Red-flagged
 *  notes pin to the top. Used by FDR/ADR/MDR/EDR. */
export function NotesLedger({
  source, author, uid, readOnly = false,
}: { source: ReportKey; author: string; uid: string; readOnly?: boolean }) {
  const [notes, setNotes] = useState<LedgerNote[]>([])
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [text, setText] = useState('')

  useEffect(() => subscribeOrgNotesBySource(source, setNotes), [source])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(key))
    try { await fn() } catch (e) { console.error('Notes save failed', e) }
    finally { setBusy((b) => { const n = new Set(b); n.delete(key); return n }) }
  }

  const sorted = [...notes].sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
    return a.at < b.at ? 1 : -1
  })
  const openCount = notes.filter((n) => !n.acked).length

  async function add() {
    const t = text.trim()
    if (!t) return
    await run('add', () => addOrgNote(source, t, author, uid))
    setText('')
  }

  return (
    <Card accent="gray" className="p-5">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-charcoal)]">
          <Flag className="size-4" /> Flags &amp; Notes
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-dk-gray)]">Running list for leadership · {openCount} open</p>
      </div>

      {!readOnly && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a note for leadership…"
            className="min-h-[44px] flex-1"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void add() }}
          />
          <Button disabled={busy.has('add') || !text.trim()} onClick={() => void add()} className="sm:self-start">
            <Send className="size-4" /> Add
          </Button>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-xl bg-[var(--color-secondary)] px-4 py-6 text-center text-sm text-[var(--color-dk-gray)]">
          No notes yet.
        </p>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {sorted.map((n) => (
              <NoteCard key={n.id} note={n} author={author} readOnly={readOnly} busy={busy} run={run} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </Card>
  )
}

function NoteCard({
  note, author, readOnly, busy, run,
}: {
  note: LedgerNote
  author: string
  readOnly: boolean
  busy: Set<string>
  run: (key: string, fn: () => Promise<void>) => Promise<void>
}) {
  const [reply, setReply] = useState('')
  const [replyOpen, setReplyOpen] = useState(false)

  async function sendReply() {
    const t = reply.trim()
    if (!t) return
    await run(note.id, () =>
      addOrgNoteComment(note.id, note.comments, { text: t, author, at: new Date().toISOString() })
    )
    setReply(''); setReplyOpen(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        note.flagged
          ? 'border-[var(--color-critical)] bg-[var(--color-critical-soft)] ring-1 ring-[var(--color-critical)]/40'
          : cn('border-[var(--color-border)] bg-white', note.acked && 'opacity-60')
      )}
    >
      {note.flagged && (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-critical)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          <AlertTriangle className="size-3" /> High alert
        </p>
      )}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => void run(note.id, () => setOrgNoteAck(note.id, !note.acked))}
          aria-pressed={note.acked}
          aria-label={note.acked ? 'Mark unread' : 'Check off'}
          className={cn(
            'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
            note.acked ? 'border-[var(--color-coral)] bg-[var(--color-coral)] text-white'
              : 'border-[var(--color-mid-gray)] text-transparent hover:border-[var(--color-coral)]'
          )}
        >
          <Check className="size-4" strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('whitespace-pre-wrap text-[15px] leading-snug text-[var(--color-charcoal)]', note.acked && 'line-through')}>
            {note.text}
          </p>
          <p className="mt-1 text-xs text-[var(--color-dk-gray)]">
            {note.author} · {new Date(note.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void run(note.id, () => setOrgNoteFlag(note.id, !note.flagged))}
          title={note.flagged ? 'Remove high alert' : 'Mark high alert'}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg transition-colors',
            note.flagged ? 'bg-[var(--color-critical)] text-white'
              : 'text-[var(--color-mid-gray)] hover:bg-[var(--color-critical-soft)] hover:text-[var(--color-critical)]'
          )}
        >
          <Flag className="size-4" />
        </button>
      </div>

      <div className="mt-3 pl-9">
        {note.comments.length > 0 && (
          <div className="mb-2 space-y-2">
            {note.comments.map((c, i) => (
              <div key={`${c.at}-${i}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-secondary)] px-3.5 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-dk-gray)]">
                  <CornerDownRight className="mr-1 inline size-3" />{c.author}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-charcoal)]">{c.text}</p>
              </div>
            ))}
          </div>
        )}
        {!readOnly && (replyOpen ? (
          <div className="space-y-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Comment…"
              className="min-h-[52px]"
              autoFocus
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void sendReply() }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={busy.has(note.id) || !reply.trim()} onClick={() => void sendReply()}>Send</Button>
              <Button size="sm" variant="ghost" onClick={() => { setReply(''); setReplyOpen(false) }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setReplyOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-coral)] hover:underline">
              <Send className="size-3.5" /> Comment
            </button>
            <button
              type="button"
              onClick={() => void run(note.id, () => deleteOrgNote(note.id))}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-mid-gray)] hover:text-[var(--color-coral)]"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
