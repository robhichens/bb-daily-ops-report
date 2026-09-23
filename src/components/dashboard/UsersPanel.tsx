import { useEffect, useState } from 'react'
import { Ban, Check, Loader2, Mail, Pencil, RotateCcw, Trash2, UserPlus, UsersRound, X } from 'lucide-react'
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
  setUserDisabled,
  deleteUser,
  roleChange,
  updateUserName,
  updateUserRole,
  ASSIGNABLE_ROLES,
  SITE_ROLES,
  type InviteRole,
  type UserProfile,
  type UserRole,
} from '@/lib/users'
import { Input, inputClass } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ROLE_ORDER: Record<string, number> = { admin: 0, director: 1, co_director: 2, finance: 3, admissions: 4 }
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', director: 'Director', co_director: 'Co-Director', finance: 'Finance', admissions: 'Admissions' }
const humanRole = (r: string) => ROLE_LABEL[r] ?? r

// Assignable reports = everything except DDR (DDR access = the site checkboxes).
const ASSIGNABLE = REPORTS.filter((r) => r.key !== 'ddr')

/** Admin-only: every user, their school access (DDR), and per-report Fill/View
 *  grants. Assigning a report also reveals its dashboard data to that user. */
export function UsersPanel() {
  const { user } = useAuth()
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

  async function rename(u: UserProfile, name: string) {
    try {
      await withSave(u.uid, () => updateUserName(u.uid, name))
    } catch (err) {
      window.alert(err instanceof Error ? `Couldn’t save the name: ${err.message}` : 'Couldn’t save the name')
    }
  }

  async function changeRole(u: UserProfile, next: UserRole) {
    if (next === u.role) return
    const who = u.displayName || u.email || 'this person'
    const c = roleChange(u, next)
    const effects = [
      next === 'admin' && 'full access to every report, every school, and Users & Access',
      next === 'director' && userSites(u).length === 0 && 'pick their school(s) next so they can file the DDR',
      next === 'co_director' && 'the CDR (Fill) for their campus — pick it below if it isn’t set',
      c.clearSites && 'their school list is cleared (this role covers every school)',
      (next === 'finance' || next === 'admissions') && `the ${next === 'finance' ? 'FDR' : 'ADR'} (Fill)`,
    ].filter(Boolean)
    const lines = [`Change ${who} from ${humanRole(u.role)} to ${humanRole(next)}?`]
    if (effects.length) lines.push(`They’ll get: ${effects.join('; ')}.`)
    lines.push('Other report access you set by hand stays.')
    const msg = lines.join('\n\n')
    if (!window.confirm(msg)) return
    await withSave(u.uid, () => updateUserRole(u.uid, c))
  }

  async function toggleActive(u: UserProfile) {
    if (!user) return
    await withSave(u.uid, async () => {
      const idToken = await user.getIdToken()
      await setUserDisabled(idToken, u.uid, !u.disabled)
    })
  }

  async function removeUser(u: UserProfile) {
    if (!user) return
    if (!window.confirm(`Delete ${u.displayName || u.email || 'this account'}? This removes their login and profile and can’t be undone.`)) return
    try {
      await withSave(u.uid, async () => {
        const idToken = await user.getIdToken()
        await deleteUser(idToken, u.uid)
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete that account')
    }
  }

  return (
    <Card accent="gray" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--color-border)] p-5">
        <UsersRound className="size-4 text-[var(--color-dk-gray)]" />
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)]">
          Users &amp; Access
        </h2>
        <span className="w-full text-xs text-[var(--color-mid-gray)] sm:ml-auto sm:w-auto">
          Grant schools (DDR) &amp; reports · assigning a report shows its dashboard data
        </span>
      </div>

      <InviteForm />

      <div className="divide-y divide-[var(--color-border)]">
        {sorted.map((u) => {
          const access = userSites(u)
          const saving = savingUid === u.uid
          const isAdminUser = u.role === 'admin'
          const isSelf = user?.uid === u.uid
          return (
            <div key={u.uid} className={cn('px-5 py-4', u.disabled && 'opacity-60')}>
              {/* Phones: name + email on their own line, controls underneath. */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                  <NameField u={u} disabled={saving} onSave={(name) => rename(u, name)} />
                  <p className="truncate text-xs text-[var(--color-dk-gray)]">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {u.disabled && (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-secondary)] px-2.5 py-1 text-xs font-bold text-[var(--color-dk-gray)]">
                      Deactivated
                    </span>
                  )}
                  {isSelf ? (
                    // You can't change your own role — no accidental self-lockout.
                    <span className="inline-flex items-center rounded-full bg-[var(--color-coral-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-coral-dark)]">
                      {humanRole(u.role)}
                    </span>
                  ) : (
                    <select
                      value={u.role}
                      disabled={saving}
                      onChange={(e) => void changeRole(u, e.target.value as UserRole)}
                      aria-label="Role"
                      className={cn(
                        inputClass,
                        'h-8 w-auto py-0 text-xs font-bold',
                        isAdminUser && 'border-[var(--color-coral)] text-[var(--color-coral-dark)]'
                      )}
                    >
                      {!ASSIGNABLE_ROLES.includes(u.role) && <option value={u.role}>{humanRole(u.role)}</option>}
                      {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{humanRole(r)}</option>)}
                    </select>
                  )}
                  {isSelf ? (
                    <span className="text-xs text-[var(--color-mid-gray)]">You</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void toggleActive(u)}
                        disabled={saving}
                        title={u.disabled ? 'Reactivate — allow sign-in' : 'Deactivate — block sign-in'}
                        aria-label={u.disabled ? 'Reactivate account' : 'Deactivate account'}
                        className="grid size-8 place-items-center rounded-lg text-[var(--color-mid-gray)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-charcoal)] disabled:opacity-50"
                      >
                        {u.disabled ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeUser(u)}
                        disabled={saving}
                        title="Delete account"
                        aria-label="Delete account"
                        className="grid size-8 place-items-center rounded-lg text-[var(--color-mid-gray)] transition-colors hover:bg-[var(--color-critical-soft)] hover:text-[var(--color-critical)] disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {SITE_ROLES.includes(u.role) && access.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-[var(--color-critical)]">
                  No school picked yet — tick one below so they can file.
                </p>
              )}

              {!isAdminUser && (
                <div className="mt-3 space-y-3">
                  {/* DDR = school access */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="w-full text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)] sm:w-16">Schools</span>
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
                    <span className="w-full text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)] sm:w-16">Reports</span>
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

/** Name with a pencil to edit it in place (Enter saves, Esc cancels). */
function NameField({ u, disabled, onSave }: { u: UserProfile; disabled: boolean; onSave: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function start() {
    setDraft(u.displayName ?? '')
    setEditing(true)
  }
  async function save() {
    const next = draft.trim()
    setEditing(false)
    if (next !== (u.displayName ?? '')) await onSave(next)
  }

  if (editing) {
    // A real form so the phone keyboard's Go/Return key submits too.
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Input
          value={draft}
          autoFocus
          enterKeyHint="done"
          placeholder="First Last"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
          }}
          className="h-9 w-full min-w-0 text-base sm:w-56 sm:text-sm"
        />
        <button type="submit" aria-label="Save name" className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--color-good)] hover:bg-[var(--color-secondary)]">
          <Check className="size-5" />
        </button>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--color-mid-gray)] hover:bg-[var(--color-secondary)]">
          <X className="size-5" />
        </button>
      </form>
    )
  }

  return (
    <div className="group flex items-center gap-1.5">
      <p className="text-sm font-semibold text-[var(--color-charcoal)]">
        {u.displayName || <span className="font-normal italic text-[var(--color-mid-gray)]">No name set</span>}
      </p>
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        title="Edit name"
        aria-label="Edit name"
        className="grid size-6 place-items-center rounded-md text-[var(--color-mid-gray)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-charcoal)] disabled:opacity-50"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  )
}

type InviteStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }
  | { kind: 'sent'; email: string; reused: boolean; emailSent: boolean }

/** Admin enters a name + email + role (+ schools, for campus roles) and an
 *  optional personal note, and sends an invite: the invite-user function
 *  creates the account and emails a branded "set your password" invite.
 *  They pick their own password on first login — this never touches one. */
function InviteForm() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [role, setRole] = useState<InviteRole>('director')
  const [siteIds, setSiteIds] = useState<SiteId[]>([])
  const [status, setStatus] = useState<InviteStatus>({ kind: 'idle' })

  function toggleSite(site: SiteId) {
    setSiteIds((prev) => (prev.includes(site) ? prev.filter((s) => s !== site) : [...prev, site]))
  }

  async function send() {
    if (!user) return
    const trimmed = email.trim()
    if (!trimmed) { setStatus({ kind: 'error', message: 'Enter an email address' }); return }
    const isSiteRole = SITE_ROLES.includes(role)
    if (isSiteRole && siteIds.length === 0) { setStatus({ kind: 'error', message: 'Pick at least one school' }); return }

    setStatus({ kind: 'sending' })
    try {
      const idToken = await user.getIdToken()
      const result = await inviteUser(idToken, {
        email: trimmed,
        name: name.trim(),
        role,
        siteIds: isSiteRole ? siteIds : [],
        note: note.trim(),
      })
      setStatus({ kind: 'sent', email: trimmed, reused: result.reused, emailSent: result.emailSent })
      setName(''); setEmail(''); setNote(''); setRole('director'); setSiteIds([])
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
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">Name</span>
          <Input
            value={name}
            placeholder="First Last"
            disabled={sending}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
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
            onChange={(e) => setRole(e.target.value as InviteRole)}
            className={cn(inputClass, 'h-11 w-auto')}
          >
            <option value="director">Director</option>
            <option value="co_director">Co-Director</option>
            <option value="finance">Finance</option>
            <option value="admissions">Admissions</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <Button size="default" onClick={() => void send()} disabled={sending}>
          {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
          Send invite
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
      </div>

      {SITE_ROLES.includes(role) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">
            {role === 'co_director' ? 'Campus' : 'Schools'}
          </span>
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

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">
          Personal note <span className="font-normal normal-case tracking-normal">(optional, shows in the email)</span>
        </span>
        <textarea
          value={note}
          rows={2}
          maxLength={1000}
          placeholder="So glad you're joining us! Reach out any time if you get stuck."
          disabled={sending}
          onChange={(e) => setNote(e.target.value)}
          className={cn(inputClass, 'h-auto min-h-16 py-2')}
        />
      </label>

      {status.kind === 'error' && (
        <p className="text-xs font-semibold text-[var(--color-coral-dark)]">{status.message}</p>
      )}
      {status.kind === 'sent' && (
        <p className="text-xs font-semibold text-[var(--color-good)]">
          {status.reused
            ? `${status.email} already had an account — resent the set-password email.`
            : `Invite sent to ${status.email} — they'll get an email to set their password.`}
          {!status.emailSent && " (Sent as the plain Firebase email — the branded invite isn't switched on yet.)"}
        </p>
      )}
    </div>
  )
}
