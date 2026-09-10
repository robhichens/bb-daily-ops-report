import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Check, Lock, Pencil, Loader2, CloudOff, Eye } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { reportAccessLevel } from '@/lib/users'
import { ORG_DEFS, reportMeta } from '@/lib/reportRegistry'
import { matrixCellKey } from '@/lib/schema'
import type { FieldKind, MatrixDef, OrgReport as TOrgReport, OrgReportDef, OrgSectionDef } from '@/lib/schema'
import {
  getOrgReport, upsertOrgDraft, submitOrgReport, emptyOrgReport,
} from '@/lib/orgReports'
import { todayIso, formatLong } from '@/lib/dates'
import { weekdayName } from '@/lib/derive'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NotesLedger } from '@/components/report/NotesLedger'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function OrgReport() {
  const { key = '' } = useParams()
  const { user, profile } = useAuth()
  const def = ORG_DEFS[key as 'adr' | 'mdr' | 'edr']
  const [date, setDate] = useState(todayIso())

  if (!def) return <Navigate to="/dashboard" replace />
  const access = reportAccessLevel(profile, def.key)
  if (!access) return <Navigate to="/dashboard" replace />

  const meta = reportMeta(def.key)!
  const Icon = meta.icon
  const author = profile?.displayName || user?.email || 'Report'
  const readOnly = access === 'view'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-charcoal)] text-white">
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">{def.title}</h1>
          <p className="text-sm text-[var(--color-dk-gray)]">
            {formatLong(date)} · org-wide{readOnly && ' · view only'}
          </p>
        </div>
      </div>

      <OrgForm def={def} date={date} onDate={setDate} uid={user?.uid ?? ''} author={author} readOnly={readOnly} />
      <NotesLedger source={def.key} author={author} uid={user?.uid ?? ''} readOnly={readOnly} />
    </div>
  )
}

function OrgForm({
  def, date, onDate, uid, author, readOnly,
}: {
  def: OrgReportDef
  date: string
  onDate: (d: string) => void
  uid: string
  author: string
  readOnly: boolean
}) {
  const [draft, setDraft] = useState<TOrgReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [editing, setEditing] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setEditing(false); setSaveState('idle')
    ;(async () => {
      let remote: TOrgReport | null = null
      try { remote = await getOrgReport(def.collection, date) } catch { /* offline */ }
      if (!cancelled) {
        setDraft(remote ?? emptyOrgReport(def, date, uid))
        setLoading(false)
      }
    })()
    return () => { cancelled = true; if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [def, date, uid])

  const locked = readOnly || (!!draft && draft.status === 'submitted' && !editing)

  const setField = useCallback((section: string, field: string, value: number | string) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next: TOrgReport = {
        ...prev,
        completedBy: prev.completedBy || author,
        data: { ...prev.data, [section]: { ...prev.data[section], [field]: value } },
      }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(async () => {
        try { await upsertOrgDraft(def.collection, next); setSaveState('saved') }
        catch { setSaveState('error') }
      }, 700)
      return next
    })
  }, [author, def.collection])

  async function handleSubmit() {
    if (!draft) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      await submitOrgReport(def.collection, { ...draft, completedBy: draft.completedBy || author }, uid)
      setDraft((p) => (p ? { ...p, status: 'submitted', submittedAt: new Date().toISOString() } : p))
      setEditing(false); setSaveState('idle')
    } catch { setSaveState('error') }
  }

  if (loading || !draft) {
    return <div className="grid place-items-center py-16"><img src="/brand/bb-tree.png" alt="" className="size-10 animate-pulse object-contain" /></div>
  }

  const submitted = draft.status === 'submitted'

  return (
    <div className="space-y-5">
      <Card accent="gray" className="flex flex-wrap items-end justify-between gap-4 p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">Date</span>
          <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="w-auto" />
          <span className="text-xs text-[var(--color-mid-gray)]">{weekdayName(date)}</span>
        </label>
        {readOnly ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-dk-gray)]"><Eye className="size-4" /> View only</span>
        ) : submitted && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-good)]">
              <Check className="size-4" /> Filed
              {locked && <span className="ml-1 inline-flex items-center gap-1 text-[var(--color-dk-gray)]"><Lock className="size-3.5" /> read-only</span>}
            </span>
            {locked && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="size-3.5" /> Edit</Button>}
          </div>
        )}
      </Card>

      {def.sections.map((s) => (
        <SectionCard key={s.key} def={def} section={s} draft={draft} locked={locked} setField={setField} />
      ))}

      {!locked && (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-cream)]/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <SaveIndicator state={saveState} />
          <Button onClick={() => void handleSubmit()} className="min-w-32">{submitted ? 'Re-file' : 'File report'}</Button>
        </div>
      )}
    </div>
  )
}

