import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, Check, MessageSquarePlus, Eye, Flag, ArrowUpRight } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin, userSites } from '@/lib/users'
import { SITES, siteName, type SiteId, type DailyOpsReport, type NoteComment } from '@/lib/schema'
import { formatLong } from '@/lib/dates'
import { subscribeRecentReports, setNoteAck, setNoteComment } from '@/lib/reports'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

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
  comment?: NoteComment
}

const noteKey = (e: { reportId: string; note: string }) => `${e.reportId}::${e.note}`
const reportHref = (siteId: SiteId, date: string) => `/report?site=${siteId}&date=${date}`

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
        comment: comments.find((c) => c.note === note),
      })
    }
  }
  return out
}

/** Group entries by date, newest first; `pinFlagged` floats commented notes up. */
function groupByDate(entries: NoteEntry[], pinFlagged = false) {
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
        if (pinFlagged && !!a.comment !== !!b.comment) return a.comment ? -1 : 1
        return a.siteName.localeCompare(b.siteName)
      }),
    }))
}

// ===========================================================================
// Route entry — picks the admin feed or the director mirror.
// ===========================================================================

export function DayNotes() {
  const { profile } = useAuth()
  const [reports, setReports] = useState<DailyOpsReport[]>([])
  useEffect(() => subscribeRecentReports(300, setReports), [])

  return isAdmin(profile?.role) ? (
    <AdminDayNotes reports={reports} />
  ) : (
    <DirectorDayNotes reports={reports} />
  )
}

// ===========================================================================
// Admin (Rob): cross-school triage — check off + comment on any note.
// ===========================================================================

function AdminDayNotes({ reports }: { reports: DailyOpsReport[] }) {
  const { user, profile } = useAuth()
  const author = profile?.displayName || user?.email || 'Leadership'

  const [site, setSite] = useState<SiteId | 'all'>('all')
  const [hideAcked, setHideAcked] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  // Current comments per report, so setNoteComment can rewrite without a re-read.
  const commentsByReport = useMemo(() => {
    const m = new Map<string, NoteComment[]>()
    for (const r of reports) m.set(r.id, r.noteComments ?? [])
    return m
  }, [reports])

  const allEntries = useMemo(() => toEntries(reports), [reports])
  const openCount = allEntries.filter((e) => !e.acked).length

  const visible = useMemo(
    () => allEntries.filter((e) => (site === 'all' || e.siteId === site) && (!hideAcked || !e.acked)),
    [allEntries, site, hideAcked]
  )
  const groups = useMemo(() => groupByDate(visible), [visible])

  async function withBusy(key: string, fn: () => Promise<void>) {
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

  const toggleAck = (e: NoteEntry) =>
    withBusy(noteKey(e), () => setNoteAck(e.reportId, e.note, !e.acked))

  async function saveComment(e: NoteEntry) {
    await withBusy(noteKey(e), () =>
      setNoteComment(e.reportId, commentsByReport.get(e.reportId), e.note, draft, author)
    )
    setEditing(null)
    setDraft('')
  }

  function startEdit(e: NoteEntry) {
    setEditing(noteKey(e))
    setDraft(e.comment?.text ?? '')
  }

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
                        onClick={() => toggleAck(e)}
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
                    </div>

                    {/* Comment: existing bubble, editor, or add affordance. */}
                    <div className="mt-3 pl-9">
                      {editing === key ? (
                        <div className="space-y-2">
                          <Textarea
                            value={draft}
                            onChange={(ev) => setDraft(ev.target.value)}
                            placeholder="Comment or question for the director…"
                            className="min-h-[60px]"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" disabled={busy.has(key)} onClick={() => saveComment(e)}>
                              {e.comment ? 'Update' : 'Send'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDraft('') }}>
                              Cancel
                            </Button>
                            {e.comment && (
                              <button
                                type="button"
                                onClick={() => { setDraft(''); void saveComment(e) }}
                                className="ml-auto text-xs font-semibold text-[var(--color-coral-dark)] hover:underline"
                              >
                                Clear comment
                              </button>
                            )}
                          </div>
                        </div>
                      ) : e.comment ? (
                        <button
                          type="button"
                          onClick={() => startEdit(e)}
                          className="block w-full text-left"
                          title="Edit comment"
                        >
                          <CommentBubble comment={e.comment} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(e)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-coral)] hover:underline"
                        >
                          <MessageSquarePlus className="size-4" /> Add comment / question
                        </button>
                      )}
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
// Director: their own notes — see if Rob's seen it + read flagged questions.
// ===========================================================================

function DirectorDayNotes({ reports }: { reports: DailyOpsReport[] }) {
  const { profile } = useAuth()
  const mySites = userSites(profile)
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  const allEntries = useMemo(
    () => toEntries(reports).filter((e) => mySites.includes(e.siteId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports, mySites.join()]
  )
  const flaggedCount = allEntries.filter((e) => e.comment).length

  const visible = useMemo(
    () => allEntries.filter((e) => !flaggedOnly || e.comment),
    [allEntries, flaggedOnly]
  )
  const groups = useMemo(() => groupByDate(visible, true), [visible])

  return (
    <div className="space-y-6">
      <FeedHeader
        title="My Day Notes"
        subtitle={
          flaggedCount > 0 ? (
            <span className="font-semibold text-[var(--color-coral-dark)]">
              {flaggedCount} {flaggedCount === 1 ? 'note needs' : 'notes need'} your attention
            </span>
          ) : (
            'Your notes to leadership — and whether they’ve been seen.'
          )
        }
      >
        {flaggedCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-charcoal)]">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
              className="size-4 accent-[var(--color-coral)]"
            />
            Needs attention only
          </label>
        )}
      </FeedHeader>

      {groups.length === 0 ? (
        <EmptyCard>
          {allEntries.length === 0
            ? 'The notes you add to your Daily Ops Report will show up here, along with anything leadership sends back.'
            : 'Nothing flagged right now. 🎉'}
        </EmptyCard>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <DateSection key={g.date} date={g.date}>
              {g.entries.map((e) => (
                <Card
                  key={noteKey(e)}
                  accent={e.comment ? 'coral' : 'gray'}
                  className={cn('p-4', e.comment && 'ring-1 ring-[var(--color-coral)]/30')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-[15px] leading-snug text-[var(--color-charcoal)]">
                      {e.note}
                    </p>
                    {e.comment ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-coral-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-coral-dark)]">
                        <Flag className="size-3" /> Reply
                      </span>
                    ) : e.acked ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-good-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-good)]">
                        <Eye className="size-3" /> Seen
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-secondary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-dk-gray)]">
                        Awaiting review
                      </span>
                    )}
                  </div>

                  {e.comment && (
                    <div className="mt-3">
                      <CommentBubble comment={e.comment} />
                    </div>
                  )}

                  <NoteMeta entry={e} showDirector={mySites.length > 1} />
                </Card>
              ))}
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

function CommentBubble({ comment }: { comment: NoteComment }) {
  return (
    <div className="rounded-xl border border-[var(--color-coral)]/25 bg-[var(--color-coral-soft)] px-3.5 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-coral-dark)]">
        <Flag className="mr-1 inline size-3" />
        {comment.author}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-charcoal)]">{comment.text}</p>
    </div>
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
