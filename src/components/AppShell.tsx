import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ClipboardList, LayoutDashboard, LogOut, HelpCircle, NotebookPen, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin, userSites, subscribeDayNotesSeenAt } from '@/lib/users'
import { siteName, type DailyOpsReport } from '@/lib/schema'
import { subscribeRecentReports } from '@/lib/reports'
import { countUnreadReplies, getDayNotesSeen, laterIso } from '@/lib/dayNotesRead'

// Day Notes is a two-sided view: admins triage every school's notes; directors
// see their own notes, whether they've been seen, and leadership's replies.
const navItems: { to: string; label: string; icon: typeof ClipboardList; adminOnly?: boolean }[] = [
  { to: '/report', label: 'Daily Report', icon: ClipboardList },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/day-notes', label: 'Day Notes', icon: NotebookPen },
  { to: '/performance', label: 'Performance', icon: BarChart3, adminOnly: true },
]

/** Unread Day-Notes replies from the other side — powers the nav nudge. */
function useDayNotesUnread(): number {
  const { user, profile } = useAuth()
  const admin = isAdmin(profile?.role)
  const [reports, setReports] = useState<DailyOpsReport[]>([])
  const [remoteSeen, setRemoteSeen] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => subscribeRecentReports(300, setReports), [])

  // Admins sync "last seen" via their user doc → nudge clears across devices.
  useEffect(() => {
    if (!user?.uid || !admin) {
      setRemoteSeen('')
      return
    }
    return subscribeDayNotesSeenAt(user.uid, setRemoteSeen)
  }, [user?.uid, admin])

  // Recompute when the user opens Day Notes (marks seen) or storage changes.
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('daynotes-seen', bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener('daynotes-seen', bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  return useMemo(() => {
    if (!user?.uid) return 0
    return countUnreadReplies(reports, {
      isAdmin: admin,
      sites: userSites(profile),
      since: laterIso(remoteSeen, getDayNotesSeen(user.uid)),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, user?.uid, admin, userSites(profile).join(), remoteSeen, tick])
}

export function AppShell() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const admin = isAdmin(profile?.role)
  const unread = useDayNotesUnread()

  const name = profile?.displayName || user?.email || 'Signed in'
  const roleLine =
    profile?.role === 'director' && profile.siteId
      ? `Director · ${siteName(profile.siteId)}`
      : profile?.role
        ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
        : ''

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-svh bg-[var(--color-cream)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-cream)]/85 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/bb-tree.png"
              alt="Bright Beginnings"
              className="size-9 object-contain"
            />
            <div className="leading-tight">
              <p className="font-brand text-base font-medium text-[var(--color-charcoal)]">
                Daily Ops Report
              </p>
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-dk-gray)]">
                Bright Beginnings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <nav className="flex items-center gap-1">
              {navItems.filter((i) => !i.adminOnly || admin).map(({ to, label, icon: Icon }) => {
                const badge = to === '/day-notes' && unread > 0
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                        isActive
                          ? 'bg-[var(--color-coral)] text-white'
                          : 'text-[var(--color-charcoal)] hover:bg-[var(--color-secondary)]'
                      )
                    }
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{label}</span>
                    {badge && (
                      <span
                        title={`${unread} new ${unread === 1 ? 'message' : 'messages'}`}
                        className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--color-critical)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--color-cream)]"
                      >
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </nav>

            <div className="flex items-center gap-2 border-l border-[var(--color-border)] pl-2 sm:pl-4">
              <a
                href="/how-to-use-the-dor.html"
                target="_blank"
                rel="noopener noreferrer"
                title="How to use the DOR"
                aria-label="How to use the DOR"
                className="grid size-9 place-items-center rounded-lg text-[var(--color-dk-gray)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-charcoal)]"
              >
                <HelpCircle className="size-5" />
              </a>
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-semibold text-[var(--color-charcoal)]">{name}</p>
                {roleLine && (
                  <p className="text-[11px] text-[var(--color-dk-gray)]">{roleLine}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="grid size-9 place-items-center rounded-lg text-[var(--color-dk-gray)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-charcoal)]"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
