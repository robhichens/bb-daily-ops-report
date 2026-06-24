import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { FirebaseError } from 'firebase/app'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/auth/AuthProvider'

function messageFor(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That doesn’t look like a valid email.'
    case 'auth/missing-password':
      return 'Enter your password.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.'
    case 'auth/network-request-failed':
      return 'Network error — check your connection.'
    default:
      return 'Could not sign in. Please try again.'
  }
}

export function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/report'

  // Already signed in → bounce to the app.
  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true })
  }, [loading, user, from, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof FirebaseError ? messageFor(err.code) : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-charcoal)] outline-none transition focus:border-[var(--color-coral)] focus:ring-2 focus:ring-[var(--color-coral)]/30'

  return (
    <div className="grid min-h-svh place-items-center bg-[var(--color-cream)] px-4">
      <Card accent="coral" className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <img
            src="/brand/bb-logo-full.png"
            alt="Bright Beginnings Preschool"
            className="w-full max-w-[280px]"
          />
          <div className="text-center">
            <h1 className="font-brand text-xl font-medium text-[var(--color-charcoal)]">
              Daily Ops Report
            </h1>
            <p className="mt-1 text-sm text-[var(--color-dk-gray)]">
              Sign in to file today’s report
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
                Email
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@brightbeginnings.com"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-[var(--color-critical-soft)] px-3 py-2 text-sm text-[var(--color-critical)]">
                {error}
              </p>
            )}

            <Button type="submit" className="mt-1 w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
