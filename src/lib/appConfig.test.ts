import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('./firebase', () => ({ auth: {}, db: {} })) // orgReports pulls in the client
import {
  applyConfig, defaultConfig, describeChanges, finalizeKeys, isBuiltInField, makeKey, normalizeConfig, validateConfig, type DorConfig,
} from './appConfig'
import { EXTRA_DEFS, EXTRA_SECTIONS, ORG_DEFS } from './reportRegistry'
import {
  CLASSROOMS, DDR_TITLES, DIRECTORS, ENROLLMENT_FIELDS, FDR_TEXT, FINANCE_AGENCIES, REGISTRATION_FEE, REQUEST_LISTS, ROOM_RATIOS, SITES, STAFF_FIELDS,
  effectiveRatio, emptyFinanceReport, emptyReport, openingsFor, roomsFor, type OrgReport,
} from './schema'
import { emptyOrgReport } from './orgReports'
import { buildDdrPrintModel, buildFdrPrintModel, buildOrgPrintModel } from './printModel'
import { customTotals, customTotalsFrom, cdrSummary, fdrSummary } from './dashboardReports'
import { orgFieldLabel } from './reportRegistry'

afterEach(() => applyConfig(defaultConfig())) // every test starts from the code's defaults

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const edrSection = (c: DorConfig, key: string) => c.reports.edr.sections.find((s) => s.key === key)!

describe('defaults', () => {
  it('nothing saved = exactly the coded app', () => {
    expect(normalizeConfig(undefined)).toEqual(defaultConfig())
    expect(normalizeConfig(defaultConfig())).toEqual(defaultConfig())
    expect(defaultConfig().rooms.map((r) => r.key)).toEqual(['lions', 'hippos', 'elephants', 'monkeys', 'giraffes', 'tigers', 'zebras', 'cheetahs'])
    expect(defaultConfig().rooms.find((r) => r.key === 'giraffes')!.sites).toEqual(['crozet'])
  })

  it('applying the defaults changes nothing', () => {
    const before = JSON.stringify({ s: ORG_DEFS.edr!.sections, r: roomsFor('crozet'), c: CLASSROOMS })
    applyConfig(defaultConfig())
    expect(JSON.stringify({ s: ORG_DEFS.edr!.sections, r: roomsFor('crozet'), c: CLASSROOMS })).toBe(before)
  })
})

describe('built-in fields are safe', () => {
  it('a rename sticks, but the type, columns and section can’t be changed from saved settings', () => {
    const c = defaultConfig()
    const enrollment = edrSection(c, 'enrollment')
    const leads = enrollment.fields.find((f) => f.key === 'newLeads')!
    leads.label = 'Fresh inquiries'
    leads.kind = 'text' // tampered
    leads.retired = true // built-ins can't be retired
    const n = normalizeConfig(c)
    expect(edrSection(n, 'enrollment').fields.find((f) => f.key === 'newLeads')).toEqual({ key: 'newLeads', label: 'Fresh inquiries', kind: 'count' })
    applyConfig(n)
    expect(orgFieldLabel('edr', 'enrollment', 'newLeads', 'New leads')).toBe('Fresh inquiries') // the dashboard follows
  })

  it('a field the code adds later still shows up on an older saved copy', () => {
    const c = defaultConfig()
    edrSection(c, 'enrollment').fields = edrSection(c, 'enrollment').fields.filter((f) => f.key !== 'textsSent')
    expect(edrSection(normalizeConfig(c), 'enrollment').fields.map((f) => f.key)).toContain('textsSent')
  })

  it('a built-in list takes new dropdown choices and columns, but keeps its own columns', () => {
    const c = defaultConfig()
    const items = edrSection(c, 'tasks').fields[0]
    items.subFields![0].options = ['Task', 'Project', 'Classroom coverage', 'Event']
    items.subFields![0].type = 'text' // tampered: type stays a dropdown
    items.subFields = items.subFields!.filter((col) => col.key !== 'details') // can't drop a coded column
    items.subFields.push({ key: 'hours', label: 'Hours', type: 'text' })
    applyConfig(normalizeConfig(c))
    const cols = ORG_DEFS.edr!.sections.find((s) => s.key === 'tasks')!.fields[0].subFields!
    expect(cols.map((col) => col.key)).toEqual(['type', 'title', 'details', 'hours'])
    expect(cols[0]).toMatchObject({ type: 'select', options: ['Task', 'Project', 'Classroom coverage', 'Event'] })
  })

  it('the conditional "What got in the way?" keeps its show-when rule', () => {
    applyConfig(normalizeConfig(defaultConfig()))
    expect(ORG_DEFS.edr!.sections.find((s) => s.key === 'facility')!.fields[1].showWhen).toEqual({ key: 'complete', equals: false })
  })
})

