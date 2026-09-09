import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Wallet, Check, Lock, Pencil, Loader2, CloudOff, Eye, ChevronDown, X,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { reportAccessLevel } from '@/lib/users'
import {
  SITES, FINANCE_AGENCIES,
  totalBilling, totalOutstanding, subtotalDeposits, totalDeposits,
  emptyFinanceReport,
  type FinanceReport as TFinanceReport, type FinanceLocation, type FinanceLine,
  type AgencyLine, type DeclineRefund, type SiteId,
} from '@/lib/schema'
import { getFinanceReport, upsertFinanceDraft, submitFinanceReport } from '@/lib/finance'
import { todayIso, formatLong } from '@/lib/dates'
import { weekdayName } from '@/lib/derive'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NotesLedger } from '@/components/report/NotesLedger'
import { cn } from '@/lib/utils'

const money = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function FinanceReport() {
  const { user, profile } = useAuth()
  const [date, setDate] = useState(todayIso())
  const author = profile?.displayName || user?.email || 'Finance'

  const access = reportAccessLevel(profile, 'fdr')
  if (!access) return <Navigate to="/dashboard" replace />
  const readOnly = access === 'view'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-sky-deep)] text-white"><Wallet className="size-5" /></span>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">Finance Report</h1>
          <p className="text-sm text-[var(--color-dk-gray)]">{formatLong(date)} · per location{readOnly && ' · view only'}</p>
        </div>
      </div>

      <FinanceForm date={date} onDate={setDate} uid={user?.uid ?? ''} author={author} readOnly={readOnly} />
      <NotesLedger source="fdr" author={author} uid={user?.uid ?? ''} readOnly={readOnly} />
    </div>
  )
}

function FinanceForm({
  date, onDate, uid, author, readOnly,
}: { date: string; onDate: (d: string) => void; uid: string; author: string; readOnly: boolean }) {
  const [draft, setDraft] = useState<TFinanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [editing, setEditing] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setEditing(false); setSaveState('idle')
    ;(async () => {
      let remote: TFinanceReport | null = null
      try { remote = await getFinanceReport(date) } catch { /* offline */ }
      if (!cancelled) { setDraft(remote ?? emptyFinanceReport(date, uid)); setLoading(false) }
    })()
    return () => { cancelled = true; if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [date, uid])

  const locked = readOnly || (!!draft && draft.status === 'submitted' && !editing)

  const setLoc = useCallback((siteId: SiteId, patch: Partial<FinanceLocation>) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next: TFinanceReport = {
        ...prev,
        completedBy: prev.completedBy || author,
        locations: { ...prev.locations, [siteId]: { ...prev.locations[siteId], ...patch } },
      }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(async () => {
        try { await upsertFinanceDraft(next); setSaveState('saved') } catch { setSaveState('error') }
      }, 700)
      return next
    })
  }, [author])

  async function handleSubmit() {
    if (!draft) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      await submitFinanceReport({ ...draft, completedBy: draft.completedBy || author }, uid)
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

      {/* BILLING */}
      <div>
        <SectionHeader title="Billing" accent="coral" />
        <div className="space-y-2">
          {SITES.map((s) => {
            const loc = draft.locations[s.id]
            return (
              <LocationPanel key={s.id} name={s.name} rightLabel="Total Billing" rightValue={money(totalBilling(loc))} accent="coral">
                <BillingFields loc={loc} disabled={locked} onLoc={(p) => setLoc(s.id, p)} />
              </LocationPanel>
            )
          })}
        </div>
      </div>

      {/* DEPOSITS */}
      <div>
        <SectionHeader title="Deposits" accent="sky" />
        <div className="space-y-2">
          {SITES.map((s) => {
            const loc = draft.locations[s.id]
            return (
              <LocationPanel key={s.id} name={s.name} rightLabel="Total Deposits" rightValue={money(totalDeposits(loc))} accent="sky">
                <DepositFields loc={loc} disabled={locked} onLoc={(p) => setLoc(s.id, p)} />
              </LocationPanel>
            )
          })}
        </div>
      </div>

      {!locked && (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-cream)]/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <SaveIndicator state={saveState} />
          <Button onClick={() => void handleSubmit()} className="min-w-32">{submitted ? 'Re-file' : 'File report'}</Button>
        </div>
      )}
    </div>
  )
}

