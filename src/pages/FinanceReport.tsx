import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Wallet, DollarSign, Check, Lock, Pencil, Loader2, CloudOff,
  Flag, Trash2, Send, CornerDownRight, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin } from '@/lib/users'
import {
  MONEY_IN_SITES, moneyInTotal, emptyFinanceReport,
  type FinanceReport as TFinanceReport, type FinanceValue, type FinanceNote,
} from '@/lib/schema'
import {
  getFinanceReport, upsertFinanceDraft, submitFinanceReport,
  subscribeFinanceNotes, addFinanceNote, setFinanceNoteAck, setFinanceNoteFlag,
  addFinanceNoteComment, deleteFinanceNote,
} from '@/lib/finance'
import { todayIso, formatLong } from '@/lib/dates'
import { weekdayName } from '@/lib/derive'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const money = (n: number) => `$${(n || 0).toLocaleString()}`

export function FinanceReport() {
  const { user, profile } = useAuth()
  const [date, setDate] = useState(todayIso())
  const author = profile?.displayName || user?.email || 'Finance'

  if (!isAdmin(profile?.role)) return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-sky-deep)] text-white">
          <Wallet className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">Finance Report</h1>
          <p className="text-sm text-[var(--color-dk-gray)]">{formatLong(date)} · org-wide</p>
        </div>
      </div>

      <FinanceForm date={date} onDate={setDate} uid={user?.uid ?? ''} author={author} />
      <FinanceNotes author={author} uid={user?.uid ?? ''} />
    </div>
  )
}

// ===========================================================================
// The daily number form
// ===========================================================================

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function FinanceForm({
  date, onDate, uid, author,
}: { date: string; onDate: (d: string) => void; uid: string; author: string }) {
  const [draft, setDraft] = useState<TFinanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [editing, setEditing] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEditing(false)
    setSaveState('idle')
    ;(async () => {
      let remote: TFinanceReport | null = null
      try { remote = await getFinanceReport(date) } catch { /* offline */ }
      if (!cancelled) {
        setDraft(remote ?? emptyFinanceReport(date, uid))
        setLoading(false)
      }
    })()
    return () => { cancelled = true; if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [date, uid])

  const locked = !!draft && draft.status === 'submitted' && !editing

  const update = useCallback((patch: Partial<TFinanceReport>) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch, completedBy: prev.completedBy || author }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(async () => {
        try { await upsertFinanceDraft(next); setSaveState('saved') }
        catch { setSaveState('error') }
      }, 700)
      return next
    })
  }, [author])

  async function handleSubmit() {
    if (!draft) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      await submitFinanceReport({ ...draft, completedBy: draft.completedBy || author }, uid)
      setDraft((p) => (p ? { ...p, status: 'submitted', submittedAt: new Date().toISOString() } : p))
      setEditing(false)
      setSaveState('idle')
    } catch { setSaveState('error') }
  }

  if (loading || !draft) {
    return (
      <div className="grid place-items-center py-16">
        <img src="/brand/bb-tree.png" alt="" className="size-10 animate-pulse object-contain" />
      </div>
    )
  }

  const submitted = draft.status === 'submitted'
  const total = moneyInTotal(draft.moneyIn)

  return (
    <div className="space-y-5">
      {/* Date + status */}
      <Card accent="gray" className="flex flex-wrap items-end justify-between gap-4 p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">Date</span>
          <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="w-auto" />
          <span className="text-xs text-[var(--color-mid-gray)]">{weekdayName(date)}</span>
        </label>
        {submitted && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-good)]">
              <Check className="size-4" /> Filed
              {locked && <span className="ml-1 inline-flex items-center gap-1 text-[var(--color-dk-gray)]"><Lock className="size-3.5" /> read-only</span>}
            </span>
            {locked && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* 1 · Money In */}
      <Card accent="coral" className="p-5">
        <SectionTitle icon={<DollarSign className="size-4" />} title="Money In" hint="Collected today, per location" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {MONEY_IN_SITES.map((s) => (
            <DollarField
              key={s.key}
              label={s.label}
              value={draft.moneyIn[s.key]}
              disabled={locked}
              onChange={(n) => update({ moneyIn: { ...draft.moneyIn, [s.key]: n } })}
            />
          ))}
          <div className="rounded-xl bg-[var(--color-secondary)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">Total</p>
            <p className="font-brand text-2xl font-medium text-[var(--color-charcoal)]">{money(total)}</p>
            <p className="text-[11px] text-[var(--color-mid-gray)]">Auto-summed</p>
          </div>
        </div>
        <NoteLine value={draft.moneyIn.note} disabled={locked} onChange={(note) => update({ moneyIn: { ...draft.moneyIn, note } })} />
      </Card>

      {/* 2 · Collections */}
      <Card accent="yellow" className="p-5">
        <SectionTitle title="Collections" hint="Late fees, returned/declined payments, AR outstanding" />
        <ValueFields value={draft.collections} disabled={locked} onChange={(collections) => update({ collections })} />
      </Card>

      {/* 3 · DSS / Subsidy */}
      <Card accent="sky" className="p-5">
        <SectionTitle title="DSS / Subsidy" hint="Payments posted ($) and missed check-ins (#)" />
        <ValueFields value={draft.dss} disabled={locked} onChange={(dss) => update({ dss })} />
      </Card>

      {!locked && (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-cream)]/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <SaveIndicator state={saveState} />
          <Button onClick={() => void handleSubmit()} className="min-w-32">
            {submitted ? 'Re-file' : 'File report'}
          </Button>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-charcoal)]">
        {icon}{title}
      </h2>
      <p className="mt-0.5 text-xs text-[var(--color-dk-gray)]">{hint}</p>
    </div>
  )
}

