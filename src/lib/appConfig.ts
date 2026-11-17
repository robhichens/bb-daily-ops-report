// src/lib/appConfig.ts
// Customize page settings: what Kathe, Molly and Rob can change without code.
// Pure functions only (no Firebase) — appConfigStore.ts loads and saves them.
//
// HOW IT WORKS
//  - The code's own constants are the DEFAULTS (captured below at import, before
//    any settings are applied). With nothing saved, the app behaves exactly as coded.
//  - Saved settings are MERGED onto the defaults by normalizeConfig(): a setting
//    the code no longer knows is dropped; something new in the code shows up even
//    though the saved copy predates it.
//  - applyConfig() writes the result into the shared arrays/objects in schema.ts and
//    reportRegistry.ts IN PLACE, so every importer sees the new values on the next
//    render. It runs once at sign-in, before any page renders.
//
// SAFETY RULES (why history never breaks)
//  - Every field, section and room has a permanent hidden key. Labels can change
//    freely; the key — where the data is stored — never does.
//  - "Built-in" = shipped in the code. A built-in field powers the dashboard,
//    print and exports, so its type, columns and section are fixed and it can't be
//    retired; only its label (and its section's title/hint) can change.
//  - Custom fields/sections are retired, not deleted, once saved: they leave the
//    form, but past reports keep and print their values.

import {
  ROOMS, CLASSROOMS, ROOM_RATIOS, RATIO_WAIVERS, SITES, DIRECTORS, REQUEST_LISTS,
  REGISTRATION_FEE, ENROLLMENT_COMMS_DAILY_GOAL, setNumberSettings,
  type FieldKind, type OrgFieldDef, type OrgReportDef, type OrgSectionDef, type OrgSubField,
  type RequestList, type SiteId,
} from './schema'
import { ORG_DEFS } from './reportRegistry'

// --- Shape -------------------------------------------------------------------

export type EditableReport = 'adr' | 'edr'
export const EDITABLE_REPORTS: EditableReport[] = ['edr', 'adr'] // CDR first: it changes most

export interface SiteSetting { id: SiteId; name: string; capacity: number; waiver: number }
export interface RoomSetting { key: string; name: string; ageGroup: string; ratio: number; sites: SiteId[] }
export interface ListColumn { key: string; label: string; type: 'text' | 'select'; optionSet?: 'sites'; options?: string[]; wide?: boolean }
export interface FieldSetting { key: string; label: string; kind: FieldKind; subFields?: ListColumn[]; retired?: boolean }
export interface SectionSetting { key: string; title: string; hint?: string; note?: boolean; retired?: boolean; fields: FieldSetting[] }
export interface ReportSetting { sections: SectionSetting[] }

export interface DorConfig {
  sites: SiteSetting[]
  rooms: RoomSetting[]
  directors: string[]
  requestLists: { id: RequestList; label: string; short: string }[]
  numbers: { registrationFee: number; commsDailyGoal: number }
  reports: Record<EditableReport, ReportSetting>
}

/** Field types a custom field can be (the form already knows how to draw each). */
export const CUSTOM_KINDS: { kind: FieldKind; label: string }[] = [
  { kind: 'count', label: 'Count (whole number)' },
  { kind: 'dollar', label: 'Dollar amount' },
  { kind: 'number', label: 'Number (decimals ok)' },
  { kind: 'toggle', label: 'Yes / No' },
  { kind: 'text', label: 'Text' },
  { kind: 'list', label: 'Named list (rows)' },
]
export const kindLabel = (k: FieldKind) => CUSTOM_KINDS.find((c) => c.kind === k)?.label ?? k

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

// --- Defaults (the code, as shipped) ---------------------------------------------

function sectionToSetting(s: OrgSectionDef): SectionSetting {
  return {
    key: s.key, title: s.title, hint: s.hint, note: !!s.note,
    fields: s.fields.map((f) => ({ key: f.key, label: f.label, kind: f.kind, subFields: f.subFields?.map((c) => ({ ...c })) })),
  }
}

const allSiteIds = () => SITES.map((s) => s.id)

