import { useEffect, useState } from 'react'
import { Loader2, Mail, ShieldCheck, UserPlus, UsersRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Card } from '@/components/ui/card'
import { SITES, type ReportAccessLevel, type ReportKey, type SiteId } from '@/lib/schema'
import { REPORTS } from '@/lib/reportRegistry'
import {
  subscribeUsers,
  updateUserSites,
  updateUserReportAccess,
  userSites,
  inviteUser,
  type UserProfile,
} from '@/lib/users'
import { Input, inputClass } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

      <InviteForm />

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

type InviteStatus = { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; message: string } | { kind: 'sent'; email: string; reused: boolean }

/** Admin enters an email + role (+ schools, for a director) and sends an
 *  invite: the invite-user function creates the account, then the browser
 *  sends the person the same "set your password" email as Forgot password.
 *  They pick their own password on first login — this never touches one. */
function InviteForm() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'director' | 'admin'>('director')
  const [siteIds, setSiteIds] = useState<SiteId[]>([])
  const [status, setStatus] = useState<InviteStatus>({ kind: 'idle' })

  function toggleSite(site: SiteId) {
    setSiteIds((prev) => (prev.includes(site) ? prev.filter((s) => s !== site) : [...prev, site]))
  }

  async function send() {
    if (!user) return
    const trimmed = email.trim()
    if (!trimmed) { setStatus({ kind: 'error', message: 'Enter an email address' }); return }
    if (role === 'director' && siteIds.length === 0) { setStatus({ kind: 'error', message: 'Pick at least one school' }); return }

    setStatus({ kind: 'sending' })
    try {
      const idToken = await user.getIdToken()
      const result = await inviteUser(idToken, trimmed, role, siteIds)
      setStatus({ kind: 'sent', email: trimmed, reused: result.reused })
      setEmail(''); setRole('director'); setSiteIds([])
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Invite failed' })
    }
  }

  if (!open) {
    return (
      <div className="border-b border-[var(--color-border)] p-5">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="size-3.5" /> Invite someone
        </Button>
      </div>
    )
  }

  const sending = status.kind === 'sending'

  return (
    <div className="space-y-3 border-b border-[var(--color-border)] bg-[var(--color-secondary)]/40 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">Email</span>
          <Input
            type="email"
            value={email}
            placeholder="name@brightbeginningsva.com"
            disabled={sending}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">Role</span>
          <select
            value={role}
            disabled={sending}
            onChange={(e) => setRole(e.target.value as 'director' | 'admin')}
            className={cn(inputClass, 'h-11 w-auto')}
          >
            <option value="director">Director</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <Button size="default" onClick={() => void send()} disabled={sending}>
          {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
          Send invite
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
      </div>

      {role === 'director' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">Schools</span>
          {SITES.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={siteIds.includes(s.id)}
                disabled={sending}
                onChange={() => toggleSite(s.id)}
                className="size-4 accent-[var(--color-coral)]"
              />
              {s.name}
            </label>
          ))}
        </div>
      )}

      {status.kind === 'error' && (
        <p className="text-xs font-semibold text-[var(--color-coral-dark)]">{status.message}</p>
      )}
      {status.kind === 'sent' && (
        <p className="text-xs font-semibold text-[var(--color-good)]">
          {status.reused
            ? `${status.email} already had an account — resent the set-password email.`
            : `Invite sent to ${status.email} — they'll get an email to set their password.`}
        </p>
      )}
    </div>
  )
}