describe('custom fields', () => {
  function withCustom(): DorConfig {
    const c = defaultConfig()
    edrSection(c, 'enrollment').fields.push({ key: 'walkIns', label: 'Walk-in families', kind: 'count' })
    c.reports.edr.sections.push({ key: 'safety', title: 'Safety', hint: 'Drills done today', fields: [
      { key: 'fireDrill', label: 'Fire drill held?', kind: 'toggle' },
      { key: 'visitors', label: 'Visitors', kind: 'list', subFields: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'campus', label: 'Campus', type: 'select', optionSet: 'sites' }] },
    ] })
    return normalizeConfig(c)
  }
  const report = (data: Record<string, Record<string, unknown>>, siteId = 'crozet'): OrgReport =>
    ({ id: 'x', date: '2026-11-16', day: '', weekOf: '', siteId, completedBy: 'Jenna', data, status: 'submitted', submittedAt: '', createdAt: '', updatedAt: '', createdByUid: '' }) as OrgReport

  it('appear on the form and in a blank report', () => {
    applyConfig(withCustom())
    const def = ORG_DEFS.edr!
    expect(def.sections.find((s) => s.key === 'enrollment')!.fields.map((f) => f.key)).toContain('walkIns')
    expect(def.sections.at(-1)).toMatchObject({ key: 'safety', title: 'Safety', note: false })
    const blank = emptyOrgReport(def, '2026-11-16', 'u', 'crozet')
    expect(blank.data.enrollment.walkIns).toBe(0)
    expect(blank.data.safety).toEqual({ fireDrill: false, visitors: [] })
    expect(isBuiltInField('edr', 'enrollment', 'walkIns')).toBe(false)
  })

  it('get a dashboard total vs the prior period', () => {
    applyConfig(withCustom())
    const cur = [report({ enrollment: { walkIns: 3 }, safety: { fireDrill: true, visitors: [{ name: 'Fire marshal', campus: 'crozet' }, { name: '', campus: '' }] } }), report({ enrollment: { walkIns: 2 }, safety: { fireDrill: false } })]
    const prev = [report({ enrollment: { walkIns: 1 } })]
    const t = customTotals('edr', cur, prev)
    expect(t.map((x) => [x.label, x.now, x.before])).toEqual([['Walk-in families', 5, 1], ['Fire drill held?', 1, 0], ['Visitors', 1, 0]])
    expect(cdrSummary(cur, prev, ['crozet']).custom).toHaveLength(3)
  })

  it('retired: off the form and the dashboard, but a past report that has it still prints it', () => {
    const c = withCustom()
    edrSection(c, 'enrollment').fields.find((f) => f.key === 'walkIns')!.retired = true
    applyConfig(normalizeConfig(c))
    const def = ORG_DEFS.edr!
    expect(def.sections.find((s) => s.key === 'enrollment')!.fields.find((f) => f.key === 'walkIns')!.retired).toBe(true)
    expect(emptyOrgReport(def, '2026-11-16').data.enrollment).not.toHaveProperty('walkIns')
    expect(customTotals('edr', [report({ enrollment: { walkIns: 3 } })], []).map((x) => x.key)).not.toContain('enrollment.walkIns')
    const labels = (r: OrgReport) => buildOrgPrintModel(def, r).sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'fields' ? b.fields.map((f) => f.label) : [])))
    expect(labels(report({ enrollment: { walkIns: 3 } }))).toContain('Walk-in families')
    expect(labels(report({ enrollment: {} }))).not.toContain('Walk-in families')
  })

  it('junk in saved settings is dropped, not crashed on', () => {
    const n = normalizeConfig({ reports: { edr: { sections: [{ key: 'x', title: 'X', fields: [{ key: 'a', label: 'A', kind: 'rocket' }, { key: 'note', label: 'Bad', kind: 'count' }, 'nope'] }, null] } }, rooms: 'nope', sites: [{ id: 'crozet', capacity: -5 }] })
    expect(n.reports.edr.sections.find((s) => s.key === 'x')!.fields).toEqual([])
    expect(n.sites[0].capacity).toBe(135)
    expect(n.rooms).toEqual(defaultConfig().rooms)
  })
})

