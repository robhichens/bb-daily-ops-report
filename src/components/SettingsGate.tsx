import { useEffect, useState, type ReactNode } from 'react'
import { applyConfig } from '@/lib/appConfig'
import { cachedConfig, loadConfig } from '@/lib/appConfigStore'

/** Applies the Customize page settings once, right after sign-in and before any
 *  page renders (forms, dashboard and print all read them). If Firestore is slow
 *  or offline it falls back to the last settings this device saw, then to the
 *  built-in defaults — the app never waits more than a few seconds. */
export function SettingsGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let done = false
    const finish = (v: Awaited<ReturnType<typeof loadConfig>>) => {
      if (done) return
      done = true
      if (v) {
        try { applyConfig(v.config) } catch (e) { console.error('Settings could not be applied; using defaults', e) }
      }
      setReady(true)
    }
    const timer = setTimeout(() => finish(cachedConfig()), 4000)
    loadConfig().then(finish).catch(() => finish(cachedConfig())).finally(() => clearTimeout(timer))
    return () => clearTimeout(timer)
  }, [])

  if (!ready) {
    return (
      <div className="grid min-h-svh place-items-center bg-[var(--color-cream)]">
        <img src="/brand/bb-tree.png" alt="" className="size-16 animate-pulse object-contain" />
      </div>
    )
  }
  return <>{children}</>
}
