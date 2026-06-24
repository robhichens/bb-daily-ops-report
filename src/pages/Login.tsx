import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/** Phase 1 placeholder. Real email/password auth lands in Phase 2. */
export function Login() {
  const navigate = useNavigate()
  return (
    <div className="grid min-h-svh place-items-center bg-[var(--color-cream)] px-4">
      <Card accent="orange" className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-[var(--color-navy)] text-[var(--color-cream)]">
            <Sparkles className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-navy)]">
              Daily Ops Report
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-ink)]">
              Bright Beginnings · sign-in coming in Phase 2
            </p>
          </div>
          <Button className="w-full" onClick={() => navigate('/report')}>
            Continue to the app
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
