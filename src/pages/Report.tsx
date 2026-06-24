import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin as isAdminRole } from '@/lib/users'
import { SITES, type SiteId } from '@/lib/schema'
import { todayIso, formatLong } from '@/lib/dates'
import { ReportForm } from '@/components/report/ReportForm'

export function Report() {
  const { user, profile } = useAuth()
  const admin = isAdminRole(profile?.role)

  // Directors are scoped to their assigned site; admins default to the first.
  const [siteId, setSiteId] = useState<SiteId>(profile?.siteId ?? SITES[0].id)
  const [date, setDate] = useState<string>(todayIso())

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-coral)] text-white">
          <ClipboardList className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">
            Daily Ops Report
          </h1>
          <p className="text-sm text-[var(--color-dk-gray)]">{formatLong(date)}</p>
        </div>
      </div>

      <ReportForm
        siteId={siteId}
        date={date}
        isAdmin={admin}
        uid={user?.uid ?? ''}
        onSite={setSiteId}
        onDate={setDate}
      />
    </div>
  )
}