// --- Section + collapsible location ----------------------------------------

const ACCENT_COLOR: Record<string, string> = {
  coral: 'var(--color-coral)', sky: 'var(--color-sky-deep)', yellow: 'var(--color-coral-dark)', gray: 'var(--color-dk-gray)',
}

function SectionHeader({ title, accent }: { title: string; accent: 'coral' | 'sky' }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-4 w-1 rounded" style={{ background: ACCENT_COLOR[accent] }} />
      <h2 className="text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: ACCENT_COLOR[accent] }}>{title}</h2>
    </div>
  )
}

function LocationPanel({
  name, rightLabel, rightValue, accent, children,
}: { name: string; rightLabel: string; rightValue: string; accent: 'coral' | 'sky'; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Card accent={accent} className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--color-secondary)]"
      >
        <ChevronDown className={cn('size-4 shrink-0 text-[var(--color-mid-gray)] transition-transform', open && 'rotate-180')} />
        <span className="font-semibold text-[var(--color-charcoal)]">{name}</span>
        <span className="ml-auto text-right">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-mid-gray)]">{rightLabel}</span>
          <span className="block font-brand text-base font-medium text-[var(--color-charcoal)]">{rightValue}</span>
        </span>
      </button>
      {open && <div className="border-t border-[var(--color-border)] p-5">{children}</div>}
    </Card>
  )
}

// --- Billing ----------------------------------------------------------------

function BillingFields({ loc, disabled, onLoc }: { loc: FinanceLocation; disabled: boolean; onLoc: (p: Partial<FinanceLocation>) => void }) {
  return (
    <div className="space-y-5">
      <LineList label="Tuition Charges" hint="Charged to the Procare ledger (prorate or full)" whoPlaceholder="Who" whatPlaceholder="What for"
        value={loc.tuitionCharges} disabled={disabled} onChange={(tuitionCharges) => onLoc({ tuitionCharges })} />
      <LineList label="Other Charges" hint="Reg / Enhancement / Late / CC-decline fees" whoPlaceholder="Who" whatPlaceholder="What for"
        value={loc.otherCharges} disabled={disabled} onChange={(otherCharges) => onLoc({ otherCharges })} />
      <LineList label="Credits" hint="Any credits added to the ledger (subtracts from billing)" whoPlaceholder="Who" whatPlaceholder="What for"
        value={loc.credits} disabled={disabled} onChange={(credits) => onLoc({ credits })} />

      <TotalRow label="Total Billing" value={money(totalBilling(loc))} strong />

      <div className="space-y-3 rounded-xl bg-[var(--color-secondary)]/50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-dk-gray)]">Tuition Money Outstanding (as of today)</p>
        <OutstandingRow label="Current families" value={loc.outstandingCurrent} disabled={disabled}
          onChange={(outstandingCurrent) => onLoc({ outstandingCurrent })} />
        <OutstandingRow label="Former families" value={loc.outstandingFormer} disabled={disabled}
          onChange={(outstandingFormer) => onLoc({ outstandingFormer })} />
        <TotalRow label="Total Outstanding" value={money(totalOutstanding(loc))} />
      </div>
    </div>
  )
}

// --- Deposits ---------------------------------------------------------------

