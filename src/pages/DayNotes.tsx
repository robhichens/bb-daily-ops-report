import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, Check, Send, Eye, Flag, ArrowUpRight, Trash2, CornerDownRight } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin, userSites } from '@/lib/users'
import { SITES, siteName, type SiteId, type DailyOpsReport, type NoteComment } from '@/lib/schema'
import { formatLong } from '@/lib/dates'
import {
  subscribeRecentReports,
  setNoteAck,
  addNoteComment,
  removeNoteComment,
} from '@/lib/reports'
import { markDayNotesSeen } from '@/lib/dayNotesRead'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'director'

/** Left-border accent per school, so each site reads at a glance. */
const SITE_ACCENT: Record<SiteId, 'coral' | 'yellow' | 'sky' | 'gray'> = {
  crozet: 'coral',
  'forest-lakes': 'sky',
  'mill-creek': 'yellow',
}

/** One Director-Report line, flattened out of its report + its Day-Notes state. */
interface NoteEntry {
  reportId: string
  siteId: SiteId
  siteName: string
  director: string
  date: string
  note: string
  acked: boolean
  thread: NoteComment[]
  allComments: NoteComment[] // the whole report's comments (for array rewrites)
}

const noteKey = (e: { reportId: string; note: string }) => `${e.reportId}::${e.note}`
const reportHref = (siteId: SiteId, date: string) => `/report?site=${siteId}&date=${date}`
const commentRole = (c: NoteComment): Role => c.role ?? 'admin'
const lastFromAdmin = (t: NoteComment[]) => t.length > 0 && commentRole(t[t.length - 1]) === 'admin'
const lastFromDirector = (t: NoteComment[]) => t.length > 0 && commentRole(t[t.length - 1]) === 'director'

/** Flatten every report's non-empty Director-Report lines into dated entries. */
function toEntries(reports: DailyOpsReport[]): NoteEntry[] {
  const out: NoteEntry[] = []
  for (const r of reports) {
    const acks = r.acknowledgedNotes ?? []
    const comments = r.noteComments ?? []
    for (const raw of r.directorReport ?? []) {
      const note = raw.trim()
      if (!note) continue
      out.push({
        reportId: r.id,
        siteId: r.siteId,
        siteName: r.siteName || siteName(r.siteId),
        director: r.director,
        date: r.date,
        note,
        acked: acks.includes(note),
        thread: comments
          .filter((c) => c.note === note)
          .sort((a, b) => (a.at < b.at ? -1 : 1)),
        allComments: comments,
      })
    }
  }
  return out
}

/** Group entries by date, newest first; `pinFirst` floats matching notes up. */
function groupByDate(entries: NoteEntry[], pinFirst?: (e: NoteEntry) => boolean) {
  const byDate = new Map<string, NoteEntry[]>()
  for (const e of entries) {
    const list = byDate.get(e.date) ?? []
    list.push(e)
    byDate.set(e.date, list)
  }
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      entries: list.sort((a, b) => {
        if (pinFirst && pinFirst(a) !== pinFirst(b)) return pinFirst(a) ? -1 : 1
        return a.siteName.localeCompare(b.siteName)
      }),
    }))
}

// ===========================================================================
// Route entry — picks the admin feed or the director mirror, marks as seen.
// ===========================================================================

export function DayNotes() {
  const { user, profile } = useAuth()
  const [reports, setReports] = useState<DailyOpsReport[]>([])
  useEffect(() => subscribeRecentReports(300, setReports), [])

  // Opening the tab clears the "you have replies" nudge; re-mark as new
  // messages arrive while it's open, so it stays caught-up.
  useEffect(() => {
    if (user?.uid) markDayNotesSeen(user.uid)
  }, [user?.uid, reports])

  return isAdmin(profile?.role) ? (
    <AdminDayNotes reports={reports} />
  ) : (
    <DirectorDayNotes reports={reports} />
  )
}

