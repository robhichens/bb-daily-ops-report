import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDown, ArrowUp, Check, Eye, EyeOff, History, Loader2, Lock, Plus, RotateCcw, SlidersHorizontal, Trash2, TriangleAlert, Undo2,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  CUSTOM_KINDS, defaultConfig, describeChanges, finalizeKeys, isBuiltInColumn, isBuiltInField,
  isBuiltInSection, isConditionalField, isGridSection, kindLabel, makeKey, normalizeConfig, toOrgSections, validateConfig,
  type DorConfig, type EditableReport, type FieldSetting, type ListColumn, type SectionSetting, type TextReport,
} from '@/lib/appConfig'
import { ConfigConflictError, listVersions, loadConfig, saveConfig, type ConfigVersion } from '@/lib/appConfigStore'
import { editableDef } from '@/lib/reportRegistry'
import { emptyOrgReport } from '@/lib/orgReports'
import type { FieldKind, OrgFieldValue, OrgReport as TOrgReport, SiteId } from '@/lib/schema'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SectionCard } from './OrgReport'

// Customize the DOR (admins: Kathe, Molly, Rob). A spreadsheet-like editor for the
// settings in lib/appConfig.ts — schools & rooms, lists & numbers, and the CDR/ADR
// fields. Nothing changes for anyone until Save; every save is a version that can
// be rolled back. After a save the page reloads so the new settings apply everywhere.