describe('schools, rooms and lists', () => {
  it('rename, re-ratio, re-school and add rooms; the roll call, grid and openings follow', () => {
    const c = defaultConfig()
    c.rooms.find((r) => r.key === 'monkeys')!.name = 'Monkeys Room'
    c.rooms.find((r) => r.key === 'monkeys')!.ratio = 9
    c.rooms.find((r) => r.key === 'giraffes')!.sites = [] // Giraffes closes
    c.rooms.push({ key: 'owls', name: 'Owls', ageGroup: 'Pre-K', ratio: 12, sites: ['mill-creek'] })
    c.sites[1].capacity = 125
    c.sites[0].waiver = 0
    applyConfig(normalizeConfig(c))
    expect(roomsFor('crozet').map((r) => r.key)).toEqual(['lions', 'hippos', 'elephants', 'monkeys', 'tigers', 'zebras', 'cheetahs'])
    expect(roomsFor('mill-creek').map((r) => r.name)).toContain('Owls')
    expect(CLASSROOMS.map((r) => r.key)).not.toContain('owls')
    expect(ROOM_RATIOS.owls).toBe(12)
    expect(effectiveRatio('crozet', 'monkeys')).toBe(9) // waiver now 0
    expect(openingsFor('mill-creek', 'owls', 10, 1)).toBe(2)
    expect(SITES[1].capacity).toBe(125)
    const grid = ORG_DEFS.adr!.sections.find((s) => s.key === 'openingsToStaff')!.matrix!
    expect(grid.rows.map((r) => r.key)).toEqual(['lions', 'hippos', 'elephants', 'monkeys', 'tigers', 'zebras', 'cheetahs', 'owls'])
    expect(grid.rows.find((r) => r.key === 'monkeys')!.label).toBe('Monkeys Room')
  })

  it('directors, list names and numbers', () => {
    const c = defaultConfig()
    c.directors = ['Laura Baker', '  ', 'Laura Baker', 'New Person']
    c.requestLists[0].label = 'Shopping list'
    c.numbers.registrationFee = 225
    applyConfig(normalizeConfig(c))
    expect(DIRECTORS).toEqual(['Laura Baker', 'New Person'])
    expect(REQUEST_LISTS[0].label).toBe('Shopping list')
    expect(REGISTRATION_FEE).toBe(225)
  })
})