function buildDefaults(): DorConfig {
  return clone({
    sites: SITES.map((s) => ({ id: s.id, name: s.name, capacity: s.capacity, waiver: RATIO_WAIVERS[s.id] ?? 0 })),
    rooms: ROOMS.map((r) => ({ key: r.key, name: r.name, ageGroup: r.ageGroup, ratio: ROOM_RATIOS[r.key] ?? 0, sites: r.sites ? [...r.sites] : allSiteIds() })),
    directors: [...DIRECTORS],
    requestLists: REQUEST_LISTS.map((l) => ({ ...l })),
    numbers: { registrationFee: REGISTRATION_FEE, commsDailyGoal: ENROLLMENT_COMMS_DAILY_GOAL },
    reports: {
      adr: { sections: ORG_DEFS.adr!.sections.map(sectionToSetting) },
      edr: { sections: ORG_DEFS.edr!.sections.map(sectionToSetting) },
    },
  })
}

/** The code's own settings, captured before anything saved is applied. */
const DEFAULTS: DorConfig = buildDefaults()
/** Code-only structure of the built-in sections (matrix grids, conditional fields). */
const DEFAULT_SECTIONS: Record<EditableReport, OrgSectionDef[]> = {
  adr: clone(ORG_DEFS.adr!.sections),
  edr: clone(ORG_DEFS.edr!.sections),
}

export const defaultConfig = (): DorConfig => clone(DEFAULTS)

// --- Built-in checks -------------------------------------------------------------

const defSection = (r: EditableReport, sectionKey: string) => DEFAULT_SECTIONS[r].find((s) => s.key === sectionKey)

export const isBuiltInSection = (r: EditableReport, sectionKey: string) => !!defSection(r, sectionKey)
export const isBuiltInField = (r: EditableReport, sectionKey: string, fieldKey: string) =>
  !!defSection(r, sectionKey)?.fields.some((f) => f.key === fieldKey)
export const isBuiltInRoom = (key: string) => DEFAULTS.rooms.some((r) => r.key === key)
/** A built-in section whose content is a fixed grid (ADR Openings to Staff). */
export const isGridSection = (r: EditableReport, sectionKey: string) => !!defSection(r, sectionKey)?.matrix
/** A built-in field that only shows when another one is set (e.g. "What got in the way?"). */
/** A column a built-in list shipped with (its type is fixed). */
export const isBuiltInColumn = (r: EditableReport, sectionKey: string, fieldKey: string, colKey: string) =>
  !!defSection(r, sectionKey)?.fields.find((f) => f.key === fieldKey)?.subFields?.some((c) => c.key === colKey)
export const isConditionalField = (r: EditableReport, sectionKey: string, fieldKey: string) =>
  !!defSection(r, sectionKey)?.fields.find((f) => f.key === fieldKey)?.showWhen

// --- Keys --------------------------------------------------------------------------

/** "Text messages sent" → "textMessagesSent", unique among `taken`. Made once, when
 *  the item is created, and never changed after (it's where the data lives). */
export function makeKey(label: string, taken: Iterable<string>): string {
  const words = label.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5)
  let base = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('') || 'item'
  if (/^\d/.test(base)) base = `x${base}`
  // Never collide with the per-section note or the grid's bookkeeping keys.
  const used = new Set([...taken, 'note', '__calc'])
  let key = base
  for (let i = 2; used.has(key); i++) key = `${base}${i}`
  return key
}

/** Before a save: anything NEW since the last save gets its permanent key from its
 *  name ("Walk-in families" → walkInFamilies) instead of the placeholder it was
 *  created with. Saved items keep theirs — their data already lives there. */
export function finalizeKeys(draft: DorConfig, saved: DorConfig): DorConfig {
  const c: DorConfig = clone(draft)
  const rekey = <T extends { key: string }>(items: T[], isNew: (x: T) => boolean, name: (x: T) => string) => {
    for (const x of items) {
      if (!isNew(x)) continue
      x.key = makeKey(name(x), items.filter((y) => y !== x).map((y) => y.key))
    }
  }
  rekey(c.rooms, (r) => !saved.rooms.some((x) => x.key === r.key), (r) => r.name)
  for (const rk of EDITABLE_REPORTS) {
    const savedSecs = saved.reports[rk].sections
    rekey(c.reports[rk].sections, (s) => !savedSecs.some((x) => x.key === s.key), (s) => s.title)
    for (const s of c.reports[rk].sections) {
      const savedSec = savedSecs.find((x) => x.key === s.key)
      rekey(s.fields, (f) => !savedSec?.fields.some((x) => x.key === f.key), (f) => f.label)
      for (const f of s.fields) {
        if (!f.subFields) continue
        const savedCols = savedSec?.fields.find((x) => x.key === f.key)?.subFields ?? []
        rekey(f.subFields, (col) => !savedCols.some((x) => x.key === col.key) && !isBuiltInColumn(rk, s.key, f.key, col.key), (col) => col.label)
      }
    }
  }
  return c
}

