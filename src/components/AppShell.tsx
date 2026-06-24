import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/report', label: 'Daily Report', icon: ClipboardList },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export function AppShell() {
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
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