function DepositFields({ loc, disabled, onLoc }: { loc: FinanceLocation; disabled: boolean; onLoc: (p: Partial<FinanceLocation>) => void }) {
  const te = loc.tuitionExpress
  return (
    <div className="space-y-5">
      <LineList label="Payment by Check" whoPlaceholder="Who paid" whatPlaceholder="For what"
        value={loc.paymentsByCheck} disabled={disabled} onChange={(paymentsByCheck) => onLoc({ paymentsByCheck })} />
      <AgencyLineList label="Payment by Agency" value={loc.paymentsByAgency} disabled={disabled}
        onChange={(paymentsByAgency) => onLoc({ paymentsByAgency })} />

      <div>
        <p className="mb-2 text-sm font-bold text-[var(--color-charcoal)]">Tuition Express <span className="font-normal text-[var(--color-dk-gray)]">— daily totals</span></p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MoneyField label="ACH Batch" value={te.achBatch} disabled={disabled} onChange={(achBatch) => onLoc({ tuitionExpress: { ...te, achBatch } })} />
          <MoneyField label="CC Batch" value={te.ccBatch} disabled={disabled} onChange={(ccBatch) => onLoc({ tuitionExpress: { ...te, ccBatch } })} />
          <MoneyField label="CC POS" value={te.ccPos} disabled={disabled} onChange={(ccPos) => onLoc({ tuitionExpress: { ...te, ccPos } })} />
        </div>
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-mid-gray)]">Note</span>
          <Input value={te.note} disabled={disabled} placeholder="Optional note" onChange={(e) => onLoc({ tuitionExpress: { ...te, note: e.target.value } })} />
        </label>
      </div>

      <TotalRow label="SubTotal Deposits" value={money(subtotalDeposits(loc))} />
      <DeclineRefundList value={loc.declinesRefunds} disabled={disabled} onChange={(declinesRefunds) => onLoc({ declinesRefunds })} />
      <TotalRow label="Total Deposits" value={money(totalDeposits(loc))} strong />
    </div>
  )
}

// --- Reusable line lists + fields -------------------------------------------

/** who + what + amount list that auto-adds a trailing blank row as you type. */
function LineList({
  label, hint, whoPlaceholder, whatPlaceholder, value, disabled, onChange,
}: {
  label: string; hint?: string; whoPlaceholder: string; whatPlaceholder: string
  value: FinanceLine[]; disabled: boolean; onChange: (rows: FinanceLine[]) => void
}) {
  const rows = disabled ? value : [...value, { who: '', what: '', amount: 0 }]
  const setRow = (i: number, patch: Partial<FinanceLine>) => {
    if (i < value.length) onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    else onChange([...value, { who: '', what: '', amount: 0, ...patch }])
  }
  return (
    <div>
      <p className="text-sm font-bold text-[var(--color-charcoal)]">{label}</p>
      {hint && <p className="mb-1.5 text-xs text-[var(--color-dk-gray)]">{hint}</p>}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={r.who} placeholder={whoPlaceholder} disabled={disabled}
              onChange={(e) => setRow(i, { who: e.target.value })} className="min-w-0 flex-1" />
            <Input value={r.what} placeholder={whatPlaceholder} disabled={disabled}
              onChange={(e) => setRow(i, { what: e.target.value })} className="min-w-0 flex-1" />
            <MoneyInput value={r.amount} disabled={disabled} onChange={(n) => setRow(i, { amount: n })} className="w-28 shrink-0" />
            {!disabled && i < value.length && (
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--color-mid-gray)] hover:bg-[var(--color-secondary)] hover:text-[var(--color-coral)]" title="Remove">
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        {disabled && value.length === 0 && <p className="text-xs text-[var(--color-mid-gray)]">—</p>}
      </div>
    </div>
  )
}

/** agency + parent + child + amount list (agency free-type with suggestions). */
function AgencyLineList({
  label, value, disabled, onChange,
}: { label: string; value: AgencyLine[]; disabled: boolean; onChange: (rows: AgencyLine[]) => void }) {
  const rows = disabled ? value : [...value, { agency: '', parent: '', child: '', amount: 0 }]
  const setRow = (i: number, patch: Partial<AgencyLine>) => {
    if (i < value.length) onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    else onChange([...value, { agency: '', parent: '', child: '', amount: 0, ...patch }])
  }
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold text-[var(--color-charcoal)]">{label}</p>
      <datalist id="fdr-agencies">{FINANCE_AGENCIES.map((a) => <option key={a} value={a} />)}</datalist>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input list="fdr-agencies" value={r.agency} placeholder="Agency" disabled={disabled}
              onChange={(e) => setRow(i, { agency: e.target.value })} className="w-28 shrink-0" />
            <Input value={r.parent} placeholder="Parent name" disabled={disabled}
              onChange={(e) => setRow(i, { parent: e.target.value })} className="min-w-0 flex-1" />
            <Input value={r.child} placeholder="Child name" disabled={disabled}
              onChange={(e) => setRow(i, { child: e.target.value })} className="min-w-0 flex-1" />
            <MoneyInput value={r.amount} disabled={disabled} onChange={(n) => setRow(i, { amount: n })} className="w-28 shrink-0" />
            {!disabled && i < value.length && (
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--color-mid-gray)] hover:bg-[var(--color-secondary)] hover:text-[var(--color-coral)]" title="Remove">
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        {disabled && value.length === 0 && <p className="text-xs text-[var(--color-mid-gray)]">—</p>}
      </div>
    </div>
  )
}