// ===========================================================================
// Admin (Rob): cross-school triage — check off, comment, see replies.
// ===========================================================================

function AdminDayNotes({ reports }: { reports: DailyOpsReport[] }) {
  const { user, profile } = useAuth()
  const author = profile?.displayName || user?.email || 'Leadership'

  const [site, setSite] = useState<SiteId | 'all'>('all')
  const [hideAcked, setHideAcked] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const allEntries = useMemo(() => toEntries(reports), [reports])
  const openCount = allEntries.filter((e) => !e.acked).length

  const visible = useMemo(
    () => allEntries.filter((e) => (site === 'all' || e.siteId === site) && (!hideAcked || !e.acked)),
    [allEntries, site, hideAcked]
  )
  // Notes where the director replied last float up — the ball's in Rob's court.
  const groups = useMemo(() => groupByDate(visible, (e) => lastFromDirector(e.thread)), [visible])

  const runBusy = useBusy(setBusy)

  return (
    <div className="space-y-6">
      <FeedHeader
        title="Day Notes"
        subtitle={
          <>
            What directors flagged for you — across every school.{' '}
            <span className="font-semibold text-[var(--color-charcoal)]">{openCount} open</span>
          </>
        }
      >
        <SiteFilter sites={SITES} value={site} onChange={setSite} allLabel="All" />
        <HideCheckedToggle checked={hideAcked} onChange={setHideAcked} />
      </FeedHeader>

      {groups.length === 0 ? (
        <EmptyCard>
          {allEntries.length === 0
            ? 'No director notes have come in yet. They’ll show up here as reports are submitted.'
            : hideAcked
              ? 'All caught up — every note is checked off. 🎉'
              : 'No notes for this school yet.'}
        </EmptyCard>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <DateSection key={g.date} date={g.date}>
              {g.entries.map((e) => {
                const key = noteKey(e)
                return (
                  <Card
                    key={key}
                    accent={SITE_ACCENT[e.siteId]}
                    className={cn('p-4 transition-opacity', e.acked && 'opacity-60')}
                  >
                    <div className="flex items-start gap-3">
                      <CheckButton
                        checked={e.acked}
                        busy={busy.has(key)}
                        onClick={() => runBusy(key, () => setNoteAck(e.reportId, e.note, !e.acked))}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-[15px] leading-snug text-[var(--color-charcoal)]',
                            e.acked && 'text-[var(--color-dk-gray)] line-through'
                          )}
                        >
                          {e.note}
                        </p>
                        <NoteMeta entry={e} />
                      </div>
                      {lastFromDirector(e.thread) && (
                        <Badge tone="coral" icon={<CornerDownRight className="size-3" />}>Replied</Badge>
                      )}
                    </div>

                    <div className="mt-3 pl-9">
                      <Thread thread={e.thread} viewerRole="admin" onDelete={(c) =>
                        runBusy(key, () => removeNoteComment(e.reportId, e.allComments, c))} />
                      <Composer
                        placeholder="Comment or question for the director…"
                        submitLabel="Send"
                        busy={busy.has(key)}
                        onSend={(text) =>
                          runBusy(key, () =>
                            addNoteComment(e.reportId, e.allComments, {
                              note: e.note,
                              text,
                              author,
                              at: new Date().toISOString(),
                              role: 'admin',
                            })
                          )
                        }
                      />
                    </div>
                  </Card>
                )
              })}
            </DateSection>
          ))}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// Director: their own notes — seen status, leadership replies, reply back.
// ===========================================================================

