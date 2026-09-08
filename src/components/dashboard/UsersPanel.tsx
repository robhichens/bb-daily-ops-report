import { useEffect, useState } from 'react'
import { ShieldCheck, UsersRound } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SITES, type ReportAccessLevel, type ReportKey, type SiteId } from '@/lib/schema'
import { REPORTS } from '@/lib/reportRegistry'
import {
  subscribeUsers,
  updateUserSites,
  updateUserReportAccess,
  userSites,
  type UserProfile,
} from '@/lib/users'
import { inputClass } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const ROLE_ORDER: Record<string, number> = { admin: 0, director: 1 }

// Assignable reports = everything except DDR (DDR access = the site checkboxes).
const ASSIGNABLE = REPORTS.filter((r) => r.key !== 'ddr')

/** Admin-only: every user, their school access (DDR), and per-report Fill/View
 *  grants. Assigning a report also reveals its dashboard data to that user. */
export function UsersPanel() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [savingUid, setSavingUid] = useState<string | null>(null)

  useEffect(() => subscribeUsers(setUsers), [])

  const sorted = [...users].sort(
    (a, b) =>
      (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
      (a.displayName ?? a.email ?? '').localeCompare(b.displayName ?? b.email ?? '')
  )

  async function withSave(uid: string, fn: () => Promise<void>) {
    setSavingUid(uid)
    try { await fn() } finally { setSavingUid(null) }
  }

  async function toggleSite(u: UserProfile, site: SiteId) {
    const current = userSites(u)
    const next = current.includes(site) ? current.filter((s) => s !== site) : [...current, site]
    if (next.length === 0) return // a director must keep at least one school
    await withSave(u.uid, () => updateUserSites(u.uid, next))
  }

  async function setReport(u: UserProfile, key: ReportKey, value: string) {
    const level = value === '' ? null : (value as ReportAccessLevel)
    await withSave(u.uid, () => updateUserReportAccess(u.uid, key, level))
  }

  return (
    <Card accent="gray" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-5">
        <UsersRound className="size-4 text-[var(--color-dk-gray)]" />
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)]">
          Users &amp; Access
        </h2>
        <span className="ml-auto text-xs text-[var(--color-mid-gray)]">
          Grant schools (DDR) &amp; reports · assigning a report shows its dashboard data
        </span>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {sorted.map((u) => {
          const access = userSites(u)
          const saving = savingUid === u.uid
          const isAdminUser = u.role === 'admin'
          return (
            <div key={u.uid} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-charcoal)]">
                    {u.displayName || u.email || u.uid}
                  </p>
                  <p className="text-xs text-[var(--color-dk-gray)]">{u.email}</p>
                </div>
                {isAdminUser && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-coral-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-coral-dark)]">
                    <ShieldCheck className="size-3.5" /> Admin · full access
                  </span>
                )}
              </div>

              {!isAdminUser && (
                <div className="mt-3 space-y-3">
                  {/* DDR = school access */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="w-16 text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">Schools</span>
                    {SITES.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--color-charcoal)]">
                        <input
                          type="checkbox"
                          checked={access.includes(s.id)}
                          disabled={saving}
                          onChange={() => void toggleSite(u, s.id)}
                          className="size-4 accent-[var(--color-coral)]"
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>

                  {/* Per-report Fill / View grants */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="w-16 text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">Reports</span>
                    {ASSIGNABLE.map((r) => (
                      <label key={r.key} className="flex items-center gap-1.5 text-sm">
                        <span className="font-semibold text-[var(--color-charcoal)]">{r.short}</span>
                        <select
                          value={u.reportAccess?.[r.key] ?? ''}
                          disabled={saving}
                          onChange={(e) => void setReport(u, r.key, e.target.value)}
                          className={cn(inputClass, 'h-8 w-auto py-0 text-xs')}
                        >
                          <option value="">—</option>
                          <option value="view">View</option>
                          <option value="fill">Fill</option>
                        </select>
                      </label>
                    ))}
                    {saving && <span className="text-xs text-[var(--color-mid-gray)]">Saving…</span>}
                  </div>
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