function num(raw: string): number | null {
  if (raw === '') return 0
  const n = parseFloat(raw)
  return Number.isNaN(n) || n < 0 ? null : n
}

function DollarField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-mid-gray)]">$</span>
        <Input
          type="number" inputMode="decimal" min={0} step="0.01"
          value={value === 0 ? '' : value}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => { const n = num(e.target.value); if (n !== null) onChange(n) }}
          className="h-10 pl-6 font-semibold"
        />
      </div>
    </label>
  )
}

function ValueFields({ value, disabled, onChange }: { value: FinanceValue; disabled: boolean; onChange: (v: FinanceValue) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <DollarField label="Amount" value={value.amount} disabled={disabled} onChange={(amount) => onChange({ ...value, amount })} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">Count</span>
          <Input
            type="number" inputMode="numeric" min={0} step="1"
            value={value.count === 0 ? '' : value.count}
            placeholder="0"
            disabled={disabled}
            onChange={(e) => { const n = num(e.target.value); if (n !== null) onChange({ ...value, count: n }) }}
            className="h-10 font-semibold"
          />
        </label>
      </div>
      <NoteLine value={value.note} disabled={disabled} onChange={(note) => onChange({ ...value, note })} />
    </div>
  )
}

function NoteLine({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (s: string) => void }) {
  return (
    <label className="mt-3 flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">Note</span>
      <Input value={value} disabled={disabled} placeholder="Any detail worth flagging…" onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    idle: { icon: null, text: 'Autosaves as you type', cls: 'text-[var(--color-mid-gray)]' },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…', cls: 'text-[var(--color-dk-gray)]' },
    saved: { icon: <Check className="size-3.5" />, text: 'Draft saved', cls: 'text-[var(--color-good)]' },
    error: { icon: <CloudOff className="size-3.5" />, text: 'Save failed — retry', cls: 'text-[var(--color-coral-dark)]' },
  }[state]
  return <span className={cn('flex items-center gap-1.5 text-xs font-semibold', map.cls)}>{map.icon}{map.text}</span>
}

// ===========================================================================
// Flags & Notes — running list (Day-Notes style) with a red flag
// ===========================================================================

function FinanceNotes({ author, uid }: { author: string; uid: string }) {
  const [notes, setNotes] = useState<FinanceNote[]>([])
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [text, setText] = useState('')

  useEffect(() => subscribeFinanceNotes(setNotes), [])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(key))
    try { await fn() } catch (e) { console.error('Finance note save failed', e) }
    finally { setBusy((b) => { const n = new Set(b); n.delete(key); return n }) }
  }

  // Red-flagged float to the top; otherwise newest first.
  const sorted = [...notes].sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
    return a.at < b.at ? 1 : -1
  })
  const openCount = notes.filter((n) => !n.acked).length

  async function add() {
    const t = text.trim()
    if (!t) return
    await run('add', () => addFinanceNote(t, author, uid))
    setText('')
  }

  return (
    <Card accent="gray" className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-charcoal)]">
            <Flag className="size-4" /> Flags &amp; Notes
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-dk-gray)]">
            Running list for KP &amp; Molly · {openCount} open
          </p>
        </div>
      </div>

      {/* Composer */}
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

      {sorted.length === 0 ? (
        <p className="rounded-xl bg-[var(--color-secondary)] px-4 py-6 text-center text-sm text-[var(--color-dk-gray)]">
          No notes yet. Anything KP or Molly should see goes here.
        </p>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {sorted.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                author={author}
                busy={busy}
                run={run}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </Card>
  )
}

function NoteCard({
  note, author, busy, run,
}: {
  note: FinanceNote
  author: string
  busy: Set<string>
  run: (key: string, fn: () => Promise<void>) => Promise<void>
}) {
  const [reply, setReply] = useState('')
  const [replyOpen, setReplyOpen] = useState(false)

  async function sendReply() {
    const t = reply.trim()
    if (!t) return
    await run(note.id, () =>
      addFinanceNoteComment(note.id, note.comments, { text: t, author, at: new Date().toISOString() })
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
        {/* read check-off */}
        <button
          type="button"
          onClick={() => void run(note.id, () => setFinanceNoteAck(note.id, !note.acked))}
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
            {note.author} · {new Date(note.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>

        {/* red flag toggle */}
        <button
          type="button"
          onClick={() => void run(note.id, () => setFinanceNoteFlag(note.id, !note.flagged))}
          title={note.flagged ? 'Remove high alert' : 'Mark high alert'}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg transition-colors',
            note.flagged
              ? 'bg-[var(--color-critical)] text-white'
              : 'text-[var(--color-mid-gray)] hover:bg-[var(--color-critical-soft)] hover:text-[var(--color-critical)]'
          )}
        >
          <Flag className="size-4" />
        </button>
      </div>

      {/* thread */}
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
        {replyOpen ? (
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
              onClick={() => void run(note.id, () => deleteFinanceNote(note.id))}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-mid-gray)] hover:text-[var(--color-coral)]"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
