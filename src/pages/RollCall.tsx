import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, FileUp, Loader2, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin, userSites } from '@/lib/users'
import { effectiveRatio, openingsFor, siteName, type SiteId } from '@/lib/schema'
import { addIsoDays, formatShort, todayIso } from '@/lib/dates'
import { mondayOf, parseRollCall, rollCallCells, rollCallRows, type RollCall, type RollCallRow } from '@/lib/rollCall'
import { readPdfText } from '@/lib/rollCallPdf'
import { latestRollCalls, saveRollCall, subscribeRollCalls, type RollCallHeadline } from '@/lib/headlines'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input, inputClass } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Weekly roll call upload → Openings to Staff. Someone uploads each school's
// ProCare "Monthly Roll Call w/Schedule" PDF (usually Monday); the DOR reads each
// room's busiest scheduled day that week + the teachers in the room header,
// shows them for review, and saves counts only (no children's details) to the
// shared headline record the dashboard reads. Admins: any school; directors:
// their own school(s).

interface Parsed {
  fileName: string
  rc: RollCall | null
  error?: string
  rows: RollCallRow[]
  saved?: boolean
  saving?: boolean
}

export function RollCall() {
  const { profile } = useAuth()
  const admin = isAdmin(profile?.role)
  const allowed: SiteId[] = admin ? ['crozet', 'forest-lakes', 'mill-creek'] : userSites(profile)

  const [monday, setMonday] = useState(() => mondayOf(todayIso()))
  const [parsed, setParsed] = useState<Parsed[]>([])
  const [reading, setReading] = useState(false)
  const [uploads, setUploads] = useState<RollCallHeadline[]>([])
  useEffect(() => subscribeRollCalls(setUploads), [])
  const latest = useMemo(() => latestRollCalls(uploads), [uploads])

  // Re-derive rows when the week changes (keeps any edits only for the same week).
  useEffect(() => {
    setParsed((ps) => ps.map((p) => (p.rc && !p.saved ? { ...p, rows: rollCallRows(p.rc, monday) } : p)))
  }, [monday])

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setReading(true)
    const next: Parsed[] = []
    for (const f of Array.from(files)) {
      try {
        const rc = parseRollCall(await readPdfText(f))
        let error: string | undefined
        if (!rc.siteId) error = `Couldn’t tell which school this roll call is for${rc.schoolName ? ` (“${rc.schoolName}”)` : ''}.`
        else if (!allowed.includes(rc.siteId)) error = `This is ${siteName(rc.siteId)}’s roll call. You can upload roll calls for ${allowed.map(siteName).join(', ') || 'no schools yet'}.`
        else if (!rc.rooms.some((r) => r.roomKey)) error = 'No rooms found. Is this the “Monthly Roll Call w/Schedule” report?'
        next.push({ fileName: f.name, rc, error, rows: error ? [] : rollCallRows(rc, monday) })
      } catch {
        next.push({ fileName: f.name, rc: null, error: 'Couldn’t read this file. Make sure it’s the roll call PDF from ProCare.', rows: [] })
      }
    }
    // One card per school: a newer file for the same school replaces the old one.
    setParsed((prev) => {
      const keep = prev.filter((p) => !next.some((n) => n.rc?.siteId && n.rc.siteId === p.rc?.siteId))
      return [...keep, ...next]
    })
    setReading(false)
  }

  function editRow(i: number, roomKey: string, patch: Partial<RollCallRow>) {
    setParsed((ps) => ps.map((p, k) => (k === i ? { ...p, saved: false, rows: p.rows.map((r) => (r.roomKey === roomKey ? { ...r, ...patch } : r)) } : p)))
  }

  async function save(i: number) {
    const p = parsed[i]
    if (!p.rc?.siteId) return
    const site = p.rc.siteId
    setParsed((ps) => ps.map((x, k) => (k === i ? { ...x, saving: true } : x)))
    try {
      await saveRollCall({
        siteId: site,
        date: monday,
        month: p.rc.month,
        rooms: Object.fromEntries(p.rows.map((r) => [r.roomKey, { kids: r.kids, teachers: r.teachers, teacherNames: r.teacherNames, age: r.age }])),
        cells: rollCallCells(site, p.rows),
        uploadedBy: profile?.displayName || profile?.email || 'Someone',
      })
      setParsed((ps) => ps.map((x, k) => (k === i ? { ...x, saving: false, saved: true } : x)))
    } catch {
      setParsed((ps) => ps.map((x, k) => (k === i ? { ...x, saving: false, error: 'Couldn’t save just now. Check your connection and try again.' } : x)))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-charcoal)] text-white"><FileUp className="size-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-charcoal)]">Upload roll call</h1>
            <p className="text-sm text-[var(--color-dk-gray)]">Weekly Openings to Staff from ProCare’s Monthly Roll Call</p>
          </div>
        </div>
        <Link to="/dashboard" className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft className="size-3.5" /> Dashboard</Link>
      </div>

      <Card accent="coral" className="space-y-4 p-5">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-charcoal)]">
          <li>In ProCare, run <b>Monthly Roll Call w/Schedule</b> for this month and save it as a PDF (one per school).</li>
          <li>Choose the PDFs below. They’re read on this device; only room counts and teacher names are saved, never children’s details.</li>
          <li>Check each school’s numbers, fix anything that’s off, and tap <b>Save</b>.</li>
        </ol>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dk-gray)]">Week of (Monday)</span>
            <Input type="date" value={monday} onChange={(e) => e.target.value && setMonday(mondayOf(e.target.value))} className="w-auto" />
          </label>
          <label className={cn(buttonVariants({ size: 'default' }), 'cursor-pointer')}>
            {reading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {reading ? 'Reading…' : 'Choose roll call PDFs'}
            <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" disabled={reading} onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
          </label>
        </div>
        <p className="text-xs text-[var(--color-dk-gray)]">
          Children = each room’s busiest scheduled day, {formatShort(monday)}–{formatShort(addIsoDays(monday, 4))}. Teachers = the names in the room’s header.
        </p>
        {allowed.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-dk-gray)]">
            {allowed.map((s) => {
              const l = latest[s]
              return <span key={s}><b className="text-[var(--color-charcoal)]">{siteName(s)}:</b> {l ? `last upload wk of ${formatShort(l.date)} by ${l.uploadedBy}` : 'no upload yet'}</span>
            })}
          </div>
        )}
      </Card>

      {parsed.map((p, i) => (
        <SchoolReview key={`${p.fileName}-${i}`} p={p} monday={monday} onEdit={(room, patch) => editRow(i, room, patch)} onSave={() => void save(i)} />
      ))}
    </div>
  )
}