/** Less Declines / Refunds — a type toggle + parent + amount, auto-adding. */
function DeclineRefundList({
  value, disabled, onChange,
}: { value: DeclineRefund[]; disabled: boolean; onChange: (rows: DeclineRefund[]) => void }) {
  const rows = disabled ? value : [...value, { type: 'Decline' as const, parent: '', amount: 0 }]
  const setRow = (i: number, patch: Partial<DeclineRefund>) => {
    if (i < value.length) onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    else onChange([...value, { type: 'Decline', parent: '', amount: 0, ...patch }])
  }
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold text-[var(--color-charcoal)]">
        Less Declines / Refunds <span className="font-normal text-[var(--color-dk-gray)]">— subtracts from deposits</span>
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex shrink-0 rounded-lg bg-[var(--color-secondary)] p-0.5">
              {(['Decline', 'Refund'] as const).map((t) => (
                <button key={t} type="button" disabled={disabled} onClick={() => setRow(i, { type: t })}
                  className={cn('rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                    r.type === t
                      ? (t === 'Decline' ? 'bg-[var(--color-critical)] text-white' : 'bg-[var(--color-sky-deep)] text-white')
                      : 'text-[var(--color-dk-gray)]')}>
                  {t}
                </button>
              ))}
            </div>
            <Input value={r.parent} placeholder="Parent name" disabled={disabled}
              onChange={(e) => setRow(i, { parent: e.target.value })} className="min-w-0 flex-1" />
            <MoneyInput value={r.amount} disabled={disabled} onChange={(n) => setRow(i, { amount: n })} className="w-28 shrink-0" />
            {!disabled && i < value.length && (
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--color-mid-gray)] hover:bg-[var(--color-secondary)] hover:text-[var(--color-coral)]" title="Remove">
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        {disabled && value.length === 0 && <p className="text-xs text-[var(--color-mid-gray)]">—</p>}
      </div>
    </div>
  )
}

function OutstandingRow({
  label, value, disabled, onChange,
}: { label: string; value: { names: string; amount: number }; disabled: boolean; onChange: (v: { names: string; amount: number }) => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-32 shrink-0 text-sm font-semibold text-[var(--color-charcoal)]">{label}</span>
      <Input value={value.names} placeholder="Family names" disabled={disabled}
        onChange={(e) => onChange({ ...value, names: e.target.value })} className="flex-1" />
      <MoneyInput value={value.amount} disabled={disabled} onChange={(n) => onChange({ ...value, amount: n })} className="w-32" />
    </div>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between rounded-lg px-3 py-2', strong ? 'bg-[var(--color-yellow-soft)]' : 'bg-[var(--color-secondary)]/60')}>
      <span className={cn('text-sm', strong ? 'font-extrabold text-[var(--color-charcoal)]' : 'font-semibold text-[var(--color-dk-gray)]')}>{label}</span>
      <span className={cn('font-brand', strong ? 'text-lg font-medium text-[var(--color-charcoal)]' : 'text-base text-[var(--color-charcoal)]')}>{value}</span>
    </div>
  )
}

function MoneyField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-mid-gray)]">{label}</span>
      <MoneyInput value={value} disabled={disabled} onChange={onChange} />
    </label>
  )
}

function MoneyInput({ value, disabled, onChange, className }: { value: number; disabled: boolean; onChange: (n: number) => void; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-mid-gray)]">$</span>
      <Input
        type="number" inputMode="decimal" min={0} step="0.01"
        value={value === 0 ? '' : value} placeholder="0" disabled={disabled}
        onChange={(e) => { const raw = e.target.value; if (raw === '') return onChange(0); const n = parseFloat(raw); if (!Number.isNaN(n) && n >= 0) onChange(n) }}
        className="pl-6 text-right font-semibold"
      />
    </div>
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