// --- Merge saved settings onto the defaults -------------------------------------------

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)
const optStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const nonNeg = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback)
const KINDS = new Set(CUSTOM_KINDS.map((k) => k.kind))
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function cleanColumns(v: unknown): ListColumn[] {
  if (!Array.isArray(v)) return []
  const out: ListColumn[] = []
  for (const c of v) {
    if (!isObj(c) || typeof c.key !== 'string' || !c.key || out.some((x) => x.key === c.key)) continue
    const type = c.type === 'select' ? 'select' : 'text'
    const col: ListColumn = { key: c.key, label: str(c.label, c.key), type }
    const options = Array.isArray(c.options) ? c.options.filter((o): o is string => typeof o === 'string' && !!o.trim()).map((o) => o.trim()) : []
    if (type === 'select') {
      if (c.optionSet === 'sites') col.optionSet = 'sites'
      else col.options = options
    } else if (options.length) col.options = options // kept so a coded dropdown still gets its choices
    if (c.wide) col.wide = true
    out.push(col)
  }
  return out
}

function normalizeReport(r: EditableReport, saved: unknown): ReportSetting {
  const defaults = DEFAULTS.reports[r].sections
  const savedSections = isObj(saved) && Array.isArray(saved.sections) ? saved.sections.filter(isObj) : []
  const out: SectionSetting[] = []
  const seen = new Set<string>()

  const mergeSection = (def: SectionSetting | undefined, s: Record<string, unknown> | undefined): SectionSetting | null => {
    if (def) {
      // Built-in: structure from the code; title, hint and field labels/order from the saved copy.
      const savedFields = s && Array.isArray(s.fields) ? s.fields.filter(isObj) : []
      const fields: FieldSetting[] = []
      const fseen = new Set<string>()
      for (const f of savedFields) {
        if (typeof f.key !== 'string' || fseen.has(f.key)) continue
        const builtIn = def.fields.find((d) => d.key === f.key)
        if (builtIn) {
          const merged: FieldSetting = { ...clone(builtIn), label: typeof f.label === 'string' ? f.label.trim() || builtIn.label : builtIn.label }
          if (builtIn.kind === 'list') merged.subFields = mergeColumns(builtIn.subFields ?? [], f.subFields)
          fields.push(merged); fseen.add(f.key)
        }
        else { const c = customField(f); if (c) { fields.push(c); fseen.add(c.key) } }
      }
      for (const d of def.fields) if (!fseen.has(d.key)) fields.push(clone(d)) // new in the code since this was saved
      return { key: def.key, title: str(s?.title, def.title), hint: s && 'hint' in s ? optStr(s.hint) : def.hint, note: def.note, fields }
    }
    if (!s || typeof s.key !== 'string' || !s.key) return null
    const fields = (Array.isArray(s.fields) ? s.fields.filter(isObj) : []).map(customField).filter((f): f is FieldSetting => !!f)
    const uniq = fields.filter((f, i) => fields.findIndex((x) => x.key === f.key) === i)
    return { key: s.key, title: str(s.title, 'Untitled section'), hint: optStr(s.hint), note: !!s.note, retired: !!s.retired, fields: uniq }
  }

  for (const s of savedSections) {
    if (typeof s.key !== 'string' || seen.has(s.key)) continue
    const merged = mergeSection(defaults.find((d) => d.key === s.key), s)
    if (merged) { out.push(merged); seen.add(merged.key) }
  }
  for (const d of defaults) if (!seen.has(d.key)) out.push(mergeSection(d, undefined)!)
  return { sections: out }
}

/** A built-in list's columns: the coded ones stay (type fixed; label and dropdown
 *  choices editable), and columns added on the Customize page follow. */
