import { useMemo, useState } from 'react'
import { ShoppingCart, Wrench, Check, CheckCircle2, Trash2, Printer } from 'lucide-react'
import { CollapsibleCard } from './CollapsibleCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/auth/AuthProvider'
import { useUserDirectory } from '@/lib/userDirectory'
import { completeRequest } from '@/lib/noteActions'
import { usePrintSheet } from '@/components/report/PrintSheet'
import { buildRequestsPrintModel } from '@/lib/requestPrint'
import { ReportSection } from './ReportSections'
import {
  REQUEST_LISTS,
  type DailyOpsReport,
  type LedgerNote,
  type RequestList,
} from '@/lib/schema'
import {
  collectRequests,
  collectCompletedRequests,
  setNoteTag,
  type RequestItem,
} from '@/lib/reports'
import {
  collectOrgRequests,
  collectOrgCompletedRequests,
  setOrgNoteRequest,
} from '@/lib/orgReports'
import { formatShort, formatStamp, todayIso } from '@/lib/dates'
import { cn } from '@/lib/utils'

const LIST_META: Record<
  RequestList,
  { icon: typeof ShoppingCart; accent: 'sky' | 'yellow'; color: string }
> = {
  purchase: { icon: ShoppingCart, accent: 'sky', color: 'var(--color-sky-deep)' },
  maintenance: { icon: Wrench, accent: 'yellow', color: 'var(--color-coral-dark)' },
}

/** Reusable per-item busy tracker for the check/delete actions. */
function useItemBusy() {
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(key))
    try {
      await fn()
    } catch (err) {
      console.error('Failed to update request list', err)
    } finally {
      setBusy((b) => {
        const next = new Set(b)
        next.delete(key)
        return next
      })
    }
  }
  return { busy, run }
}

const byDateDesc = (a: RequestItem, b: RequestItem) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : a.contextLabel.localeCompare(b.contextLabel)

// Dispatch the reopen/remove actions to the right data layer for each item kind.
const removeItem = (i: RequestItem) =>
  i.kind === 'ddr'
    ? setNoteTag(i.reportId!, i.tags, i.note, i.list, false)
    : setOrgNoteRequest(i.noteId!, i.requests, i.list, false)

/** Admin-only Purchase + Maintenance lists (+ a Completed archive), derived from
 *  Buy/Fix tags across every report's Day Notes. */
