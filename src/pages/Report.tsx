import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin as isAdminRole, userSites } from '@/lib/users'
import { SITES, type SiteId } from '@/lib/schema'
import { todayIso, formatLong } from '@/lib/dates'
import { ReportForm } from '@/components/report/ReportForm'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function Report() {
  const { user, profile } = useAuth()
  const admin = isAdminRole(profile?.role)
  const [params] = useSearchParams()

  // Admins can file for any school; directors only for the schools they're
  // granted (usually one, sometimes two).
  const allowed = admin ? SITES : SITES.filter((s) => userSites(profile).includes(s.id))
  const sites = allowed.length > 0 ? allowed : SITES

  // Day Notes deep-links here with ?site=&date= — honor them, but only for a
  // school this user may view, and only a well-formed date.
  const wantSite = params.get('site') as SiteId | null
  const wantDate = params.get('date')
  const initialSite = sites.find((s) => s.id === wantSite)?.id ?? sites[0].id
  const initialDate = wantDate && ISO_DATE.test(wantDate) ? wantDate : todayIso()

  const [siteId, setSiteId] = useState<SiteId>(initialSite)
  const [date, setDate] = useState<string>(initialDate)

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