describe('checks before saving', () => {
  it('flags the things that would break the app', () => {
    const c = defaultConfig()
    c.rooms[1].name = 'Lions'
    c.sites[2].capacity = 0
    for (const r of c.rooms) r.sites = r.sites.filter((s) => s !== 'forest-lakes')
    c.reports.edr.sections.push({ key: 'empty', title: 'Empty', fields: [] })
    edrSection(c, 'social').fields.push({ key: 'x', label: 'Things', kind: 'list', subFields: [{ key: 'kind', label: 'Kind', type: 'select', options: [] }] })
    const p = validateConfig(c).join(' | ')
    expect(p).toMatch(/Two rooms are called “Lions”/)
    expect(p).toMatch(/Mill Creek: licensed capacity/)
    expect(p).toMatch(/Forest Lakes has no rooms/)
    expect(p).toMatch(/“Empty”: add a field/)
    expect(p).toMatch(/dropdown needs at least one choice/)
    expect(validateConfig(defaultConfig())).toEqual([])
  })

  it('makes a permanent key once, never clashing', () => {
    expect(makeKey('Text messages sent', [])).toBe('textMessagesSent')
    expect(makeKey('Text messages sent', ['textMessagesSent'])).toBe('textMessagesSent2')
    expect(makeKey('Note', [])).toBe('note2')
    expect(makeKey('3 day check', [])).toBe('x3DayCheck')
    expect(makeKey('!!!', [])).toBe('item')
  })

  it('new items get their permanent key from their name at save; saved ones keep theirs', () => {
    const saved = defaultConfig()
    const d = defaultConfig()
    d.rooms.push({ key: 'room', name: 'Owls', ageGroup: '', ratio: 10, sites: ['crozet'] })
    d.rooms[0].name = 'Lion Cubs' // renamed, not new → key stays
    edrSection(d, 'enrollment').fields.push({ key: 'newField', label: 'Walk-in families', kind: 'list', subFields: [{ key: 'column', label: 'Family name', type: 'text' }] })
    d.reports.edr.sections.push({ key: 'newSection', title: 'Safety', fields: [{ key: 'newField', label: 'Fire drill?', kind: 'toggle' }] })
    edrSection(d, 'tasks').fields[0].subFields!.push({ key: 'column', label: 'Hours', type: 'text' })
    const f = finalizeKeys(d, saved)
    expect(f.rooms.map((r) => r.key)).toEqual([...saved.rooms.map((r) => r.key), 'owls'])
    expect(edrSection(f, 'enrollment').fields.at(-1)).toMatchObject({ key: 'walkInFamilies', subFields: [{ key: 'familyName' }] })
    expect(f.reports.edr.sections.at(-1)).toMatchObject({ key: 'safety', fields: [{ key: 'fireDrill' }] })
    expect(edrSection(f, 'tasks').fields[0].subFields!.map((c) => c.key)).toEqual(['type', 'title', 'details', 'hours'])
    // once saved, a rename doesn't move it
    const again = clone(f); edrSection(again, 'enrollment').fields.at(-1)!.label = 'Walk-ins'
    expect(edrSection(finalizeKeys(again, f), 'enrollment').fields.at(-1)!.key).toBe('walkInFamilies')
  })

  it('describes what changed, in plain English', () => {
    const a = defaultConfig()
    const b = defaultConfig()
    b.rooms.find((r) => r.key === 'lions')!.ratio = 5
    edrSection(b, 'enrollment').fields.find((f) => f.key === 'newLeads')!.label = 'Fresh inquiries'
    edrSection(b, 'enrollment').fields.push({ key: 'walkIns', label: 'Walk-ins', kind: 'count' })
    expect(describeChanges(a, b)).toEqual(['Lions ratio 1:4 → 1:5', 'CDR Enrollment / IKS: “New leads” → “Fresh inquiries”', 'CDR Enrollment / IKS: added “Walk-ins”'])
    expect(describeChanges(a, defaultConfig())).toEqual([])
  })
})

