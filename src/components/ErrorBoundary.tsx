import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface State {
  error: Error | null
}

/** Catches render errors so a single bad screen never white-screens the app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-svh place-items-center bg-[var(--color-cream)] px-4">
        <Card accent="coral" className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <img src="/brand/bird-sky.png" alt="" className="size-12 object-contain" />
            <div>
              <h1 className="text-xl font-extrabold text-[var(--color-charcoal)]">
                Something went sideways
              </h1>
              <p className="mt-1 text-sm text-[var(--color-dk-gray)]">
                That screen hit an error. Reloading usually fixes it.
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
