import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, LayoutDashboard, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/report', label: 'Daily Report', icon: ClipboardList },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export function AppShell() {
  return (
    <div className="min-h-svh bg-[var(--color-cream)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-cream)]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-navy)] text-[var(--color-cream)]">
              <Sparkles className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-base font-bold text-[var(--color-navy)]">
                Daily Ops Report
              </p>
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted-ink)]">
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
                      ? 'bg-[var(--color-navy)] text-[var(--color-cream)]'
                      : 'text-[var(--color-ink)] hover:bg-[var(--color-secondary)]'
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