function DirectorDayNotes({ reports }: { reports: DailyOpsReport[] }) {
  const { user, profile } = useAuth()
  const author = profile?.displayName || user?.email || 'Director'
  const mySites = userSites(profile)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const allEntries = useMemo(
    () => toEntries(reports).filter((e) => mySites.includes(e.siteId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports, mySites.join()]
  )
  // "Needs attention" = leadership posted the last message → your turn.
  const needsCount = allEntries.filter((e) => lastFromAdmin(e.thread)).length

  const visible = useMemo(
    () => allEntries.filter((e) => !attentionOnly || lastFromAdmin(e.thread)),
    [allEntries, attentionOnly]
  )
  const groups = useMemo(() => groupByDate(visible, (e) => lastFromAdmin(e.thread)), [visible])

  const runBusy = useBusy(setBusy)

  return (
    <div className="space-y-6">
      <FeedHeader
        title="My Day Notes"
        subtitle={
          needsCount > 0 ? (
            <span className="font-semibold text-[var(--color-coral-dark)]">
              {needsCount} {needsCount === 1 ? 'note needs' : 'notes need'} your reply
            </span>
          ) : (
            'Your notes to leadership — replies show up here.'
          )
        }
      >
        {needsCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-charcoal)]">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
              className="size-4 accent-[var(--color-coral)]"
            />
            Needs reply only
          </label>
        )}
      </FeedHeader>

      {groups.length === 0 ? (
        <EmptyCard>
          {allEntries.length === 0
            ? 'The notes you add to your Daily Ops Report will show up here, along with anything leadership sends back.'
            : 'Nothing needs your reply right now. 🎉'}
        </EmptyCard>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <DateSection key={g.date} date={g.date}>
              {g.entries.map((e) => {
                const key = noteKey(e)
                const flagged = lastFromAdmin(e.thread)
                return (
                  <Card
                    key={key}
                    accent={flagged ? 'coral' : 'gray'}
                    className={cn('p-4', flagged && 'ring-1 ring-[var(--color-coral)]/30')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[15px] leading-snug text-[var(--color-charcoal)]">
                        {e.note}
                      </p>
                      {flagged ? (
                        <Badge tone="coral" icon={<Flag className="size-3" />}>Your turn</Badge>
                      ) : e.thread.length > 0 ? (
                        <Badge tone="gray">Replied</Badge>
                      ) : e.acked ? (
                        <Badge tone="good" icon={<Eye className="size-3" />}>Seen</Badge>
                      ) : (
                        <Badge tone="gray">Awaiting review</Badge>
                      )}
                    </div>

                    <NoteMeta entry={e} showDirector={mySites.length > 1} />

                    {(e.thread.length > 0 || flagged) && (
                      <div className="mt-3">
                        <Thread thread={e.thread} viewerRole="director" onDelete={(c) =>
                          runBusy(key, () => removeNoteComment(e.reportId, e.allComments, c))} />
                        <Composer
                          placeholder="Reply to leadership…"
                          submitLabel="Reply"
                          busy={busy.has(key)}
                          onSend={(text) =>
                            runBusy(key, () =>
                              addNoteComment(e.reportId, e.allComments, {
                                note: e.note,
                                text,
                                author,
                                at: new Date().toISOString(),
                                role: 'director',
                              })
                            )
                          }
                        />
                      </div>
                    )}
                  </Card>
                )
              })}
            </DateSection>
          ))}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// Shared bits
// ===========================================================================

/** Wrap an async action with a per-key busy flag + error logging. */
function useBusy(setBusy: React.Dispatch<React.SetStateAction<Set<string>>>) {
  return async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(key))
    try {
      await fn()
    } catch (err) {
      console.error('Day Notes save failed', err)
    } finally {
      setBusy((b) => {
        const next = new Set(b)
        next.delete(key)
        return next
      })
    }
  }
}