function mergeColumns(coded: ListColumn[], saved: unknown): ListColumn[] {
  const savedCols = cleanColumns(saved)
  const out = coded.map((c) => {
    const x = savedCols.find((v) => v.key === c.key)
    const col = { ...c, label: x?.label || c.label }
    if (c.type === 'select' && !c.optionSet && x?.options?.length) col.options = x.options
    return col
  })
  for (const x of savedCols) if (!coded.some((c) => c.key === x.key)) out.push(x)
  return out
}

function customField(f: Record<string, unknown>): FieldSetting | null {
  if (typeof f.key !== 'string' || !f.key || f.key === 'note' || !KINDS.has(f.kind as FieldKind)) return null
  const field: FieldSetting = { key: f.key, label: str(f.label, 'Untitled'), kind: f.kind as FieldKind }
  if (field.kind === 'list') field.subFields = cleanColumns(f.subFields)
  if (f.retired) field.retired = true
  return field
}

/** Saved settings (whatever shape, possibly older code) → a complete, safe config. */
export function normalizeConfig(saved: unknown): DorConfig {
  const d = DEFAULTS
  const s = isObj(saved) ? saved : {}
  const savedSites = Array.isArray(s.sites) ? s.sites.filter(isObj) : []
  const sites = d.sites.map((def) => {
    const x = savedSites.find((v) => v.id === def.id)
    return { id: def.id, name: str(x?.name, def.name), capacity: nonNeg(x?.capacity, def.capacity), waiver: nonNeg(x?.waiver, def.waiver) }
  })
  const ids = new Set(d.sites.map((x) => x.id))
  const rooms: RoomSetting[] = []
  for (const r of Array.isArray(s.rooms) ? s.rooms.filter(isObj) : []) {
    if (typeof r.key !== 'string' || !r.key || rooms.some((x) => x.key === r.key)) continue
    const def = d.rooms.find((x) => x.key === r.key)
    rooms.push({
      key: r.key,
      name: str(r.name, def?.name ?? 'New room'),
      ageGroup: typeof r.ageGroup === 'string' ? r.ageGroup.trim() : def?.ageGroup ?? '',
      ratio: nonNeg(r.ratio, def?.ratio ?? 0),
      sites: Array.isArray(r.sites) ? r.sites.filter((x): x is SiteId => ids.has(x as SiteId)) : def?.sites ?? [],
    })
  }
  for (const def of d.rooms) if (!rooms.some((x) => x.key === def.key)) rooms.push(clone(def)) // a room added in the code later

  const directors = Array.isArray(s.directors)
    ? [...new Set(s.directors.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))]
    : [...d.directors]
  const savedLists = Array.isArray(s.requestLists) ? s.requestLists.filter(isObj) : []
  const requestLists = d.requestLists.map((def) => {
    const x = savedLists.find((v) => v.id === def.id)
    return { id: def.id, label: str(x?.label, def.label), short: str(x?.short, def.short) }
  })
  const n = isObj(s.numbers) ? s.numbers : {}
  const reports = isObj(s.reports) ? s.reports : {}
  return {
    sites, rooms, directors, requestLists,
    numbers: { registrationFee: nonNeg(n.registrationFee, d.numbers.registrationFee), commsDailyGoal: nonNeg(n.commsDailyGoal, d.numbers.commsDailyGoal) },
    reports: { adr: normalizeReport('adr', reports.adr), edr: normalizeReport('edr', reports.edr) },
  }
}

// --- Check before saving ------------------------------------------------------------

