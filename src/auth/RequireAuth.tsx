import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { canAccessDor, isAdmin } from '@/lib/users'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="grid min-h-svh place-items-center bg-[var(--color-cream)] px-4">{children}</div>
}

/** Guards a route: requires a signed-in user with DOR access (admin or director).
 *  Pass `adminOnly` to restrict to admins (e.g. the leadership dashboard). */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode
  adminOnly?: boolean
}) {
  const { user, profile, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <FullScreen>
        <img src="/brand/bb-tree.png" alt="" className="size-16 animate-pulse object-contain" />
      </FullScreen>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Signed in, but no usable profile / not permitted.
  const permitted = adminOnly ? isAdmin(profile?.role) : canAccessDor(profile?.role)
  if (!permitted) {
    return (
      <FullScreen>
        <Card accent="coral" className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <img src="/brand/bb-tree.png" alt="" className="size-12 object-contain" />
            <div>
              <h1 className="text-xl font-extrabold text-[var(--color-charcoal)]">
                No access yet
              </h1>
              <p className="mt-1 text-sm text-[var(--color-dk-gray)]">
                {profile
                  ? `Your account (${profile.role}) isn’t set up for the Daily Ops Report. Ask an admin to grant access.`
                  : 'Your account has no profile yet. Ask an admin to finish setup.'}
              </p>
            </div>
            <Button variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </FullScreen>
    )
  }

  return <>{children}</>
}