describe('DDR / FDR (Release 2)', () => {
  const ddrText = (c: DorConfig, key: string) => c.text.ddr.find((t) => t.key === key)!

  it('renames DDR headings, rows, hints and choices everywhere the form, print and dashboard read them', () => {
    const c = defaultConfig()
    ddrText(c, 'title.staff').label = 'Team'
    ddrText(c, 'toursGiven').label = 'Tours given'
    ddrText(c, 'callsInEmailsWeb').choices = ['Call', 'Email', 'Web', 'Walk-in', 'Facebook']
    ddrText(c, 'rtoVacation').hint = 'Planned time off only'
    applyConfig(normalizeConfig(c))
    expect(DDR_TITLES.staff).toBe('Team')
    expect(ENROLLMENT_FIELDS.find((f) => f.key === 'toursGiven')!.label).toBe('Tours given')
    expect(ENROLLMENT_FIELDS.find((f) => f.key === 'callsInEmailsWeb')!.itemFields!.find((x) => x.key === 'type')!.options).toContain('Facebook')
    expect(STAFF_FIELDS.find((f) => f.key === 'rtoVacation')!.hint).toBe('Planned time off only')
    const print = buildDdrPrintModel(emptyReport('crozet', '2026-11-19'))
    expect(print.sections.map((s) => s.title)).toContain('Team')
  })

  it('only the code decides which wording exists; the Call-out/Late select is not offered', () => {
    const c = normalizeConfig({ text: { ddr: [{ key: 'madeUp', label: 'x' }, { key: 'callOutsLate', label: 'Call outs', choices: ['A'] }] } })
    expect(c.text.ddr.some((t) => t.key === 'madeUp')).toBe(false)
    expect(ddrText(c, 'callOutsLate')).toMatchObject({ label: 'Call outs' })
    expect(ddrText(c, 'callOutsLate').choices).toBeUndefined()
    expect(normalizeConfig({ text: { ddr: [{ key: 'toursGiven', label: '   ' }] } }).text.ddr.find((t) => t.key === 'toursGiven')!.label).toBe('Number of Tours Given')
  })

  it('the comms goal setting now reaches the DDR goal pill and its hint', () => {
    const c = defaultConfig()
    c.numbers.commsDailyGoal = 12
    applyConfig(c)
    const comms = ENROLLMENT_FIELDS.find((f) => f.key === 'enrollmentCommsOut')!
    expect(comms.goal).toBe(12)
    expect(comms.hint).toMatch(/goal is 12/)
  })

  it('FDR wording and agencies', () => {
    const c = defaultConfig()
    c.text.fdr.find((t) => t.key === 'tuitionCharges')!.label = 'Tuition billed'
    c.agencies = ['CCA', 'DSS', 'Head Start']
    applyConfig(normalizeConfig(c))
    expect(FDR_TEXT.tuitionCharges.label).toBe('Tuition billed')
    expect(FINANCE_AGENCIES).toEqual(['CCA', 'DSS', 'Head Start'])
    expect(describeChanges(defaultConfig(), c)).toEqual(['FDR: “Tuition Charges” → “Tuition billed”', 'FDR agencies → CCA, DSS, Head Start'])
  })

  it('extra DDR sections: on the form, printed, totalled on the dashboard, retire-safe', () => {
    const c = defaultConfig()
    c.reports.ddr.sections.push({ key: 'newSec', title: 'Safety', note: false, fields: [
      { key: 'newField', label: 'Fire drill done?', kind: 'toggle' },
      { key: 'newField2', label: 'Incident reports', kind: 'count' },
    ] })
    const saved = normalizeConfig(finalizeKeys(c, defaultConfig()))
    expect(saved.reports.ddr.sections[0]).toMatchObject({ key: 'safety', fields: [{ key: 'fireDrillDone' }, { key: 'incidentReports' }] })
    expect(validateConfig(saved)).toEqual([])
    expect(describeChanges(defaultConfig(), saved)).toEqual(['DDR: section added — Safety'])
    applyConfig(saved)
    expect(EXTRA_SECTIONS.ddr.map((s) => s.key)).toEqual(['safety'])
    expect(EXTRA_DEFS.ddr.sections).toBe(EXTRA_SECTIONS.ddr) // same array, updated in place

    const r = { ...emptyReport('crozet', '2026-11-19'), status: 'submitted' as const, custom: { safety: { fireDrillDone: true, incidentReports: 2 } } }
    const print = buildDdrPrintModel(r)
    const titles = print.sections.map((s) => s.title)
    expect(titles.indexOf('Safety')).toBe(titles.indexOf(DDR_TITLES.directorReport) - 1)
    expect(customTotalsFrom('ddr', [r.custom, { safety: { incidentReports: 1 } }], [])).toMatchObject([
      { label: 'Fire drill done?', kind: 'toggle', now: 1, filed: 2 },
      { label: 'Incident reports', kind: 'count', now: 3, before: 0 },
    ])

    // retired: off the form + dashboard, still prints where answered
    saved.reports.ddr.sections[0].fields[1].retired = true
    applyConfig(normalizeConfig(saved))
    expect(customTotalsFrom('ddr', [r.custom], []).map((t) => t.label)).toEqual(['Fire drill done?'])
    expect(JSON.stringify(buildDdrPrintModel(r))).toContain('Incident reports')
  })

  it('extra FDR sections print after the locations and feed the FDR summary', () => {
    const c = defaultConfig()
    c.reports.fdr.sections.push({ key: 'payroll', title: 'Payroll', note: false, fields: [{ key: 'runs', label: 'Payroll run $', kind: 'dollar' }] })
    applyConfig(normalizeConfig(c))
    const r = { ...emptyFinanceReport('2026-11-19'), status: 'submitted' as const, custom: { payroll: { runs: 1500 } } }
    expect(buildFdrPrintModel(r).sections.at(-1)!.title).toBe('Payroll')
    expect(fdrSummary([r], [], ['crozet']).custom).toMatchObject([{ label: 'Payroll run $', kind: 'dollar', now: 1500 }])
  })

  it('an empty extra section or a blank row name blocks the save', () => {
    const c = defaultConfig()
    c.reports.fdr.sections.push({ key: 'x', title: 'Empty', note: false, fields: [] })
    ddrText(c, 'title.labor').label = ''
    const p = validateConfig(c)
    expect(p).toContain('FDR “Empty”: add a field (or a note) or retire the section.')
    expect(p).toContain('DDR: every heading and row needs a name.')
  })
})
