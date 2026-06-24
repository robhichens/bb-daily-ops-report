import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/** Phase 1 placeholder. Real email/password auth lands in Phase 2. */
export function Login() {
  const navigate = useNavigate()
  return (
    <div className="grid min-h-svh place-items-center bg-[var(--color-cream)] px-4">
      <Card accent="coral" className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <img
            src="/brand/bb-logo-full.png"
            alt="Bright Beginnings Preschool"
            className="w-full max-w-[280px]"
          />
          <div>
            <h1 className="font-brand text-xl font-medium text-[var(--color-charcoal)]">
              Daily Ops Report
            </h1>
            <p className="mt-1 text-sm text-[var(--color-dk-gray)]">
              Sign-in coming in Phase 2
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