function Thread({
  thread,
  viewerRole,
  onDelete,
}: {
  thread: NoteComment[]
  viewerRole: Role
  onDelete: (c: NoteComment) => void
}) {
  if (thread.length === 0) return null
  return (
    <div className="mb-3 space-y-2">
      {thread.map((c, i) => {
        const fromAdmin = commentRole(c) === 'admin'
        const mine = commentRole(c) === viewerRole
        return (
          <div
            key={`${c.at}-${i}`}
            className={cn(
              'group rounded-xl border px-3.5 py-2.5',
              fromAdmin
                ? 'border-[var(--color-coral)]/25 bg-[var(--color-coral-soft)]'
                : 'border-[var(--color-border)] bg-[var(--color-secondary)]'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  'text-[11px] font-bold uppercase tracking-wide',
                  fromAdmin ? 'text-[var(--color-coral-dark)]' : 'text-[var(--color-dk-gray)]'
                )}
              >
                {fromAdmin ? <Flag className="mr-1 inline size-3" /> : <CornerDownRight className="mr-1 inline size-3" />}
                {c.author}
              </p>
              {mine && (
                <button
                  type="button"
                  onClick={() => onDelete(c)}
                  title="Delete your message"
                  className="text-[var(--color-mid-gray)] opacity-0 transition-opacity hover:text-[var(--color-coral)] group-hover:opacity-100"
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

function Composer({
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

function Badge({
  tone,
  icon,
  children,
}: {
  tone: 'coral' | 'good' | 'gray'
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const cls = {
    coral: 'bg-[var(--color-coral-soft)] text-[var(--color-coral-dark)]',
    good: 'bg-[var(--color-good-soft)] text-[var(--color-good)]',
    gray: 'bg-[var(--color-secondary)] text-[var(--color-dk-gray)]',
  }[tone]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide', cls)}>
      {icon}
      {children}
    </span>
  )
}

function FeedHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-charcoal)] text-white">
          <NotebookPen className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">{title}</h1>
          <p className="text-sm text-[var(--color-dk-gray)]">{subtitle}</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

function SiteFilter({
  sites,
  value,
  onChange,
  allLabel,
}: {
  sites: { id: SiteId; name: string }[]
  value: SiteId | 'all'
  onChange: (v: SiteId | 'all') => void
  allLabel: string
}) {
  return (
    <div className="flex rounded-lg bg-[var(--color-secondary)] p-0.5">
      <Chip label={allLabel} active={value === 'all'} onClick={() => onChange('all')} />
      {sites.map((s) => (
        <Chip key={s.id} label={s.name} active={value === s.id} onClick={() => onChange(s.id)} />
      ))}
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
        active ? 'bg-[var(--color-coral)] text-white shadow-sm' : 'text-[var(--color-dk-gray)] hover:text-[var(--color-charcoal)]'
      )}
    >
      {label}
    </button>
  )
}

function HideCheckedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-charcoal)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--color-coral)]"
      />
      Hide checked
    </label>
  )
}

function CheckButton({ checked, busy, onClick }: { checked: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={checked}
      aria-label={checked ? 'Mark as open' : 'Check off'}
      className={cn(
        'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
        checked
          ? 'border-[var(--color-coral)] bg-[var(--color-coral)] text-white'
          : 'border-[var(--color-mid-gray)] text-transparent hover:border-[var(--color-coral)]',
        busy && 'opacity-50'
      )}
    >
      <Check className="size-4" strokeWidth={3} />
    </button>
  )
}

function NoteMeta({ entry, showDirector = true }: { entry: NoteEntry; showDirector?: boolean }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-dk-gray)]">
      <span>
        <span className="font-semibold text-[var(--color-charcoal)]">{entry.siteName}</span>
        {showDirector && entry.director && <span> · {entry.director}</span>}
      </span>
      <span aria-hidden>·</span>
      <Link
        to={reportHref(entry.siteId, entry.date)}
        className="inline-flex items-center gap-0.5 font-semibold text-[var(--color-coral)] hover:underline"
      >
        Open full report <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}

function DateSection({ date, children }: { date: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="sticky top-16 z-10 -mx-1 bg-[var(--color-cream)]/90 px-1 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)] backdrop-blur">
        {formatLong(date)}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <Card accent="sky" className="p-8 text-center">
      <p className="text-sm text-[var(--color-dk-gray)]">{children}</p>
    </Card>
  )
}
