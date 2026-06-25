import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ClipboardList, LayoutDashboard, LogOut, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/AuthProvider'
import { siteName } from '@/lib/schema'

const navItems = [
  { to: '/report', label: 'Daily Report', icon: ClipboardList },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export function AppShell() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

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
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-cream)]/85 backdrop-blur">
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
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-[var(--color-coral)] text-white'
                        : 'text-[var(--color-charcoal)] hover:bg-[var(--color-secondary)]'
                    )
                  }
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
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
