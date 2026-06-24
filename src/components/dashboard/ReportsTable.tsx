import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Table2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  ENROLLMENT_FIELDS,
  STAFF_FIELDS,
  type CountNote,
  type DailyOpsReport,
} from '@/lib/schema'
import { formatShort } from '@/lib/dates'

export function ReportsTable({ rows }: { rows: DailyOpsReport[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.siteName.localeCompare(b.siteName)))

  return (
    <Card accent="gray" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-5">
        <Table2 className="size-4 text-[var(--color-dk-gray)]" />
        <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-dk-gray)]">
          Reports ({sorted.length})
        </h2>
      </div>

      {sorted.length === 0 ? (
        <p className="p-5 text-sm text-[var(--color-dk-gray)]">No reports for this selection yet.</p>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {/* header */}
          <div className="hidden grid-cols-[90px_1fr_1fr_70px_70px_70px_28px] gap-2 bg-[var(--color-cream)] px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)] sm:grid">
            <span>Date</span><span>Site</span><span>Director</span>
            <span className="text-right">Attend.</span><span className="text-right">OT</span><span className="text-right">Quality</span><span />
          </div>

          {sorted.map((r) => {
            const isOpen = open === r.id
            return (
              <div key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="grid w-full grid-cols-[1fr_28px] items-center gap-2 px-5 py-3 text-left text-sm hover:bg-[var(--color-secondary)] sm:grid-cols-[90px_1fr_1fr_70px_70px_70px_28px]"
                >
                  <span className="font-semibold text-[var(--color-charcoal)]">{formatShort(r.date)}</span>
                  <span className="text-[var(--color-charcoal)]">{r.siteName}</span>
                  <span className="hidden truncate text-[var(--color-dk-gray)] sm:block">{r.director || '—'}</span>
                  <span className="hidden text-right font-semibold text-[var(--color-charcoal)] sm:block">{r.attendance.total}</span>
                  <span className="hidden text-right text-[var(--color-dk-gray)] sm:block">{r.labor.overtimeHours}</span>
                  <span className="hidden text-right font-semibold sm:block" style={{ color: (r.qualityScore ?? 0) >= 80 ? 'var(--color-good)' : 'var(--color-dk-gray)' }}>
                    {r.qualityScore ?? 0}
                  </span>
                  <ChevronDown className={`size-4 justify-self-end text-[var(--color-mid-gray)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-[var(--color-cream)]"
                    >
                      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
                        <NotesBlock title="Enrollment / Marketing" entries={ENROLLMENT_FIELDS.map((f) => ({ label: f.label, c: r.enrollmentMarketing[f.key as keyof typeof r.enrollmentMarketing] }))} />
                        <NotesBlock title="Staff" entries={STAFF_FIELDS.map((f) => ({ label: f.label, c: r.staff[f.key as keyof typeof r.staff] }))} />
                        {r.directorReport.filter(Boolean).length > 0 && (
                          <div className="md:col-span-2">
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-coral-dark)]">Director Report</p>
                            <ol className="list-inside list-decimal space-y-0.5 text-sm text-[var(--color-charcoal)]">
                              {r.directorReport.filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
                            </ol>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function NotesBlock({ title, entries }: { title: string; entries: { label: string; c: CountNote }[] }) {
  const filled = entries.filter((e) => e.c.count > 0 || e.c.notes.trim())
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-dk-gray)]">{title}</p>
      {filled.length === 0 ? (
        <p className="text-xs text-[var(--color-mid-gray)]">Nothing logged.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {filled.map((e) => (
            <li key={e.label} className="text-[var(--color-charcoal)]">
              <span className="font-semibold">{e.label}: {e.c.count}</span>
              {e.c.notes.trim() && <span className="text-[var(--color-dk-gray)]"> — {e.c.notes}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
