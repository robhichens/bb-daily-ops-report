import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, CloudOff, Loader2, Lock, Pencil, TriangleAlert } from 'lucide-react'
import {
  emptyReport,
  reportDocId,
  type DailyOpsReport,
  type SiteId,
} from '@/lib/schema'
import { withDerived } from '@/lib/derive'
import { getReport, upsertDraft, submitReport, validateForSubmit } from '@/lib/reports'
import { readLocalDraft, writeLocalDraft, clearLocalDraft, reconcile } from '@/lib/localMirror'
import { formatLong } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { HeaderSection } from './HeaderSection'
import { AttendanceSection } from './AttendanceSection'
import { LaborSection } from './LaborSection'
import { EnrollmentMarketingSection } from './EnrollmentMarketingSection'
import { StaffSection } from './StaffSection'
import { DirectorPacketSection } from './DirectorPacketSection'
import { DirectorReportList } from './DirectorReportList'
import { CelebrationOverlay } from './CelebrationOverlay'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface ReportFormProps {
  siteId: SiteId
  date: string
  isAdmin: boolean
  uid: string
  onSite: (s: SiteId) => void
  onDate: (d: string) => void
}

export function ReportForm({ siteId, date, isAdmin, uid, onSite, onDate }: ReportFormProps) {
  const [draft, setDraft] = useState<DailyOpsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [adminEditing, setAdminEditing] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const id = reportDocId(siteId, date)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrors([])
    setAdminEditing(false)
    setSaveState('idle')
    ;(async () => {
      let remote: DailyOpsReport | null = null
      try {
        remote = await getReport(siteId, date)
      } catch {
        /* offline — fall back to local mirror */
      }
      const local = readLocalDraft(id)
      const chosen = reconcile(remote, local) ?? emptyReport(siteId, date, uid)
      if (!cancelled) {
        setDraft(withDerived(chosen))
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const locked = useMemo(() => {
    if (!draft) return true
    if (draft.status === 'submitted') return isAdmin ? !adminEditing : true
    return false
  }, [draft, isAdmin, adminEditing])

  const update = useCallback(
    (patch: Partial<DailyOpsReport>) => {
      setDraft((prev) => {
        if (!prev) return prev
        const next = withDerived({ ...prev, ...patch })
        writeLocalDraft(next)
        if (saveTimer.current) clearTimeout(saveTimer.current)
        setSaveState('saving')
        saveTimer.current = setTimeout(async () => {
          try {
            await upsertDraft(next)
            setSaveState('saved')
          } catch {
            setSaveState('error')
          }
        }, 800)
        return next
      })
    },
    []
  )

  async function handleSubmit() {
    if (!draft) return
    setErrors([])
    const check = validateForSubmit(draft)
    if (!check.ok) {
      setErrors(check.errors)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSubmitting(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const result = await submitReport(draft, uid)
    setSubmitting(false)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    clearLocalDraft(id)
    const now = new Date().toISOString()
    setDraft((prev) =>
      prev
        ? withDerived({
            ...prev,
            directorReport: prev.directorReport.map((s) => s.trim()).filter(Boolean),
            status: 'submitted',
            submittedAt: now,
            updatedAt: now,
          })
        : prev
    )
    setSaveState('idle')
    setAdminEditing(false)
    setCelebrate(true)
  }

  if (loading || !draft) {
    return (
      <div className="grid place-items-center py-24">
        <img src="/brand/bb-tree.png" alt="" className="size-12 animate-pulse object-contain" />
      </div>
    )
  }

  const submitted = draft.status === 'submitted'

  return (
    <div className="space-y-5">
      <CelebrationOverlay show={celebrate} onDone={() => setCelebrate(false)} />

      {/* Status banner for an already-submitted report */}
      {submitted && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{ background: 'var(--color-good-soft)' }}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-good)]">
            <Check className="size-4" />
            Submitted{draft.submittedAt ? ` · ${formatLong(date)}` : ''}
            {locked && (
              <span className="ml-1 inline-flex items-center gap-1 text-[var(--color-dk-gray)]">
                <Lock className="size-3.5" /> read-only
              </span>
            )}
          </span>
          {isAdmin && locked && (
            <Button size="sm" variant="outline" onClick={() => setAdminEditing(true)}>
              <Pencil className="size-3.5" /> Edit report
            </Button>
          )}
        </div>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[var(--color-critical)]/30 bg-[var(--color-critical-soft)] p-4"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--color-critical)]">
            <TriangleAlert className="size-4" /> Please fix before submitting:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--color-critical)]">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </motion.div>
      )}

      <HeaderSection
        siteId={draft.siteId}
        date={draft.date}
        director={draft.director}
        onSite={onSite}
        onDate={onDate}
        onDirector={(name) => update({ director: name })}
        canEditSite={isAdmin}
        disabled={locked}
      />
      <AttendanceSection
        value={draft.attendance}
        onChange={(attendance) => update({ attendance })}
        disabled={locked}
      />
      <LaborSection value={draft.labor} onChange={(labor) => update({ labor })} disabled={locked} />
      <EnrollmentMarketingSection
        value={draft.enrollmentMarketing}
        onChange={(enrollmentMarketing) => update({ enrollmentMarketing })}
        disabled={locked}
      />
      <StaffSection value={draft.staff} onChange={(staff) => update({ staff })} disabled={locked} />
      <DirectorPacketSection
        value={draft.directorPacket}
        onChange={(directorPacket) => update({ directorPacket })}
        disabled={locked}
      />
      <DirectorReportList
        value={draft.directorReport}
        onChange={(directorReport) => update({ directorReport })}
        disabled={locked}
      />

      {/* Action bar */}
      {!locked && (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-cream)]/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <SaveIndicator state={saveState} />
          <Button onClick={handleSubmit} disabled={submitting} className="min-w-32">
            {submitting ? 'Submitting…' : submitted ? 'Re-submit' : 'Submit report'}
          </Button>
        </div>
      )}
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    idle: { icon: null, text: '', cls: 'text-[var(--color-mid-gray)]' },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…', cls: 'text-[var(--color-dk-gray)]' },
    saved: { icon: <Check className="size-3.5" />, text: 'Draft saved', cls: 'text-[var(--color-good)]' },
    error: { icon: <CloudOff className="size-3.5" />, text: 'Saved offline — will sync', cls: 'text-[var(--color-coral-dark)]' },
  }[state]
  if (!map.text) return <span className="text-xs text-[var(--color-mid-gray)]">Autosaves as you type</span>
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold ${map.cls}`}>
      {map.icon} {map.text}
    </span>
  )
}