type Tab = 'schools' | 'lists' | EditableReport | 'history'
const TABS: { id: Tab; label: string }[] = [
  { id: 'schools', label: 'Schools & Rooms' },
  { id: 'lists', label: 'Lists & Numbers' },
  { id: 'edr', label: 'CDR' },
  { id: 'adr', label: 'ADR' },
  { id: 'ddr', label: 'DDR' },
  { id: 'fdr', label: 'FDR' },
  { id: 'history', label: 'History' },
]
const REPORT_NAME: Record<EditableReport, string> = {
  edr: 'Co-Director Daily Report (CDR)',
  adr: 'Admissions Daily Report (ADR)',
  ddr: 'Director Daily Report (DDR)',
  fdr: 'Finance Daily Report (FDR)',
}
/** Where the DDR/FDR's added sections appear on the form. */
const EXTRA_PLACE: Record<TextReport, string> = {
  ddr: 'after Director Packet, before the Director Report on the Day',
  fdr: 'after Deposits, once per day (add a Campus column to a list if it’s per school)',
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
type Edit = (fn: (d: DorConfig) => void) => void

function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

export function Customize() {
  const { profile, user } = useAuth()
  const [base, setBase] = useState<{ version: number; config: DorConfig } | null>(null)
  const [draft, setDraft] = useState<DorConfig | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('schools')
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    loadConfig()
      .then((v) => {
        const config = v?.config ?? defaultConfig()
        setBase({ version: v?.version ?? 0, config })
        setDraft(clone(config))
      })
      .catch(() => setLoadError('Couldn’t load the current settings. Check your connection and reload.'))
  }, [])

  const changes = useMemo(() => (base && draft ? describeChanges(base.config, draft) : []), [base, draft])
  const dirty = changes.length > 0
  const problems = useMemo(() => (draft ? validateConfig(draft) : []), [draft])

  // Don't lose unsaved edits to a closed tab.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const edit: Edit = (fn) => {
    setReviewing(false)
    setDraft((prev) => { if (!prev) return prev; const next = clone(prev); fn(next); return next })
  }

  async function save() {
    if (!base || !draft || problems.length) return
    setSaving(true); setSaveError('')
    try {
      await saveConfig(normalizeConfig(finalizeKeys(draft, base.config)), base.version, profile?.displayName || user?.email || 'Admin', changes)
      window.location.reload() // apply everywhere (forms, dashboard, print)
    } catch (e) {
      setSaving(false)
      setSaveError(e instanceof ConfigConflictError
        ? `${e.by} saved changes while you were editing, so nothing was saved. Note what you changed, reload this page, and make your changes again.`
        : 'Couldn’t save just now. Check your connection and try again.')
    }
  }

  if (loadError) return <Card accent="coral" className="p-6 text-sm text-[var(--color-critical)]">{loadError}</Card>
  if (!base || !draft) return <div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-[var(--color-mid-gray)]" /></div>

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-charcoal)] text-white"><SlidersHorizontal className="size-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">Customize the DOR</h1>
            <p className="text-sm text-[var(--color-dk-gray)]">Rooms, lists and report fields. Nothing changes for anyone until you save.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition-colors', tab === t.id ? 'border-[var(--color-coral)] text-[var(--color-charcoal)]' : 'border-transparent text-[var(--color-dk-gray)] hover:text-[var(--color-charcoal)]')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'schools' && <SchoolsTab draft={draft} edit={edit} saved={base.config} />}
      {tab === 'lists' && <ListsTab draft={draft} edit={edit} />}
      {(tab === 'edr' || tab === 'adr') && <ReportTab r={tab} draft={draft} edit={edit} saved={base.config} />}
      {(tab === 'ddr' || tab === 'fdr') && (
        <div className="space-y-8">
          <WordingTab r={tab} draft={draft} edit={edit} />
          <ReportTab r={tab} draft={draft} edit={edit} saved={base.config} />
        </div>
      )}
      {tab === 'history' && (
        <HistoryTab
          current={base.version}
          onRollback={(v) => { setDraft(clone(v.config)); setTab('schools'); setReviewing(true) }}
        />
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-[var(--color-border)] bg-[var(--color-cream)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {reviewing && dirty && (
          <div className="mb-3 max-h-64 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
            {problems.length ? (
              <>
                <p className="flex items-center gap-2 text-sm font-bold text-[var(--color-critical)]"><TriangleAlert className="size-4" /> Fix these before saving</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-charcoal)]">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-[var(--color-charcoal)]">You’re about to save {changes.length} change{changes.length === 1 ? '' : 's'}:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-charcoal)]">{changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
                <p className="mt-2 text-xs text-[var(--color-dk-gray)]">Everyone sees the change the next time they open the DOR. You can roll back from History.</p>
              </>
            )}
          </div>
        )}
        {saveError && <p className="mb-2 text-sm text-[var(--color-critical)]">{saveError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[var(--color-dk-gray)]">
            {dirty ? <b className="text-[var(--color-charcoal)]">{changes.length} unsaved change{changes.length === 1 ? '' : 's'}</b> : 'No unsaved changes'}
            {base.version > 0 && <span className="ml-2 text-xs">· version {base.version}</span>}
          </span>
          <div className="flex gap-2">
            {dirty && <Button variant="ghost" onClick={() => { setDraft(clone(base.config)); setReviewing(false); setSaveError('') }}><Undo2 className="size-4" /> Discard</Button>}
            {reviewing && dirty && !problems.length ? (
              <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save for everyone</Button>
            ) : (
              <Button onClick={() => setReviewing(true)} disabled={!dirty}>Review &amp; save</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Small pieces --------------------------------------------------------------

function Panel({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-charcoal)]">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-[var(--color-dk-gray)]">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function MoveButtons({ onUp, onDown, first, last, label }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean; label: string }) {
  const cls = 'grid size-7 place-items-center rounded-md text-[var(--color-dk-gray)] hover:bg-[var(--color-secondary)] disabled:opacity-25'
  return (
    <div className="flex shrink-0">
      <button type="button" className={cls} disabled={first} onClick={onUp} aria-label={`Move ${label} up`}><ArrowUp className="size-3.5" /></button>
      <button type="button" className={cls} disabled={last} onClick={onDown} aria-label={`Move ${label} down`}><ArrowDown className="size-3.5" /></button>
    </div>
  )
}

const cell = cn(inputClass, 'h-9 px-2 text-sm')
const numParse = (raw: string) => { const n = Number(raw); return raw === '' || Number.isNaN(n) || n < 0 ? 0 : n }
const th = 'px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-dk-gray)]'

function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'lock' | 'retired' | 'new' }) {
  const cls = {
    gray: 'bg-[var(--color-secondary)] text-[var(--color-dk-gray)]',
    lock: 'bg-[var(--color-sky-soft,#e3f3f8)] text-[var(--color-charcoal)]',
    retired: 'bg-[var(--color-critical-soft)] text-[var(--color-critical)]',
    new: 'bg-[var(--color-good-soft)] text-[var(--color-good)]',
  }[tone]
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', cls)}>{children}</span>
}

// --- Schools & Rooms -------------------------------------------------------------

function SchoolsTab({ draft, edit, saved }: { draft: DorConfig; edit: Edit; saved: DorConfig }) {
  const sites = draft.sites
  return (
    <div className="space-y-5">
      <Panel title="Schools" hint="Licensed capacity drives the enrollment meters; the waiver adds children per teacher in every room at that school.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead><tr><th className={th}>School</th><th className={th}>Licensed capacity</th><th className={th}>Ratio waiver (+ per teacher)</th></tr></thead>
            <tbody>
              {sites.map((s, i) => (
                <tr key={s.id} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-2"><input className={cn(cell, 'w-44')} value={s.name} aria-label="School name" onChange={(e) => edit((d) => { d.sites[i].name = e.target.value })} /></td>
                  <td className="px-2 py-2"><input className={cn(cell, 'w-24')} type="number" min={0} value={s.capacity} aria-label={`${s.name} capacity`} onChange={(e) => edit((d) => { d.sites[i].capacity = numParse(e.target.value) })} /></td>
                  <td className="px-2 py-2"><input className={cn(cell, 'w-24')} type="number" min={0} value={s.waiver} aria-label={`${s.name} waiver`} onChange={(e) => edit((d) => { d.sites[i].waiver = numParse(e.target.value) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-mid-gray)]">Adding a fourth school needs Rob — it’s wired into who can see what.</p>
      </Panel>

      <Panel
        title="Rooms"
        hint="In age order. Tick the schools that run each room. Untick every school to close a room — its past numbers stay. Names must match ProCare’s room names so the roll call finds them."
        action={<Button size="sm" variant="outline" onClick={() => edit((d) => { d.rooms.push({ key: makeKey('room', d.rooms.map((r) => r.key)), name: '', ageGroup: '', ratio: 10, sites: [] }) })}><Plus className="size-3.5" /> Add room</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className={th} />
                <th className={th}>Room</th>
                <th className={th}>Age group</th>
                <th className={th}>Ratio 1 :</th>
                {sites.map((s) => <th key={s.id} className={cn(th, 'text-center')}>{s.name}</th>)}
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {draft.rooms.map((r, i) => {
                const isNew = !saved.rooms.some((x) => x.key === r.key)
                const closed = !r.sites.length
                return (
                  <tr key={r.key} className={cn('border-t border-[var(--color-border)]', closed && 'opacity-60')}>
                    <td className="px-1 py-2"><MoveButtons label={r.name || 'room'} first={i === 0} last={i === draft.rooms.length - 1} onUp={() => edit((d) => move(d.rooms, i, -1))} onDown={() => edit((d) => move(d.rooms, i, 1))} /></td>
                    <td className="px-2 py-2"><input className={cn(cell, 'w-36')} value={r.name} placeholder="Room name" aria-label="Room name" onChange={(e) => edit((d) => { d.rooms[i].name = e.target.value })} /></td>
                    <td className="px-2 py-2"><input className={cn(cell, 'w-36')} value={r.ageGroup} placeholder="e.g. 2s" aria-label={`${r.name} age group`} onChange={(e) => edit((d) => { d.rooms[i].ageGroup = e.target.value })} /></td>
                    <td className="px-2 py-2"><input className={cn(cell, 'w-16')} type="number" min={1} value={r.ratio} aria-label={`${r.name} ratio`} onChange={(e) => edit((d) => { d.rooms[i].ratio = numParse(e.target.value) })} /></td>
                    {sites.map((s) => (
                      <td key={s.id} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--color-coral)]"
                          checked={r.sites.includes(s.id)}
                          aria-label={`${r.name} at ${s.name}`}
                          onChange={(e) => edit((d) => {
                            const set = new Set<SiteId>(d.rooms[i].sites)
                            if (e.target.checked) set.add(s.id); else set.delete(s.id)
                            d.rooms[i].sites = d.sites.map((x) => x.id).filter((id) => set.has(id))
                          })}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right">
                      {isNew ? (
                        <button type="button" className="text-[var(--color-dk-gray)] hover:text-[var(--color-critical)]" aria-label="Remove new room" onClick={() => edit((d) => { d.rooms.splice(i, 1) })}><Trash2 className="size-4" /></button>
                      ) : closed ? <Badge tone="retired">Closed</Badge> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

// --- Lists & Numbers ---------------------------------------------------------------

function ListsTab({ draft, edit }: { draft: DorConfig; edit: Edit }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Panel title="Directors" hint="The names offered on the Director Daily Report." action={<Button size="sm" variant="outline" onClick={() => edit((d) => { d.directors.push('') })}><Plus className="size-3.5" /> Add</Button>}>
        <div className="space-y-2">
          {draft.directors.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={cn(cell, 'flex-1')} value={name} placeholder="Full name" aria-label="Director name" onChange={(e) => edit((d) => { d.directors[i] = e.target.value })} />
              <button type="button" className="text-[var(--color-dk-gray)] hover:text-[var(--color-critical)]" aria-label={`Remove ${name}`} onClick={() => edit((d) => { d.directors.splice(i, 1) })}><Trash2 className="size-4" /></button>
            </div>
          ))}
          {!draft.directors.length && <p className="text-sm text-[var(--color-dk-gray)]">No names — directors will type theirs.</p>}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Buy / Fix lists" hint="The two lists a Day Note can be filed to. The button label shows on each note.">
          <table className="w-full">
            <thead><tr><th className={th}>List name</th><th className={th}>Button</th></tr></thead>
            <tbody>
              {draft.requestLists.map((l, i) => (
                <tr key={l.id} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-2"><input className={cn(cell, 'w-full')} value={l.label} aria-label="List name" onChange={(e) => edit((d) => { d.requestLists[i].label = e.target.value })} /></td>
                  <td className="px-2 py-2"><input className={cn(cell, 'w-24')} value={l.short} aria-label={`${l.label} button`} onChange={(e) => edit((d) => { d.requestLists[i].short = e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Numbers">
          <label className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm text-[var(--color-charcoal)]">Registration fee ($)<span className="block text-xs text-[var(--color-dk-gray)]">Reg fees paid × this = the dashboard’s $ figure</span></span>
            <input className={cn(cell, 'w-24')} type="number" min={0} value={draft.numbers.registrationFee} onChange={(e) => edit((d) => { d.numbers.registrationFee = numParse(e.target.value) })} />
          </label>
          <label className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] py-1.5">
            <span className="text-sm text-[var(--color-charcoal)]">Daily enrollment comms goal<span className="block text-xs text-[var(--color-dk-gray)]">Per director, on the DDR goal pill</span></span>
            <input className={cn(cell, 'w-24')} type="number" min={0} value={draft.numbers.commsDailyGoal} onChange={(e) => edit((d) => { d.numbers.commsDailyGoal = numParse(e.target.value) })} />
          </label>
        </Panel>
      </div>
    </div>
  )
}

// --- Report fields ---------------------------------------------------------------------

function ReportTab({ r, draft, edit, saved }: { r: EditableReport; draft: DorConfig; edit: Edit; saved: DorConfig }) {
  const [preview, setPreview] = useState(false)
  const sections = draft.reports[r].sections
  const savedSections = saved.reports[r].sections
  const savedField = (sk: string, fk: string) => savedSections.find((s) => s.key === sk)?.fields.find((f) => f.key === fk)
  const allSectionKeys = sections.map((s) => s.key)
  const extras = r === 'ddr' || r === 'fdr'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {extras ? (
          <div className="max-w-2xl">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-charcoal)]">Your added sections</h2>
            <p className="mt-0.5 text-sm text-[var(--color-dk-gray)]">
              New things to track on the {REPORT_SHORT_NAME[r]}. They appear {EXTRA_PLACE[r]}, print with the report, and each number, yes/no or list gets its own line on the dashboard.
            </p>
          </div>
        ) : (
          <p className="max-w-2xl text-sm text-[var(--color-dk-gray)]">
            {REPORT_NAME[r]}. Rename anything. Fields marked <Badge tone="lock"><Lock className="size-2.5" /> dashboard</Badge> feed the dashboard, so they can be renamed and moved but not removed. Fields you add get their own dashboard line.
          </p>
        )}
        {(!extras || sections.length > 0) && <Button size="sm" variant="outline" onClick={() => setPreview((p) => !p)}>{preview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {preview ? 'Hide preview' : extras ? 'Preview these sections' : 'Preview the form'}</Button>}
      </div>

      <div className={cn('grid items-start gap-5', preview && 'xl:grid-cols-2')}>
        <div className="space-y-4">
          {extras && !sections.length && (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-dk-gray)]">None yet — the {REPORT_SHORT_NAME[r]} is exactly as built. Add a section to start tracking something new.</p>
          )}
          {sections.map((s, si) => {
            const builtInSec = isBuiltInSection(r, s.key)
            const grid = isGridSection(r, s.key)
            const savedSec = savedSections.find((x) => x.key === s.key)
            return (
              <Card key={s.key} className={cn('p-4', s.retired && 'opacity-60')}>
                <div className="flex flex-wrap items-start gap-2">
                  <MoveButtons label={s.title} first={si === 0} last={si === sections.length - 1} onUp={() => edit((d) => move(d.reports[r].sections, si, -1))} onDown={() => edit((d) => move(d.reports[r].sections, si, 1))} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input className={cn(cell, 'w-full font-bold uppercase tracking-wide')} value={s.title} placeholder="Section title" aria-label="Section title" onChange={(e) => edit((d) => { d.reports[r].sections[si].title = e.target.value })} />
                    <input className={cn(cell, 'w-full text-xs')} value={s.hint ?? ''} placeholder="Hint shown under the title (optional)" aria-label={`${s.title} hint`} onChange={(e) => edit((d) => { d.reports[r].sections[si].hint = e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {s.retired && <Badge tone="retired">Retired</Badge>}
                    {!savedSec && <Badge tone="new">New</Badge>}
                    {!builtInSec && (
                      !savedSec
                        ? <button type="button" className="text-[var(--color-dk-gray)] hover:text-[var(--color-critical)]" aria-label="Remove new section" onClick={() => edit((d) => { d.reports[r].sections.splice(si, 1) })}><Trash2 className="size-4" /></button>
                        : <Button size="sm" variant="ghost" onClick={() => edit((d) => { d.reports[r].sections[si].retired = !s.retired })}>{s.retired ? <><RotateCcw className="size-3.5" /> Bring back</> : 'Retire'}</Button>
                    )}
                  </div>
                </div>

                {grid ? (
                  <p className="mt-3 rounded-lg bg-[var(--color-secondary)] px-3 py-2 text-xs text-[var(--color-dk-gray)]">The Openings to Staff grid. Its rows come from the <b>Schools &amp; Rooms</b> tab.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {s.fields.map((f, fi) => (
                      <FieldRow
                        key={f.key}
                        r={r}
                        section={s}
                        f={f}
                        first={fi === 0}
                        last={fi === s.fields.length - 1}
                        isNew={!savedField(s.key, f.key)}
                        savedCols={savedField(s.key, f.key)?.subFields ?? []}
                        update={(fn) => edit((d) => { fn(d.reports[r].sections[si].fields[fi], d.reports[r].sections[si]) })}
                        onMove={(dir) => edit((d) => move(d.reports[r].sections[si].fields, fi, dir))}
                        onRemove={() => edit((d) => { d.reports[r].sections[si].fields.splice(fi, 1) })}
                      />
                    ))}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <Button size="sm" variant="outline" onClick={() => edit((d) => {
                        const sec = d.reports[r].sections[si]
                        sec.fields.push({ key: makeKey('new field', sec.fields.map((x) => x.key)), label: '', kind: 'count' })
                      })}><Plus className="size-3.5" /> Add field</Button>
                      {!builtInSec ? (
                        <label className="flex items-center gap-2 text-xs text-[var(--color-dk-gray)]">
                          <input type="checkbox" className="size-4 accent-[var(--color-coral)]" checked={!!s.note} onChange={(e) => edit((d) => { d.reports[r].sections[si].note = e.target.checked })} />
                          Add a Note box
                        </label>
                      ) : s.note ? <span className="text-xs text-[var(--color-mid-gray)]">+ Note box</span> : null}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
          <Button variant="outline" onClick={() => edit((d) => {
            d.reports[r].sections.push({ key: makeKey('new section', allSectionKeys), title: '', hint: '', note: true, fields: [{ key: 'newField', label: '', kind: 'count' }] })
          })}><Plus className="size-4" /> Add section</Button>
        </div>

        {preview && <FormPreview r={r} draft={draft} />}
      </div>
    </div>
  )
}

function FieldRow({
  r, section, f, first, last, isNew, savedCols, update, onMove, onRemove,
}: {
  r: EditableReport
  section: SectionSetting
  f: FieldSetting
  first: boolean
  last: boolean
  isNew: boolean
  savedCols: ListColumn[]
  update: (fn: (f: FieldSetting, s: SectionSetting) => void) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const builtIn = isBuiltInField(r, section.key, f.key)
  const conditional = isConditionalField(r, section.key, f.key)
  return (
    <div className={cn('rounded-lg border border-[var(--color-border)] bg-white p-2', f.retired && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-2">
        <MoveButtons label={f.label || 'field'} first={first} last={last} onUp={() => onMove(-1)} onDown={() => onMove(1)} />
        <input
          className={cn(cell, 'min-w-[180px] flex-1')}
          value={f.label}
          placeholder={f.kind === 'list' && builtIn ? '(no label)' : 'Field label'}
          aria-label="Field label"
          onChange={(e) => update((x) => { x.label = e.target.value })}
        />
        {isNew ? (
          <select
            className={cn(cell, 'w-auto')}
            value={f.kind}
            aria-label={`${f.label || 'New field'} type`}
            onChange={(e) => update((x) => {
              x.kind = e.target.value as FieldKind
              if (x.kind === 'list' && !x.subFields?.length) x.subFields = [{ key: 'name', label: 'Name', type: 'text' }]
              if (x.kind !== 'list') delete x.subFields
            })}
          >
            {CUSTOM_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </select>
        ) : (
          <span className="text-xs text-[var(--color-dk-gray)]">{kindLabel(f.kind)}</span>
        )}
        {builtIn && <Badge tone="lock"><Lock className="size-2.5" /> dashboard</Badge>}
        {conditional && <Badge>shows on “No”</Badge>}
        {isNew && <Badge tone="new">New</Badge>}
        {f.retired && <Badge tone="retired">Retired</Badge>}
        {!builtIn && (
          isNew
            ? <button type="button" className="text-[var(--color-dk-gray)] hover:text-[var(--color-critical)]" aria-label="Remove new field" onClick={onRemove}><Trash2 className="size-4" /></button>
            : <Button size="sm" variant="ghost" onClick={() => update((x) => { x.retired = !x.retired })}>{f.retired ? <><RotateCcw className="size-3.5" /> Bring back</> : 'Retire'}</Button>
        )}
      </div>
      {f.kind === 'list' && !f.retired && (
        <ColumnsEditor r={r} section={section} f={f} savedCols={savedCols} update={update} />
      )}
    </div>
  )
}

function ColumnsEditor({ r, section, f, savedCols, update }: { r: EditableReport; section: SectionSetting; f: FieldSetting; savedCols: ListColumn[]; update: (fn: (f: FieldSetting) => void) => void }) {
  const cols = f.subFields ?? []
  return (
    <div className="ml-14 mt-2 space-y-1.5 border-l-2 border-[var(--color-border)] pl-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">Columns in each row</p>
      {cols.map((c, ci) => {
        const coded = isBuiltInColumn(r, section.key, f.key, c.key)
        const isNewCol = !savedCols.some((x) => x.key === c.key) && !coded
        const typeValue = c.optionSet === 'sites' ? 'campus' : c.type
        return (
          <div key={c.key} className="flex flex-wrap items-center gap-2">
            <input className={cn(cell, 'w-40')} value={c.label} placeholder="Column name" aria-label="Column name" onChange={(e) => update((x) => { x.subFields![ci].label = e.target.value })} />
            {isNewCol ? (
              <select
                className={cn(cell, 'w-auto')}
                value={typeValue}
                aria-label={`${c.label || 'Column'} type`}
                onChange={(e) => update((x) => {
                  const col = x.subFields![ci]
                  const v = e.target.value
                  if (v === 'campus') { col.type = 'select'; col.optionSet = 'sites'; delete col.options }
                  else if (v === 'select') { col.type = 'select'; delete col.optionSet; col.options = col.options ?? [] }
                  else { col.type = 'text'; delete col.optionSet; delete col.options }
                })}
              >
                <option value="text">Text</option>
                <option value="select">Dropdown</option>
                <option value="campus">Campus</option>
              </select>
            ) : (
              <span className="text-xs text-[var(--color-dk-gray)]">{typeValue === 'campus' ? 'Campus' : typeValue === 'select' ? 'Dropdown' : 'Text'}</span>
            )}
            {c.type === 'select' && !c.optionSet && (
              <ChoicesInput value={c.options ?? []} onChange={(opts) => update((x) => { x.subFields![ci].options = opts })} />
            )}
            {isNewCol && (
              <button type="button" className="text-[var(--color-dk-gray)] hover:text-[var(--color-critical)]" aria-label="Remove column" onClick={() => update((x) => { x.subFields!.splice(ci, 1) })}><Trash2 className="size-3.5" /></button>
            )}
          </div>
        )
      })}
      <button type="button" className="flex items-center gap-1 text-xs font-semibold text-[var(--color-coral-dark,#c95f5a)] hover:underline" onClick={() => update((x) => {
        x.subFields = [...(x.subFields ?? []), { key: makeKey('column', (x.subFields ?? []).map((c) => c.key)), label: '', type: 'text' }]
      })}><Plus className="size-3" /> Add column</button>
    </div>
  )
}

/** Comma-separated choices, kept as typed until you leave the box. */
function ChoicesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const joined = value.join(', ')
  const [text, setText] = useState(joined)
  useEffect(() => { setText(joined) }, [joined])
  return (
    <input
      className={cn(cell, 'min-w-[220px] flex-1')}
      value={text}
      placeholder="Choices, separated by commas"
      aria-label="Dropdown choices"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split(',').map((x) => x.trim()).filter(Boolean))}
    />
  )
}

/** The form as people will see it, from the unsaved settings (try typing in it). */
function FormPreview({ r, draft }: { r: EditableReport; draft: DorConfig }) {
  const def = useMemo(() => ({ ...editableDef(r), sections: toOrgSections(r, draft.reports[r]) }), [r, draft])
  const [report, setReport] = useState<TOrgReport>(() => emptyOrgReport(def, '2026-01-05', '', 'crozet'))
  const setField = (section: string, field: string, value: OrgFieldValue) =>
    setReport((p) => ({ ...p, data: { ...p.data, [section]: { ...p.data[section], [field]: value } } }))
  const patchSection = (section: string, patch: Record<string, OrgFieldValue>) =>
    setReport((p) => ({ ...p, data: { ...p.data, [section]: { ...p.data[section], ...patch } } }))
  return (
    <div className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-dk-gray)]">Preview — not saved, nothing is filed</p>
      {def.sections.filter((s) => !s.retired).map((s) => (
        <SectionCard key={s.key} def={def} section={s} draft={report} locked={false} setField={setField} patchSection={patchSection} />
      ))}
    </div>
  )
}

// --- DDR / FDR wording ---------------------------------------------------------------------

const REPORT_SHORT_NAME: Record<EditableReport, string> = { edr: 'CDR', adr: 'ADR', ddr: 'DDR', fdr: 'FDR' }
/** Pieces of the hand-built forms that have no hint line to edit. */
const NO_HINT = new Set(['billing', 'deposits', 'outstanding', 'paymentsByAgency'])

function WordingTab({ r, draft, edit }: { r: TextReport; draft: DorConfig; edit: Edit }) {
  const original = useMemo(() => defaultConfig().text[r], [r])
  const items = draft.text[r]
  const groups = [...new Set(items.map((t) => t.group))]
  return (
    <div className="space-y-4">
      <div className="max-w-2xl">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-charcoal)]">Wording on the {REPORT_SHORT_NAME[r]}</h2>
        <p className="mt-0.5 text-sm text-[var(--color-dk-gray)]">
          {REPORT_NAME[r]}. Rename headings and rows, change their hints and dropdown choices. The form’s layout and math stay as built, and renaming never touches past reports.
        </p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {groups.map((g) => (
          <Panel key={g} title={g}>
            <div className="divide-y divide-[var(--color-border)]">
              {items.map((t, i) => {
                if (t.group !== g) return null
                const orig = original.find((o) => o.key === t.key)
                const renamed = !!orig && orig.label !== t.label
                const hasHint = !t.key.startsWith('title.') && !NO_HINT.has(t.key)
                return (
                  <div key={t.key} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
                    <input className={cn(cell, 'w-full font-semibold')} value={t.label} aria-label={`${orig?.label ?? t.key} name`} onChange={(e) => edit((d) => { d.text[r][i].label = e.target.value })} />
                    {renamed && orig && (
                      <p className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-mid-gray)]">
                        Originally “{orig.label}”
                        <button type="button" className="font-semibold text-[var(--color-coral-dark,#c95f5a)] hover:underline" onClick={() => edit((d) => { d.text[r][i].label = orig.label })}>Put it back</button>
                      </p>
                    )}
                    {hasHint && (
                      <input className={cn(cell, 'w-full text-xs')} value={t.hint ?? ''} placeholder="Hint under it (optional)" aria-label={`${t.label} hint`} onChange={(e) => edit((d) => { d.text[r][i].hint = e.target.value })} />
                    )}
                    {t.choices && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-mid-gray)]">Type choices</span>
                        <ChoicesInput value={t.choices} onChange={(opts) => edit((d) => { d.text[r][i].choices = opts })} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>
        ))}
        {r === 'fdr' && (
          <Panel title="Agency choices" hint="Offered under Payment by Agency. Alicia can still type one that isn’t listed.">
            <ChoicesInput value={draft.agencies} onChange={(opts) => edit((d) => { d.agencies = opts })} />
          </Panel>
        )}
      </div>
    </div>
  )
}

// --- History -----------------------------------------------------------------------------

function HistoryTab({ current, onRollback }: { current: number; onRollback: (v: ConfigVersion) => void }) {
  const [versions, setVersions] = useState<ConfigVersion[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { listVersions().then(setVersions).catch(() => setError('Couldn’t load the history.')) }, [])

  if (error) return <p className="text-sm text-[var(--color-critical)]">{error}</p>
  if (!versions) return <Loader2 className="mx-auto size-5 animate-spin text-[var(--color-mid-gray)]" />
  return (
    <Panel title="History" hint="Every save, newest first. Rolling back loads that version as unsaved changes — review them, then save.">
      {!versions.length ? (
        <p className="text-sm text-[var(--color-dk-gray)]">Nothing saved yet — the DOR is running on its built-in settings.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {versions.map((v) => (
            <li key={v.version} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-charcoal)]">
                  <History className="size-3.5 text-[var(--color-mid-gray)]" /> Version {v.version}
                  {v.version === current && <Badge tone="new">In use</Badge>}
                </p>
                <p className="text-xs text-[var(--color-dk-gray)]">{v.savedBy} · {v.savedAt ? new Date(v.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</p>
                {!!v.changes.length && (
                  <ul className="mt-1 list-disc pl-5 text-xs text-[var(--color-charcoal)]">
                    {v.changes.slice(0, 6).map((c, i) => <li key={i}>{c}</li>)}
                    {v.changes.length > 6 && <li className="list-none text-[var(--color-mid-gray)]">+{v.changes.length - 6} more</li>}
                  </ul>
                )}
              </div>
              {v.version !== current && <Button size="sm" variant="outline" onClick={() => onRollback(v)}><RotateCcw className="size-3.5" /> Roll back to this</Button>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
