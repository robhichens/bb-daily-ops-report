import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/auth/AuthProvider'

// Our own landing page for set-password links (invite emails, and "Forgot
// password?" once the Firebase template's action URL points here). Unlike
// Firebase's generic page, it signs the person straight in afterwards and drops
// them on their report. Any other Firebase action (verify email, etc.) is
// handed on to Firebase's default handler untouched.

const MIN_LENGTH = 8

type Stage =
  | { kind: 'checking' }
  | { kind: 'ready'; email: string }
  | { kind: 'bad-link'; message: string }

function linkProblem(code: string): string {
  switch (code) {
    case 'auth/expired-action-code':
      return 'This link has expired. Links only last an hour.'
    case 'auth/invalid-action-code':
      return 'This link has already been used, or a newer one was sent.'
    case 'auth/user-disabled':
      return 'This account has been deactivated. Ask an admin for help.'
    case 'auth/user-not-found':
      return 'We couldn’t find this account. Ask an admin to send a new invite.'
    default:
      return 'This link isn’t working.'
  }
}

export function SetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const mode = params.get('mode') ?? 'resetPassword'
  const oobCode = params.get('oobCode') ?? ''

  const [stage, setStage] = useState<Stage>({ kind: 'checking' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode !== 'resetPassword') {
      window.location.replace(
        `https://${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}/__/auth/action${window.location.search}`
      )
      return
    }
    if (!oobCode) {
      setStage({ kind: 'bad-link', message: 'This link is incomplete.' })
      return
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => setStage({ kind: 'ready', email }))
      .catch((err) =>
        setStage({ kind: 'bad-link', message: linkProblem(err instanceof FirebaseError ? err.code : '') })
      )
  }, [mode, oobCode])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (stage.kind !== 'ready') return
    setError(null)
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Those two passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      if (code === 'auth/weak-password') setError('That password is too weak. Try a longer one.')
      else setStage({ kind: 'bad-link', message: linkProblem(code) })
      setBusy(false)
      return
    }
    try {
      await signIn(stage.email, password)
      navigate('/report', { replace: true })
    } catch {
      // Password is saved either way — fall back to the normal sign-in page.
      navigate('/login', { replace: true })
    }
  }

  const inputCls =
    'h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-charcoal)] outline-none transition focus:border-[var(--color-coral)] focus:ring-2 focus:ring-[var(--color-coral)]/30'

  return (
    <div className="grid min-h-svh place-items-center bg-[var(--color-cream)] px-4">
      <Card accent="coral" className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <img src="/brand/bb-logo-full.png" alt="Bright Beginnings Preschool" className="w-full max-w-[280px]" />
          <div className="text-center">
            <h1 className="font-brand text-xl font-medium text-[var(--color-charcoal)]">Set your password</h1>
            {stage.kind === 'ready' && (
              <p className="mt-1 text-sm text-[var(--color-dk-gray)]">
                for <span className="font-semibold">{stage.email}</span>
              </p>
            )}
          </div>

          {stage.kind === 'checking' && (
            <img src="/brand/bb-tree.png" alt="Checking your link" className="size-10 animate-pulse object-contain" />
          )}

          {stage.kind === 'bad-link' && (
            <div className="flex w-full flex-col items-center gap-4 text-center">
              <p className="w-full rounded-lg bg-[var(--color-critical-soft)] px-3 py-2 text-sm text-[var(--color-critical)]">
                {stage.message}
              </p>
              <p className="text-sm text-[var(--color-dk-gray)]">
                No problem: on the sign-in page, enter your email and tap “Forgot password?” for a fresh link.
              </p>
              <Link to="/login" className={buttonVariants({ className: 'w-full' })}>
                Go to sign in
              </Link>
            </div>
          )}

          {stage.kind === 'ready' && (
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
              {/* Lets password managers save the new password against the right account. */}
              <input type="email" autoComplete="username" value={stage.email} readOnly hidden />
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
                  New password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder={`At least ${MIN_LENGTH} characters`}
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
                  Type it again
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls}
                />
              </label>

              {error && (
                <p className="rounded-lg bg-[var(--color-critical-soft)] px-3 py-2 text-sm text-[var(--color-critical)]">
                  {error}
                </p>
              )}

              <Button type="submit" className="mt-1 w-full" disabled={busy}>
                {busy ? 'Saving…' : 'Save and sign in'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
