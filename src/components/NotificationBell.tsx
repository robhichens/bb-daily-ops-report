import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, CornerDownRight, MessageSquare, PackageCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeMyNotifications,
  type AppNotification,
  type NotificationKind,
} from '@/lib/notifications'
import { formatStamp } from '@/lib/dates'
import { cn } from '@/lib/utils'

const VERB: Record<NotificationKind, string> = {
  comment: 'commented on your note',
  reply: 'replied to your thread',
  request_done: 'completed your request',
}
const ICON: Record<NotificationKind, typeof Bell> = {
  comment: MessageSquare,
  reply: CornerDownRight,
  request_done: PackageCheck,
}

/** Header bell: comments and replies aimed at you, and requests of yours that got
 *  done. Live; tapping one opens where it happened and marks it read. */
export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => (user?.uid ? subscribeMyNotifications(user.uid, setItems) : undefined), [user?.uid])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const unread = items.filter((n) => !n.read)

  function go(n: AppNotification) {
    setOpen(false)
    if (!n.read) void markNotificationRead(n.id).catch(() => {})
    if (n.to) navigate(n.to)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread.length ? `Notifications, ${unread.length} new` : 'Notifications'}
        aria-expanded={open}
        title="Notifications"
        className="relative grid size-9 place-items-center rounded-lg text-[var(--color-dk-gray)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-charcoal)]"
      >
        <Bell className="size-5" />
        {unread.length > 0 && (
          <span className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--color-critical)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--color-cream)]">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          items={items}
          onPick={go}
          onMarkAll={() => void markAllNotificationsRead(unread.map((n) => n.id)).catch(() => {})}
        />
      )}
    </div>
  )
}

/** The dropdown: newest first, unread highlighted. */
export function NotificationPanel({
  items,
  onPick,
  onMarkAll,
  className,
}: {
  items: AppNotification[]
  onPick: (n: AppNotification) => void
  onMarkAll: () => void
  className?: string
}) {
  const unread = items.filter((n) => !n.read)
  return (
        <div className={cn('absolute right-0 top-11 z-30 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-xl', className)}>
          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-charcoal)]">Notifications</h2>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-coral-dark)] hover:underline"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--color-dk-gray)]">
              Nothing yet. You’ll see replies to your notes and finished requests here.
            </p>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-[var(--color-border)] overflow-y-auto">
              {items.slice(0, 30).map((n) => {
                const Icon = ICON[n.kind] ?? Bell
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onPick(n)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-secondary)]',
                        !n.read && 'bg-[var(--color-coral-soft)]/50'
                      )}
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--color-coral-dark)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-[var(--color-charcoal)]">
                          <b>{n.fromName}</b> {VERB[n.kind]}
                        </span>
                        {n.about && <span className="mt-0.5 block truncate text-xs text-[var(--color-mid-gray)]">“{n.about}”</span>}
                        {n.text && <span className="mt-1 block text-sm text-[var(--color-dk-gray)]">{n.text}</span>}
                        <span className="mt-1 block text-[11px] font-medium text-[var(--color-mid-gray)]">{formatStamp(n.at)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--color-coral)]" aria-label="Unread" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
  )
}