/** Plain-English problems that would stop a save (empty = good to go). */
export function validateConfig(c: DorConfig): string[] {
  const p: string[] = []
  for (const s of c.sites) {
    if (!s.name.trim()) p.push('Every school needs a name.')
    if (!(s.capacity > 0)) p.push(`${s.name || 'A school'}: licensed capacity must be more than 0.`)
  }
  const roomNames = new Set<string>()
  for (const r of c.rooms) {
    const name = r.name.trim()
    if (!name) p.push('Every room needs a name.')
    else if (roomNames.has(name.toLowerCase())) p.push(`Two rooms are called “${name}”. Room names must be different (the roll call matches by name).`)
    roomNames.add(name.toLowerCase())
    if (r.sites.length && !(r.ratio > 0)) p.push(`${name || 'A room'}: the ratio must be more than 0.`)
  }
  for (const s of c.sites) if (!c.rooms.some((r) => r.sites.includes(s.id))) p.push(`${s.name} has no rooms ticked.`)
  for (const l of c.requestLists) if (!l.label.trim() || !l.short.trim()) p.push('Each Buy/Fix list needs a name and a short button label.')

  for (const rk of EDITABLE_REPORTS) {
    const rname = rk === 'edr' ? 'CDR' : 'ADR'
    for (const sec of c.reports[rk].sections) {
      if (!sec.title.trim()) p.push(`${rname}: a section has no title.`)
      const live = sec.fields.filter((f) => !f.retired)
      if (!sec.retired && !isBuiltInSection(rk, sec.key) && !live.length && !sec.note) p.push(`${rname} “${sec.title}”: add a field (or a note) or retire the section.`)
      for (const f of sec.fields) {
        if (!f.label.trim() && !(f.kind === 'list' && isBuiltInField(rk, sec.key, f.key))) p.push(`${rname} “${sec.title}”: a field has no label.`)
        if (f.kind === 'list' && !f.retired) {
          if (!f.subFields?.length) p.push(`${rname} “${f.label || sec.title}”: a named list needs at least one column.`)
          for (const col of f.subFields ?? []) {
            if (!col.label.trim()) p.push(`${rname} “${f.label}”: a column has no name.`)
            if (col.type === 'select' && !col.optionSet && !col.options?.length) p.push(`${rname} “${f.label}” → “${col.label}”: a dropdown needs at least one choice.`)
          }
        }
      }
    }
  }
  return [...new Set(p)]
}

// --- Apply to the running app -------------------------------------------------------------

/** Settings → the form's section definitions (built-ins keep their code-only structure). */
export function toOrgSections(r: EditableReport, setting: ReportSetting): OrgSectionDef[] {
  return setting.sections.map((s) => {
    const def = defSection(r, s.key)
    const fields: OrgFieldDef[] = s.fields.map((f) => {
      const builtIn = def?.fields.find((d) => d.key === f.key)
      const out: OrgFieldDef = builtIn ? { ...clone(builtIn), label: f.label } : { key: f.key, label: f.label, kind: f.kind }
      if (f.kind === 'list') out.subFields = (f.subFields ?? []).map((c) => ({ ...c }) as OrgSubField)
      if (!builtIn && f.retired) out.retired = true
      return out
    })
    const sec: OrgSectionDef = { key: s.key, title: s.title, hint: s.hint, fields, note: def ? def.note : s.note }
    if (def?.matrix) sec.matrix = gridFor(def.matrix.staffing)
    if (!def && s.retired) sec.retired = true
    return sec
  })
}

/** The ADR Openings-to-Staff grid, from the current rooms and schools. */
function gridFor(staffing?: boolean): NonNullable<OrgSectionDef['matrix']> {
  return {
    rows: ROOMS.map((c) => ({ key: c.key, label: c.name, sub: c.ageGroup, sites: c.sites })),
    columns: SITES.map((s) => ({ key: s.id, label: s.name })),
    kind: 'number',
    staffing,
  }
}

/** Puts settings into effect (in place — every importer sees them). */
export function applyConfig(c: DorConfig): void {
  for (const s of c.sites) {
    const site = SITES.find((x) => x.id === s.id)
    if (site) { site.name = s.name; site.capacity = s.capacity }
    RATIO_WAIVERS[s.id] = s.waiver
  }
  const all = SITES.length
  const rooms = c.rooms.filter((r) => r.sites.length).map((r) => ({
    key: r.key, name: r.name, ageGroup: r.ageGroup,
    ...(r.sites.length < all ? { sites: [...r.sites] } : {}),
  }))
  ROOMS.splice(0, ROOMS.length, ...rooms)
  CLASSROOMS.splice(0, CLASSROOMS.length, ...ROOMS.filter((r) => !r.sites))
  for (const k of Object.keys(ROOM_RATIOS)) if (!c.rooms.some((r) => r.key === k)) delete ROOM_RATIOS[k]
  for (const r of c.rooms) ROOM_RATIOS[r.key] = r.ratio
  DIRECTORS.splice(0, DIRECTORS.length, ...c.directors)
  for (const l of c.requestLists) {
    const list = REQUEST_LISTS.find((x) => x.id === l.id)
    if (list) { list.label = l.label; list.short = l.short }
  }
  setNumberSettings(c.numbers)
  for (const r of EDITABLE_REPORTS) {
    const def = ORG_DEFS[r] as OrgReportDef
    def.sections = toOrgSections(r, c.reports[r])
  }
}

