import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin as isAdminRole, userSites } from '@/lib/users'
import { SITES, type SiteId } from '@/lib/schema'
import { todayIso, formatLong } from '@/lib/dates'
import { ReportForm } from '@/components/report/ReportForm'

export function Report() {
  const { user, profile } = useAuth()
  const admin = isAdminRole(profile?.role)

  // Admins can file for any school; directors only for the schools they're
  // granted (usually one, sometimes two).
  const allowed = admin ? SITES : SITES.filter((s) => userSites(profile).includes(s.id))
  const sites = allowed.length > 0 ? allowed : SITES
  const [siteId, setSiteId] = useState<SiteId>(sites[0].id)
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
        sites={sites}
        uid={user?.uid ?? ''}
        onSite={setSiteId}
        onDate={setDate}
      />
    </div>
  )
}