function SchoolReview({
  p, monday, onEdit, onSave,
}: {
  p: Parsed
  monday: string
  onEdit: (roomKey: string, patch: Partial<RollCallRow>) => void
  onSave: () => void
}) {
  const site = p.rc?.siteId ?? null
  const title = site ? siteName(site) : p.fileName
  const noWeek = !!p.rc && p.rows.length > 0 && p.rc.rooms.every((r) => !Object.keys(r.daily).some((d) => d >= monday && d <= addIsoDays(monday, 4)))

  return (
    <Card accent={p.error ? 'gray' : 'sky'} className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[var(--color-charcoal)]">{title}</h2>
        <span className="text-xs text-[var(--color-dk-gray)]">{p.rc?.month ? `${p.rc.month} roll call · ` : ''}{p.fileName}</span>
      </div>

      {p.error ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-[var(--color-critical)]"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> {p.error}</p>
      ) : (
        <>
          {noWeek && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--color-critical-soft)] px-3 py-2 text-sm text-[var(--color-critical)]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              This is the {p.rc?.month} roll call, which doesn’t cover the week of {formatShort(monday)}. Pick a week in {p.rc?.month}, or upload this month’s roll call.
            </p>
          )}
          {!!p.rc?.warnings.length && (
            <ul className="mt-3 list-disc pl-5 text-xs text-[var(--color-dk-gray)]">{p.rc.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-dk-gray)]">
                <tr>
                  <th className="py-2 pr-3">Room</th>
                  <th className="py-2 pr-3">Teachers</th>
                  <th className="py-2 pr-3">Children</th>
                  <th className="py-2 pr-3">Ratio</th>
                  <th className="py-2">Openings</th>
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => {
                  const open = site ? openingsFor(site, r.roomKey, r.kids, r.teachers) : null
                  const pill = open === null ? { cls: 'text-[var(--color-mid-gray)]', text: '—' }
                    : open > 0 ? { cls: 'bg-[var(--color-good-soft)] text-[var(--color-good)]', text: `+${open} open` }
                    : open < 0 ? { cls: 'bg-[var(--color-critical-soft)] text-[var(--color-critical)]', text: `${open} over` }
                    : { cls: 'bg-[var(--color-secondary)] text-[var(--color-dk-gray)]', text: 'full' }
                  const num = (v: number, key: 'kids' | 'teachers') => (
                    <input
                      type="number" inputMode="numeric" min={0} step={1}
                      value={v}
                      disabled={p.saved}
                      aria-label={`${r.label} ${key === 'kids' ? 'children' : 'teachers'}`}
                      onChange={(e) => { const n = parseInt(e.target.value || '0', 10); if (!Number.isNaN(n) && n >= 0) onEdit(r.roomKey, { [key]: n }) }}
                      className={cn(inputClass, 'h-9 w-16 px-2 text-center font-semibold')}
                    />
                  )
                  return (
                    <tr key={r.roomKey} className="border-t border-[var(--color-border)] align-middle">
                      <td className="py-2 pr-3"><div className="font-semibold text-[var(--color-charcoal)]">{r.label}</div><div className="text-[11px] text-[var(--color-mid-gray)]">{r.age}</div></td>
                      <td className="py-2 pr-3"><div className="flex items-center gap-2">{num(r.teachers, 'teachers')}<span className="text-xs text-[var(--color-dk-gray)]">{r.teacherNames.join(', ')}</span></div></td>
                      <td className="py-2 pr-3">{num(r.kids, 'kids')}</td>
                      <td className="py-2 pr-3 text-[var(--color-dk-gray)]">{site ? `1:${effectiveRatio(site, r.roomKey)}` : ''}</td>
                      <td className="py-2"><span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-bold', pill.cls)}>{pill.text}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={onSave} disabled={p.saving || p.saved || noWeek}>
              {p.saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {p.saved ? 'Saved' : `Save ${title} for wk of ${formatShort(monday)}`}
            </Button>
            {p.saved && <span className="text-sm font-semibold text-[var(--color-good)]">Saved. The dashboard’s Openings to Staff now uses these numbers.</span>}
          </div>
        </>
      )}
    </Card>
  )
}
