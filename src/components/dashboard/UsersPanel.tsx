import { useEffect, useState } from 'react'
import { ShieldCheck, UsersRound } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SITES, type SiteId } from '@/lib/schema'
import {
  subscribeUsers,
  updateUserSites,
  userSites,
  type UserProfile,
} from '@/lib/users'

const ROLE_ORDER: Record<string, number> = { admin: 0, director: 1 }

/** Admin-only: every user + which schools they can access. Ticking a site box
 *  grants a director filing + dashboard access to that school instantly. */
export function UsersPanel() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [savingUid, setSavingUid] = useState<string | null>(null)

  useEffect(() => subscribeUsers(setUsers), [])

  const sorted = [...users].sort(
    (a, b) =>
      (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
      (a.displayName ?? a.email ?? '').localeCompare(b.displayName ?? b.email ?? '')
  )

  async function toggle(u: UserProfile, site: SiteId) {
    const current = userSites(u)
    const next = current.includes(site)
      ? current.filter((s) => s !== site)
      : [...current, site]
    if (next.length === 0) return // a director must keep at least one school
    setSavingUid(u.uid)
    try {
      await updateUserSites(u.uid, next)
    } finally {
      setSavingUid(null)
    }
  }

  return (
    <Card accent="gray" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-5">
        <UsersRound className="size-4 text-[var(--color-dk-gray)]" />
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)]">
          Users &amp; Access
        </h2>
        <span className="ml-auto text-xs text-[var(--color-mid-gray)]">
          Tick a school to grant a director access
        </span>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {sorted.map((u) => {
          const access = userSites(u)
          const saving = savingUid === u.uid
          return (
            <div
              key={u.uid}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3"
            >
              <div className="min-w-48 flex-1">
                <p className="text-sm font-semibold text-[var(--color-charcoal)]">
                  {u.displayName || u.email || u.uid}
                </p>
                <p className="text-xs text-[var(--color-dk-gray)]">{u.email}</p>
              </div>

              {u.role === 'admin' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-coral-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-coral-dark)]">
                  <ShieldCheck className="size-3.5" /> Admin · all schools
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {SITES.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--color-charcoal)]"
                    >
                      <input
                        type="checkbox"
                        checked={access.includes(s.id)}
                        disabled={saving}
                        onChange={() => void toggle(u, s.id)}
                        className="size-4 accent-[var(--color-coral)]"
                      />
                      {s.name}
                    </label>
                  ))}
                  {saving && (
                    <span className="text-xs text-[var(--color-mid-gray)]">Saving…</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {sorted.length === 0 && (
          <p className="p-5 text-sm text-[var(--color-dk-gray)]">Loading users…</p>
        )}
      </div>
    </Card>
  )
}