// --- What changed (for the save summary and history) -------------------------------------

/** Short plain-English list of differences between two configs. */
export function describeChanges(before: DorConfig, after: DorConfig): string[] {
  const out: string[] = []
  for (const s of after.sites) {
    const b = before.sites.find((x) => x.id === s.id)
    if (!b) continue
    if (b.name !== s.name) out.push(`School renamed: ${b.name} → ${s.name}`)
    if (b.capacity !== s.capacity) out.push(`${s.name} capacity ${b.capacity} → ${s.capacity}`)
    if (b.waiver !== s.waiver) out.push(`${s.name} ratio waiver +${b.waiver} → +${s.waiver}`)
  }
  for (const r of after.rooms) {
    const b = before.rooms.find((x) => x.key === r.key)
    if (!b) { out.push(`Room added: ${r.name}`); continue }
    if (b.name !== r.name) out.push(`Room renamed: ${b.name} → ${r.name}`)
    if (b.ageGroup !== r.ageGroup) out.push(`${r.name} age group → ${r.ageGroup || '(blank)'}`)
    if (b.ratio !== r.ratio) out.push(`${r.name} ratio 1:${b.ratio} → 1:${r.ratio}`)
    if (b.sites.join() !== r.sites.join()) out.push(`${r.name} schools changed`)
  }
  if (before.rooms.map((r) => r.key).join() !== after.rooms.map((r) => r.key).join() && out.every((x) => !x.startsWith('Room added'))) out.push('Rooms reordered')
  if (before.directors.join('|') !== after.directors.join('|')) out.push('Director list changed')
  for (const l of after.requestLists) {
    const b = before.requestLists.find((x) => x.id === l.id)
    if (b && (b.label !== l.label || b.short !== l.short)) out.push(`List renamed: ${b.label} → ${l.label}`)
  }
  if (before.numbers.registrationFee !== after.numbers.registrationFee) out.push(`Registration fee $${before.numbers.registrationFee} → $${after.numbers.registrationFee}`)
  if (before.numbers.commsDailyGoal !== after.numbers.commsDailyGoal) out.push(`Daily enrollment comms goal ${before.numbers.commsDailyGoal} → ${after.numbers.commsDailyGoal}`)
  for (const rk of EDITABLE_REPORTS) {
    const rname = rk === 'edr' ? 'CDR' : 'ADR'
    const bs = before.reports[rk].sections
    for (const s of after.reports[rk].sections) {
      const b = bs.find((x) => x.key === s.key)
      if (!b) { out.push(`${rname}: section added — ${s.title}`); continue }
      if (b.title !== s.title) out.push(`${rname}: section renamed — ${b.title} → ${s.title}`)
      if ((b.hint ?? '') !== (s.hint ?? '')) out.push(`${rname} ${s.title}: hint changed`)
      if (!b.retired && s.retired) out.push(`${rname}: section retired — ${s.title}`)
      if (b.retired && !s.retired) out.push(`${rname}: section brought back — ${s.title}`)
      for (const f of s.fields) {
        const bf = b.fields.find((x) => x.key === f.key)
        if (!bf) { out.push(`${rname} ${s.title}: added “${f.label}”`); continue }
        if (bf.label !== f.label) out.push(`${rname} ${s.title}: “${bf.label}” → “${f.label}”`)
        if (!bf.retired && f.retired) out.push(`${rname} ${s.title}: retired “${f.label}”`)
        if (bf.retired && !f.retired) out.push(`${rname} ${s.title}: brought back “${f.label}”`)
        if (JSON.stringify(bf.subFields ?? []) !== JSON.stringify(f.subFields ?? [])) out.push(`${rname} ${s.title}: “${f.label}” columns changed`)
      }
      if (b.fields.map((x) => x.key).join() !== s.fields.map((x) => x.key).join() && s.fields.every((f) => b.fields.some((x) => x.key === f.key))) out.push(`${rname} ${s.title}: fields reordered`)
    }
    if (bs.map((x) => x.key).join() !== after.reports[rk].sections.map((x) => x.key).join() && after.reports[rk].sections.every((s) => bs.some((x) => x.key === s.key))) out.push(`${rname}: sections reordered`)
  }
  return out
}
