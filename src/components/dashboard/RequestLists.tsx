import { useMemo, useState } from 'react'
import { ShoppingCart, Wrench, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  REQUEST_LISTS,
  type DailyOpsReport,
  type RequestList,
} from '@/lib/schema'
import { collectRequests, setNoteTag, type RequestItem } from '@/lib/reports'
import { formatShort } from '@/lib/dates'
import { cn } from '@/lib/utils'

const LIST_META: Record<
  RequestList,
  { icon: typeof ShoppingCart; accent: 'sky' | 'yellow' }
> = {
  purchase: { icon: ShoppingCart, accent: 'sky' },
  maintenance: { icon: Wrench, accent: 'yellow' },
}

/** Admin-only Purchase + Maintenance lists, derived from notes tagged in Day Notes. */
export function RequestLists({ reports }: { reports: DailyOpsReport[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {REQUEST_LISTS.map((l) => (
        <RequestListCard key={l.id} list={l.id} label={l.label} reports={reports} />
      ))}
    </div>
  )
}

function RequestListCard({
  list,
  label,
  reports,
}: {
  list: RequestList
  label: string
  reports: DailyOpsReport[]
}) {
  const { icon: Icon, accent } = LIST_META[list]
  const items = useMemo(() => collectRequests(reports, list), [reports, list])
  const [busy, setBusy] = useState<Set<string>>(new Set())

  async function markDone(item: RequestItem) {
    const key = `${item.reportId}::${item.note}`
    setBusy((b) => new Set(b).add(key))
    try {
      await setNoteTag(item.reportId, item.tags, item.note, list, false)
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

  return (
    <Card accent={accent} className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-5">
        <Icon className="size-4 text-[var(--color-dk-gray)]" />
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)]">
          {label} ({items.length})
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="p-5 text-sm text-[var(--color-dk-gray)]">
          Nothing here yet. Add items from <span className="font-semibold">Day Notes</span>.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item) => {
            const key = `${item.reportId}::${item.note}`
            return (
              <li key={key} className="flex items-start gap-3 px-5 py-3">
                <button
                  type="button"
                  onClick={() => markDone(item)}
                  disabled={busy.has(key)}
                  title="Mark done (remove from list)"
                  aria-label="Mark done"
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 border-[var(--color-mid-gray)] text-transparent transition-colors hover:border-[var(--color-good)] hover:text-[var(--color-good)]',
                    busy.has(key) && 'opacity-50'
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-[var(--color-charcoal)]">{item.note}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-dk-gray)]">
                    <span className="font-semibold text-[var(--color-charcoal)]">{item.siteName}</span>
                    {' · '}
                    {formatShort(item.date)}
                    {item.director && <span> · {item.director}</span>}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
