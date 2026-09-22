import { describe, it, expect } from 'vitest'
import { ORG_DEFS } from './reportRegistry'
import { orgDocId, type OrgReport } from './schema'
import { buildOrgPrintModel, type PrintBlock } from './printModel'

const CDR = ORG_DEFS.edr!
const table = (blocks: PrintBlock[]) => blocks.find((b): b is Extract<PrintBlock, { kind: 'table' }> => b.kind === 'table')
const fields = (blocks: PrintBlock[]) => blocks.find((b): b is Extract<PrintBlock, { kind: 'fields' }> => b.kind === 'fields')

describe('CDR (Co-Director Daily Report) config', () => {
  it('is site-scoped and reuses the executive collection (so no firestore.rules change)', () => {
    expect(CDR.siteScoped).toBe(true)
    expect(CDR.collection).toBe('executiveReports')
    expect(CDR.key).toBe('edr')
    expect(CDR.short).toBe('CDR')
  })

  it('gives every hiring pipeline stage named rows + a campus dropdown', () => {
    const hiring = CDR.sections.find((s) => s.key === 'hiring')!
    for (const key of ['phoneScreens', 'interviews', 'onboarded']) {
      const f = hiring.fields.find((x) => x.key === key)!
      expect(f.kind).toBe('list')
      expect(f.subFields?.map((sf) => sf.key)).toEqual(['name', 'campus'])
      expect(f.subFields?.find((sf) => sf.key === 'campus')?.optionSet).toBe('sites')
    }
    // "New applicants" stays a simple count.
    expect(hiring.fields.find((x) => x.key === 'applicants')?.kind).toBe('count')
  })

  it('social captures headline + page + campus per row', () => {
    const social = CDR.sections.find((s) => s.key === 'social')!
    const posts = social.fields.find((f) => f.key === 'posts')!
    expect(posts.kind).toBe('list')
    expect(posts.subFields?.map((sf) => sf.key)).toEqual(['what', 'page', 'campus'])
  })

  it('enrollment tracks texts sent', () => {
    const enroll = CDR.sections.find((s) => s.key === 'enrollment')!
    expect(enroll.fields.find((f) => f.key === 'textsSent')?.kind).toBe('count')
  })

  it('tasks & projects is a typed line list (task / project / classroom coverage)', () => {
    const tasks = CDR.sections.find((s) => s.key === 'tasks')!
    const items = tasks.fields.find((f) => f.key === 'items')!
    expect(items.kind).toBe('list')
    expect(items.subFields?.map((sf) => sf.key)).toEqual(['type', 'title', 'details'])
    expect(items.subFields?.find((sf) => sf.key === 'type')?.options).toContain('Classroom coverage')
  })

  it('facility is a Yes/No toggle with a reason shown only on No', () => {
    const fac = CDR.sections.find((s) => s.key === 'facility')!
    expect(fac.fields.find((f) => f.key === 'complete')?.kind).toBe('toggle')
    expect(fac.fields.find((f) => f.key === 'reason')?.showWhen).toEqual({ key: 'complete', equals: false })
  })
})

describe('orgDocId', () => {
  it('is per-campus when siteScoped, per-day otherwise', () => {
    expect(orgDocId(CDR, '2026-09-21', 'crozet')).toBe('crozet_2026-09-21')
    expect(orgDocId(ORG_DEFS.adr!, '2026-09-21', 'crozet')).toBe('2026-09-21')
  })
})

describe('CDR print model', () => {
  const report: OrgReport = {
    id: 'crozet_2026-09-21', date: '2026-09-21', day: '', weekOf: '', siteId: 'crozet',
    completedBy: 'Hannah Aaron',
    data: {
      hiring: { applicants: 2, phoneScreens: [{ name: 'Mia Heaton', campus: 'forest-lakes' }], interviews: [], onboarded: [] },
      facility: { complete: false, reason: 'AC out in lobby' },
    },
    status: 'submitted', submittedAt: null, createdAt: '', updatedAt: '', createdByUid: '',
  }

  it('shows the campus, resolves per-row campus ids to names, and prints the toggle as Yes/No', () => {
    const model = buildOrgPrintModel(CDR, report)
    expect(model.reportName).toBe('Co-Director Daily Report')
    expect(model.meta.find((m) => m.label === 'Campus')?.value).toBe('Crozet')

    const hiring = model.sections.find((s) => s.title === 'Hiring')!
    // Each list prints under its own subheading (the bug fix: was anonymous on the PDF).
    expect(table(hiring.blocks)?.table.label).toBe('Phone screens')
    expect(table(hiring.blocks)?.table.rows[0]).toEqual(['Mia Heaton', 'Forest Lakes'])

    const fac = model.sections.find((s) => s.title === 'Facility & Closing')!
    const ff = fields(fac.blocks)!
    expect(ff.fields.find((f) => f.label === 'Closing checklist complete?')?.value).toBe('No')
    expect(ff.fields.find((f) => f.label === 'What got in the way?')?.value).toBe('AC out in lobby')
  })
})
