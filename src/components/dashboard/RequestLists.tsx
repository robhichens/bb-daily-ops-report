import { useMemo, useState } from 'react'
import { ShoppingCart, Wrench, Check, CheckCircle2, Trash2 } from 'lucide-react'
import { CollapsibleCard } from './CollapsibleCard'
import {
  REQUEST_LISTS,
  type DailyOpsReport,
  type RequestList,
} from '@/lib/schema'
import {
  collectRequests,
  collectCompletedRequests,
  setRequestDone,
  setNoteTag,
  type RequestItem,
} from '@/lib/reports'
import { formatShort } from '@/lib/dates'
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

const itemKey = (i: RequestItem) => `${i.reportId}::${i.list}::${i.note}`

/** Admin-only Purchase + Maintenance lists (+ a Completed archive), derived from
 *  notes tagged in Day Notes. */
export function RequestLists({ reports }: { reports: DailyOpsReport[] }) {
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 md:grid-cols-2">
        {REQUEST_LISTS.map((l) => (
          <ActiveListCard key={l.id} list={l.id} label={l.label} reports={reports} />
        ))}
      </div>
      <CompletedCard reports={reports} />
    </div>
  )
}

function ActiveListCard({
  list,
  label,
  reports,
}: {
  list: RequestList
  label: string
  reports: DailyOpsReport[]
}) {
  const { icon: Icon, accent, color } = LIST_META[list]
  const items = useMemo(() => collectRequests(reports, list), [reports, list])
  const { busy, run } = useItemBusy()

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
          Nothing here yet. Add items from <span className="font-semibold">Day Notes</span>.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item) => {
            const key = itemKey(item)
            return (
              <li key={key} className="flex items-start gap-3 px-5 py-3">
                <button
                  type="button"
                  onClick={() => run(key, () => setRequestDone(item.reportId, item.tags, item.note, list, true))}
                  disabled={busy.has(key)}
                  title="Mark done"
                  aria-label="Mark done"
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 border-[var(--color-mid-gray)] text-transparent transition-colors hover:border-[var(--color-good)] hover:text-[var(--color-good)]',
                    busy.has(key) && 'opacity-50'
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </button>
                <RequestBody item={item} />
              </li>
            )
          })}
        </ul>
      )}
    </CollapsibleCard>
  )
}

function CompletedCard({ reports }: { reports: DailyOpsReport[] }) {
  const items = useMemo(() => collectCompletedRequests(reports), [reports])
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
            const key = itemKey(item)
            const ListIcon = LIST_META[item.list].icon
            return (
              <li key={key} className="flex items-start gap-3 px-5 py-3">
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
                  onClick={() => run(key, () => setNoteTag(item.reportId, item.tags, item.note, item.list, false))}
                  disabled={busy.has(key)}
                  title="Delete from completed"
                  aria-label="Delete from completed"
                  className={cn(
                    'mt-0.5 shrink-0 text-[var(--color-mid-gray)] transition-colors hover:text-[var(--color-critical)]',
                    busy.has(key) && 'opacity-50'
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
        <span className="font-semibold text-[var(--color-charcoal)]">{item.siteName}</span>
        {' · '}
        {formatShort(item.date)}
        {item.director && <span> · {item.director}</span>}
      </p>
    </div>
  )
}
