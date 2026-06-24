import { ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SITES } from '@/lib/schema'

/** Phase 1 placeholder shell. The full validated, autosaving form lands in Phase 3. */
export function Report() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-coral)] text-white">
          <ClipboardList className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">
            Today&rsquo;s Report
          </h1>
          <p className="text-sm text-[var(--color-dk-gray)]">{today}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {SITES.map((site, i) => (
          <Card key={site.id} accent={(['coral', 'yellow', 'sky'] as const)[i % 3]}>
            <CardHeader>
              <CardTitle>{site.name}</CardTitle>
              <CardDescription>Awaiting today&rsquo;s entry</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="inline-flex rounded-full bg-[var(--color-secondary)] px-3 py-1 text-xs font-semibold text-[var(--color-dk-gray)]">
                Not started
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card accent="yellow">
        <CardContent className="p-6 text-sm text-[var(--color-dk-gray)]">
          The full daily form — attendance, labor, enrollment, staff, packet, and the
          director report — arrives in Phase 3, with autosave, validation, and a
          celebration when you submit.
        </CardContent>
      </Card>
    </div>
  )
}