export function RequestLists({ reports, orgNotes }: { reports: DailyOpsReport[]; orgNotes: LedgerNote[] }) {
  const { print, sheet } = usePrintSheet()
  const groups = useMemo(
    () => REQUEST_LISTS.map((l) => ({
      list: l.id,
      label: l.label,
      items: [...collectRequests(reports, l.id), ...collectOrgRequests(orgNotes, l.id)],
    })),
    [reports, orgNotes]
  )
  const printLists = (ids: RequestList[]) =>
    print(buildRequestsPrintModel(groups.filter((g) => ids.includes(g.list)), todayIso()))

  return (
    <ReportSection title="Day Note Requests" sub="Purchase & maintenance" storageKey="requests">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
          <Printer className="size-3.5" /> Print / PDF
        </span>
        {groups.map((g) => (
          <Button key={g.list} size="sm" variant="outline" onClick={() => printLists([g.list])}>
            {g.list === 'purchase' ? 'Purchase' : 'Maintenance'} ({g.items.length})
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => printLists(groups.map((g) => g.list))}>Both</Button>
      </div>
      {sheet}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {REQUEST_LISTS.map((l) => (
          <ActiveListCard key={l.id} list={l.id} label={l.label} reports={reports} orgNotes={orgNotes} />
        ))}
      </div>
      <CompletedCard reports={reports} orgNotes={orgNotes} />
    </ReportSection>
  )
}

function ActiveListCard({
  list, label, reports, orgNotes,
}: {
  list: RequestList
  label: string
  reports: DailyOpsReport[]
  orgNotes: LedgerNote[]
}) {
  const { icon: Icon, accent, color } = LIST_META[list]
  const items = useMemo(
    () => [...collectRequests(reports, list), ...collectOrgRequests(orgNotes, list)].sort(byDateDesc),
    [reports, orgNotes, list]
  )
  const { busy, run } = useItemBusy()
  const { user, profile } = useAuth()
  const users = useUserDirectory()
  // The item whose "what was done?" box is open (checking an item off opens it).
  const [completing, setCompleting] = useState<string | null>(null)

  const finish = (item: RequestItem, text: string) =>
    run(item.key, async () => {
      await completeRequest({
        item,
        text,
        by: { uid: user?.uid ?? '', name: profile?.displayName || user?.email || 'Leadership', role: 'admin' },
        reports,
        orgNotes,
        users,
      })
      setCompleting(null)
    })

  return (
    <CollapsibleCard
      accent={accent}
      storageKey={`requests-${list}`}
      className="flex flex-col"
      header={
        <>
          <Icon className="size-4" style={{ color }} />
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color }}>
            {label} ({items.length})
          </h2>
        </>
      }
    >
      {items.length === 0 ? (
        <p className="p-5 text-sm text-[var(--color-dk-gray)]">
          Nothing here yet. Add items from <span className="font-semibold">Day Notes</span> or any report.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <li key={item.key} className="px-5 py-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setCompleting(completing === item.key ? null : item.key)}
                  disabled={busy.has(item.key)}
                  title="Mark done"
                  aria-label="Mark done"
                  aria-expanded={completing === item.key}
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors hover:border-[var(--color-good)] hover:text-[var(--color-good)]',
                    completing === item.key ? 'border-[var(--color-good)] text-[var(--color-good)]' : 'border-[var(--color-mid-gray)] text-transparent',
                    busy.has(item.key) && 'opacity-50'
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </button>
                <RequestBody item={item} />
              </div>
              {completing === item.key && (
                <CompleteForm
                  list={list}
                  busy={busy.has(item.key)}
                  onCancel={() => setCompleting(null)}
                  onDone={(text) => void finish(item, text)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </CollapsibleCard>
  )
}

function CompletedCard({ reports, orgNotes }: { reports: DailyOpsReport[]; orgNotes: LedgerNote[] }) {
  const items = useMemo(
    () => [...collectCompletedRequests(reports), ...collectOrgCompletedRequests(orgNotes)]
      .sort((a, b) => ((a.doneAt ?? '') < (b.doneAt ?? '') ? 1 : (a.doneAt ?? '') > (b.doneAt ?? '') ? -1 : 0)),
    [reports, orgNotes]
  )
  const { busy, run } = useItemBusy()

  return (
    <CollapsibleCard
      accent="gray"
      storageKey="requests-completed"
      defaultOpen={false}
      header={
        <>
          <CheckCircle2 className="size-4 text-[var(--color-good)]" />
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)]">
            Completed ({items.length})
          </h2>
        </>
      }
    >
      {items.length === 0 ? (
        <p className="p-5 text-sm text-[var(--color-dk-gray)]">
          Items you check off from either list land here.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item) => {
            const ListIcon = LIST_META[item.list].icon
            return (
              <li key={item.key} className="flex items-start gap-3 px-5 py-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--color-good)]" />
                <RequestBody item={item} done />
                <span
                  title={item.list === 'purchase' ? 'Purchase' : 'Maintenance'}
                  className="mt-0.5 shrink-0 text-[var(--color-mid-gray)]"
                >
                  <ListIcon className="size-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => run(item.key, () => removeItem(item))}
                  disabled={busy.has(item.key)}
                  title="Delete from completed"
                  aria-label="Delete from completed"
                  className={cn(
                    'mt-0.5 shrink-0 text-[var(--color-mid-gray)] transition-colors hover:text-[var(--color-critical)]',
                    busy.has(item.key) && 'opacity-50'
                  )}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </CollapsibleCard>
  )
}

/** The little "what was done?" box that opens when an item is checked off. The note
 *  is optional; it's saved with the item and sent to whoever made the request. */
function CompleteForm({
  list, busy, onCancel, onDone,
}: {
  list: RequestList
  busy: boolean
  onCancel: () => void
  onDone: (text: string) => void
}) {
  const [text, setText] = useState('')
  return (
    <div className="ml-8 mt-2.5 space-y-2 rounded-xl border border-[var(--color-good)]/40 bg-[var(--color-good-soft)] p-3">
      <label className="block text-xs font-semibold text-[var(--color-charcoal)]" htmlFor={`done-note-${list}`}>
        {list === 'purchase' ? 'What was purchased?' : 'How was it fixed?'}
        <span className="ml-1 font-normal text-[var(--color-dk-gray)]">Optional. Goes to whoever made the request.</span>
      </label>
      <Textarea
        id={`done-note-${list}`}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={list === 'purchase' ? 'e.g. Ordered 4 black + 2 color cartridges, arriving Thursday' : 'e.g. Plumber replaced the flush valve on Tuesday'}
        className="min-h-[56px] bg-white"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onDone(text)
        }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onDone(text)} disabled={busy}>
          <Check className="size-3.5" /> Mark done
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  )
}

function RequestBody({ item, done = false }: { item: RequestItem; done?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          'text-sm leading-snug text-[var(--color-charcoal)]',
          done && 'text-[var(--color-dk-gray)] line-through'
        )}
      >
        {item.note}
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-dk-gray)]">
        <span className="font-semibold text-[var(--color-charcoal)]">{item.contextLabel}</span>
        {' · '}
        {formatShort(item.date)}
      </p>
      {done && (
        <div className="mt-1.5 rounded-lg bg-[var(--color-secondary)] px-3 py-2">
          <p className="text-[11px] font-semibold text-[var(--color-dk-gray)]">
            {item.doneBy ? `Done by ${item.doneBy}` : 'Done'}
            {item.doneAt && <time dateTime={item.doneAt}> · {formatStamp(item.doneAt)}</time>}
          </p>
          {item.doneNote ? (
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-charcoal)]">{item.doneNote}</p>
          ) : (
            <p className="mt-0.5 text-xs italic text-[var(--color-mid-gray)]">No note added</p>
          )}
        </div>
      )}
    </div>
  )
}
