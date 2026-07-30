import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { NotebookPen, Check } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin } from '@/lib/users'
import { SITES, siteName, type SiteId, type DailyOpsReport } from '@/lib/schema'
import { formatLong } from '@/lib/dates'
import { subscribeRecentReports, setNoteAck } from '@/lib/reports'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Left-border accent per school, so each site reads at a glance. */
const SITE_ACCENT: Record<SiteId, 'coral' | 'yellow' | 'sky' | 'gray'> = {
  crozet: 'coral',
  'forest-lakes': 'sky',
  'mill-creek': 'yellow',
}

/** One Director-Report line, flattened out of its report. */
interface NoteEntry {
  reportId: string
  siteId: SiteId
  siteName: string
  director: string
  date: string
  note: string
  acked: boolean
}

/** Flatten every report's non-empty Director-Report lines into dated entries. */
function toEntries(reports: DailyOpsReport[]): NoteEntry[] {
  const out: NoteEntry[] = []
  for (const r of reports) {
    const acks = r.acknowledgedNotes ?? []
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
      })
    }
  }
  return out
}

export function DayNotes() {
  const { profile } = useAuth()
  const [reports, setReports] = useState<DailyOpsReport[]>([])
  const [site, setSite] = useState<SiteId | 'all'>('all')
  const [hideAcked, setHideAcked] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())

  useEffect(() => subscribeRecentReports(300, setReports), [])

  const allEntries = useMemo(() => toEntries(reports), [reports])

  const openCount = allEntries.filter((e) => !e.acked).length

  const visible = useMemo(
    () =>
      allEntries.filter(
        (e) => (site === 'all' || e.siteId === site) && (!hideAcked || !e.acked)
      ),
    [allEntries, site, hideAcked]
  )

  // Group visible entries by date, newest first.
  const groups = useMemo(() => {
    const byDate = new Map<string, NoteEntry[]>()
    for (const e of visible) {
      const list = byDate.get(e.date) ?? []
      list.push(e)
      byDate.set(e.date, list)
    }
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, entries]) => ({
        date,
        entries: entries.sort((a, b) => a.siteName.localeCompare(b.siteName)),
      }))
  }, [visible])

  // Only Rob / admins get the Day Notes feed (after all hooks, per rules-of-hooks).
  if (!isAdmin(profile?.role)) return <Navigate to="/dashboard" replace />

  async function toggle(e: NoteEntry) {
    const key = `${e.reportId}::${e.note}`
    setBusy((b) => new Set(b).add(key))
    try {
      await setNoteAck(e.reportId, e.note, !e.acked)
    } catch (err) {
      console.error('Failed to save Day Note check', err)
    } finally {
      setBusy((b) => {
        const next = new Set(b)
        next.delete(key)
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-charcoal)] text-white">
            <NotebookPen className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">Day Notes</h1>
            <p className="text-sm text-[var(--color-dk-gray)]">
              What directors flagged for you — across every school.{' '}
              <span className="font-semibold text-[var(--color-charcoal)]">{openCount} open</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-[var(--color-secondary)] p-0.5">
            <SiteChip label="All" active={site === 'all'} onClick={() => setSite('all')} />
            {SITES.map((s) => (
              <SiteChip key={s.id} label={s.name} active={site === s.id} onClick={() => setSite(s.id)} />
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-charcoal)]">
            <input
              type="checkbox"
              checked={hideAcked}
              onChange={(e) => setHideAcked(e.target.checked)}
              className="size-4 accent-[var(--color-coral)]"
            />
            Hide checked
          </label>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card accent="sky" className="p-8 text-center">
          <p className="text-sm text-[var(--color-dk-gray)]">
            {allEntries.length === 0
              ? 'No director notes have come in yet. They’ll show up here as reports are submitted.'
              : hideAcked
                ? 'All caught up — every note is checked off. 🎉'
                : 'No notes for this school yet.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.date} className="space-y-3">
              <h2 className="sticky top-16 z-10 -mx-1 bg-[var(--color-cream)]/90 px-1 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)] backdrop-blur">
                {formatLong(g.date)}
              </h2>
              <div className="space-y-2.5">
                {g.entries.map((e) => (
                  <NoteRow
                    key={`${e.reportId}::${e.note}`}
                    entry={e}
                    busy={busy.has(`${e.reportId}::${e.note}`)}
                    onToggle={() => toggle(e)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function SiteChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
        active
          ? 'bg-[var(--color-coral)] text-white shadow-sm'
          : 'text-[var(--color-dk-gray)] hover:text-[var(--color-charcoal)]'
      )}
    >
      {label}
    </button>
  )
}

function NoteRow({ entry, busy, onToggle }: { entry: NoteEntry; busy: boolean; onToggle: () => void }) {
  return (
    <Card
      accent={SITE_ACCENT[entry.siteId]}
      className={cn(
        'flex items-start gap-3 p-4 transition-opacity',
        entry.acked && 'opacity-60'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={entry.acked}
        aria-label={entry.acked ? 'Mark as open' : 'Check off'}
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
          entry.acked
            ? 'border-[var(--color-coral)] bg-[var(--color-coral)] text-white'
            : 'border-[var(--color-mid-gray)] text-transparent hover:border-[var(--color-coral)]',
          busy && 'opacity-50'
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[15px] leading-snug text-[var(--color-charcoal)]',
            entry.acked && 'text-[var(--color-dk-gray)] line-through'
          )}
        >
          {entry.note}
        </p>
        <p className="mt-1 text-xs text-[var(--color-dk-gray)]">
          <span className="font-semibold text-[var(--color-charcoal)]">{entry.siteName}</span>
          {entry.director && <span> · {entry.director}</span>}
        </p>
      </div>
    </Card>
  )
}