function SectionCard({
  def, section, draft, locked, setField,
}: {
  def: OrgReportDef
  section: OrgSectionDef
  draft: TOrgReport
  locked: boolean
  setField: (section: string, field: string, value: number | string) => void
}) {
  const vals = draft.data[section.key] ?? {}
  return (
    <Card accent={def.accent} className="p-5">
      <div className="mb-4">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-charcoal)]">{section.title}</h2>
        {section.hint && <p className="mt-0.5 text-xs text-[var(--color-dk-gray)]">{section.hint}</p>}
      </div>
      {section.matrix ? (
        <MatrixGrid
          matrix={section.matrix}
          vals={vals}
          disabled={locked}
          onChange={(cellKey, v) => setField(section.key, cellKey, v)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {section.fields.map((f) => (
            <ValueField
              key={f.key}
              label={f.label}
              kind={f.kind}
              value={vals[f.key] ?? (f.kind === 'text' ? '' : 0)}
              disabled={locked}
              onChange={(v) => setField(section.key, f.key, v)}
            />
          ))}
        </div>
      )}
      {section.note && (
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">Note</span>
          <Input
            value={String(vals.note ?? '')}
            disabled={locked}
            placeholder="Any detail worth flagging…"
            onChange={(e) => setField(section.key, 'note', e.target.value)}
          />
        </label>
      )}
    </Card>
  )
}

/** Row (e.g. classroom) × column (e.g. site) number grid. Cell values live
 *  flat in the section's data, keyed by `matrixCellKey(colKey, rowKey)`. */
function MatrixGrid({
  matrix, vals, disabled, onChange,
}: {
  matrix: MatrixDef
  vals: Record<string, number | string>
  disabled: boolean
  onChange: (cellKey: string, value: number) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[420px] items-center gap-x-3 gap-y-2"
        style={{ gridTemplateColumns: `minmax(104px,1fr) repeat(${matrix.columns.length}, minmax(76px,1fr))` }}
      >
        <div />
        {matrix.columns.map((c) => (
          <div key={c.key} className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">
            {c.label}
          </div>
        ))}
        {matrix.rows.flatMap((r) => [
          <div key={`${r.key}-label`} className="leading-tight">
            <div className="text-sm font-semibold text-[var(--color-charcoal)]">{r.label}</div>
            {r.sub && <div className="text-[10px] text-[var(--color-mid-gray)]">{r.sub}</div>}
          </div>,
          ...matrix.columns.map((c) => {
            const cellKey = matrixCellKey(c.key, r.key)
            const raw = vals[cellKey]
            const value = typeof raw === 'number' ? raw : 0
            return (
              <Input
                key={cellKey}
                type="number"
                inputMode="numeric"
                step="1"
                value={value === 0 ? '' : value}
                placeholder="0"
                disabled={disabled}
                onChange={(e) => {
                  const raw2 = e.target.value
                  const n = raw2 === '' ? 0 : parseInt(raw2, 10)
                  if (!Number.isNaN(n)) onChange(cellKey, n)
                }}
                className="h-9 px-2 text-center font-semibold"
              />
            )
          }),
        ])}
      </div>
    </div>
  )
}

function ValueField({
  label, kind, value, disabled, onChange,
}: {
  label: string
  kind: FieldKind
  value: number | string
  disabled: boolean
  onChange: (v: number | string) => void
}) {
  if (kind === 'text') {
    return (
      <label className="col-span-2 flex flex-col gap-1 sm:col-span-3 lg:col-span-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">{label}</span>
        <Input value={String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </label>
    )
  }
  const isDollar = kind === 'dollar'
  const parse = (raw: string): number | null => {
    if (raw === '') return 0
    const n = kind === 'count' ? parseInt(raw, 10) : parseFloat(raw)
    if (Number.isNaN(n)) return null
    if ((kind === 'count' || kind === 'dollar') && n < 0) return null // number allows negatives
    return n
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">{label}</span>
      <div className="relative">
        {isDollar && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-mid-gray)]">$</span>}
        <Input
          type="number"
          inputMode={kind === 'count' ? 'numeric' : 'decimal'}
          step={kind === 'count' ? '1' : 'any'}
          value={value === 0 ? '' : value}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => { const n = parse(e.target.value); if (n !== null) onChange(n) }}
          className={cn('h-10 font-semibold', isDollar && 'pl-6')}
        />
      </div>
    </label>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    idle: { icon: null, text: 'Autosaves as you type', cls: 'text-[var(--color-mid-gray)]' },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…', cls: 'text-[var(--color-dk-gray)]' },
    saved: { icon: <Check className="size-3.5" />, text: 'Draft saved', cls: 'text-[var(--color-good)]' },
    error: { icon: <CloudOff className="size-3.5" />, text: 'Save failed — retry', cls: 'text-[var(--color-coral-dark)]' },
  }[state]
  return <span className={cn('flex items-center gap-1.5 text-xs font-semibold', map.cls)}>{map.icon}{map.text}</span>
}
