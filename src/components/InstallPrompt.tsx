import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Dual-path "install this app" banner (PWA Phase 1).
 *
 *  - Android / desktop Chrome: capture `beforeinstallprompt`, suppress the default
 *    mini-infobar, and show an in-app Install button that calls prompt() on click.
 *  - iOS Safari: no beforeinstallprompt exists — show a dismissible hint pointing at
 *    Share → Add to Home Screen.
 *
 * Never shows when already running installed (standalone). Dismissal persists for the
 * browser session so it does not nag.
 */

// `beforeinstallprompt` isn't in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'bb-dor-install-dismissed'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone when launched from the home screen.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as "Macintosh" — distinguish by touch support.
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  const isWebkit = /webkit/i.test(ua)
  // Exclude Chrome/Firefox/Edge/Opera on iOS — the Share→Add flow is Safari-only.
  const isRealSafari = !/crios|fxios|edgios|opios/i.test(ua)
  return isIos && isWebkit && isRealSafari
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (dismissed || isStandalone()) return

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault() // suppress the default mini-infobar
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      // Installed mid-session — clear both paths immediately.
      setDeferred(null)
      setShowIosHint(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // iOS has no install event — decide the hint up front.
    if (isIosSafari()) setShowIosHint(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [dismissed])

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* sessionStorage unavailable — dismiss for this render only */
    }
    setDismissed(true)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null) // the event can only be used once
  }

  if (dismissed || isStandalone()) return null
  if (!deferred && !showIosHint) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border-l-[5px] border-[var(--color-coral)] bg-white p-4 shadow-lg ring-1 ring-black/5">
        <img
          src="/icons/pwa-192.png"
          alt=""
          className="size-10 shrink-0 rounded-lg"
          width={40}
          height={40}
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--color-charcoal)]">Install Daily Ops</p>
          {deferred ? (
            <p className="text-xs text-[var(--color-dk-gray)]">
              Add it to your home screen for one-tap access.
            </p>
          ) : (
            <p className="text-xs text-[var(--color-dk-gray)]">
              Tap <ShareGlyph /> then{' '}
              <span className="font-semibold text-[var(--color-charcoal)]">Add to Home Screen</span>.
            </p>
          )}
        </div>

        {deferred && (
          <Button size="sm" onClick={install}>
            Install
          </Button>
        )}

        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-[var(--color-mid-gray)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-charcoal)]"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/** The iOS system "Share" glyph (box with an up arrow), inline in the hint text. */
function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mx-0.5 inline size-4 -translate-y-px text-[var(--color-sky-deep)]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Share"
    >
      <path d="M12 16V4m0 0L8 8m4-4l4 4" />
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}
