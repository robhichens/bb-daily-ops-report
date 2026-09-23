// src/lib/dashboardReports.ts
// Dashboard metrics for the non-DDR reports: CDR (per campus), ADR (org-wide)
// and FDR (per location). Pure functions over the period's docs — the page
// fetches the period + the prior equal-length period and passes both in.
// Like the DDR dashboard, only SUBMITTED reports count.

import {
  SITES,
  sumLines,
  totalDeposits,
  tuitionExpressTotal,
  type FinanceReport,
  type OrgFieldValue,
  type OrgListItem,
  type OrgReport,
  type SiteId,
} from './schema'

const submitted = <T extends { status: string }>(rows: T[]) => rows.filter((r) => r.status === 'submitted')
const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date)

function num(v: OrgFieldValue | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Rows in a line-list that actually have something typed in them. */
function listCount(v: OrgFieldValue | undefined): number {
  if (!Array.isArray(v)) return 0
  return (v as OrgListItem[]).filter((item) => Object.values(item).some((x) => String(x ?? '').trim())).length
}

const field = (r: OrgReport, section: string, key: string) => r.data?.[section]?.[key]

// --- CDR (Co-Director Daily Report) — one doc per campus per day -------------

export interface CdrStats {
  filed: number
  emails: number
  voicemails: number
  newLeads: number
  iksCalls: number
  textsSent: number
  toursDone: number
  toursScheduled: number
  applicants: number
  phoneScreens: number
  interviews: number
  onboarded: number
  socialPosts: number
  closingDone: number
}

export interface CdrSite extends CdrStats {
  siteId: SiteId
  name: string
}

export interface ClosingMiss {
  date: string
  site: string
  reason: string
}

export interface CdrSummary {
  bySite: CdrSite[]
  total: CdrStats
  prevTotal: CdrStats
  closingMisses: ClosingMiss[]
}

const emptyCdr = (): CdrStats => ({
  filed: 0, emails: 0, voicemails: 0, newLeads: 0, iksCalls: 0, textsSent: 0, toursDone: 0,
  toursScheduled: 0, applicants: 0, phoneScreens: 0, interviews: 0, onboarded: 0, socialPosts: 0, closingDone: 0,
})

function addCdr(acc: CdrStats, r: OrgReport): void {
  acc.filed += 1
  acc.emails += num(field(r, 'communication', 'emails'))
  acc.voicemails += num(field(r, 'communication', 'voicemails'))
  acc.newLeads += num(field(r, 'enrollment', 'newLeads'))
  acc.iksCalls += num(field(r, 'enrollment', 'iksCalls'))
  acc.textsSent += num(field(r, 'enrollment', 'textsSent'))
  acc.toursDone += num(field(r, 'enrollment', 'toursDone'))
  acc.toursScheduled += num(field(r, 'enrollment', 'toursScheduled'))
  acc.applicants += num(field(r, 'hiring', 'applicants'))
  acc.phoneScreens += listCount(field(r, 'hiring', 'phoneScreens'))
  acc.interviews += listCount(field(r, 'hiring', 'interviews'))
  acc.onboarded += listCount(field(r, 'hiring', 'onboarded'))
  acc.socialPosts += listCount(field(r, 'social', 'posts'))
  if (field(r, 'facility', 'complete') === true) acc.closingDone += 1
}

function sumCdr(rows: OrgReport[]): CdrStats {
  const acc = emptyCdr()
  for (const r of rows) addCdr(acc, r)
  return acc
}

export function cdrSummary(rows: OrgReport[], prevRows: OrgReport[], scope: SiteId[]): CdrSummary {
  const inScope = (r: OrgReport) => !!r.siteId && scope.includes(r.siteId)
  const cur = submitted(rows).filter(inScope)
  const prev = submitted(prevRows).filter(inScope)

  const bySite = SITES.filter((s) => scope.includes(s.id)).map((s) => ({
    siteId: s.id,
    name: s.name,
    ...sumCdr(cur.filter((r) => r.siteId === s.id)),
  }))

  const closingMisses = cur
    .filter((r) => field(r, 'facility', 'complete') === false)
    .sort(byDateDesc)
    .map((r) => ({
      date: r.date,
      site: SITES.find((s) => s.id === r.siteId)?.name ?? String(r.siteId),
      reason: String(field(r, 'facility', 'reason') ?? '').trim(),
    }))

  return { bySite, total: sumCdr(cur), prevTotal: sumCdr(prev), closingMisses }
}

// --- ADR (Admissions Daily Report) — one org-wide doc per day ----------------

export interface AdrStats {
  filed: number
  inquiries: number
  toursScheduled: number
  toursGiven: number
  regFees: number
  regFeesAmt: number
  newEnrollments: number
  locationsVisited: number
  flyers: number
  withdrawals: number
}

export interface AdrPipeline {
  asOf: string
  activeLeads: number
  toursPending: number
  waitlist: number
  followUps: number
}

export interface AdrSummary {
  total: AdrStats
  prevTotal: AdrStats
  /** Snapshot numbers from the latest report in the period (they don't add up across days). */
  pipeline: AdrPipeline | null
}

function sumAdr(rows: OrgReport[]): AdrStats {
  const t: AdrStats = {
    filed: 0, inquiries: 0, toursScheduled: 0, toursGiven: 0, regFees: 0, regFeesAmt: 0,
    newEnrollments: 0, locationsVisited: 0, flyers: 0, withdrawals: 0,
  }
  for (const r of rows) {
    t.filed += 1
    t.inquiries += num(field(r, 'inquiries', 'total'))
    t.toursScheduled += num(field(r, 'tours', 'scheduled'))
    t.toursGiven += num(field(r, 'tours', 'given'))
    t.regFees += num(field(r, 'conversion', 'regFees'))
    t.regFeesAmt += num(field(r, 'conversion', 'regFeesAmt'))
    t.newEnrollments += num(field(r, 'conversion', 'newEnrollments'))
    t.locationsVisited += num(field(r, 'outreach', 'locationsVisited'))
    t.flyers += num(field(r, 'outreach', 'flyersDistributed'))
    t.withdrawals += num(field(r, 'attrition', 'withdrawals'))
  }
  return t
}

export function adrSummary(rows: OrgReport[], prevRows: OrgReport[]): AdrSummary {
  const cur = submitted(rows)
  const latest = [...cur].sort(byDateDesc)[0]
  return {
    total: sumAdr(cur),
    prevTotal: sumAdr(submitted(prevRows)),
    pipeline: latest
      ? {
          asOf: latest.date,
          activeLeads: num(field(latest, 'pipeline', 'activeLeads')),
          toursPending: num(field(latest, 'pipeline', 'toursPending')),
          waitlist: num(field(latest, 'pipeline', 'waitlist')),
          followUps: num(field(latest, 'attrition', 'followUps')),
        }
      : null,
  }
}

// --- FDR (Finance Daily Report) — one doc per day, a block per location ------

export interface FdrSite {
  siteId: SiteId
  name: string
  deposits: number // net: checks + agency + Tuition Express − declines/refunds
  checks: number
  agency: number
  tuitionExpress: number
  declinesRefunds: number
  charges: number // tuition + other charges
  credits: number
  outstandingCurrent: number // latest report in the period (a balance, not a sum)
  outstandingFormer: number
}

export interface DeclineRefundRow {
  date: string
  site: string
  type: 'Decline' | 'Refund'
  parent: string
  amount: number
}

export interface FdrSummary {
  filed: number
  bySite: FdrSite[]
  total: Omit<FdrSite, 'siteId' | 'name'>
  prevDeposits: number
  outstandingAsOf: string | null
  declines: DeclineRefundRow[]
}

export function fdrSummary(rows: FinanceReport[], prevRows: FinanceReport[], scope: SiteId[]): FdrSummary {
  const cur = submitted(rows).sort(byDateDesc)
  const latest = cur[0]
  const sites = SITES.filter((s) => scope.includes(s.id))

  const bySite: FdrSite[] = sites.map((s) => {
    const row: FdrSite = {
      siteId: s.id, name: s.name, deposits: 0, checks: 0, agency: 0, tuitionExpress: 0,
      declinesRefunds: 0, charges: 0, credits: 0, outstandingCurrent: 0, outstandingFormer: 0,
    }
    for (const r of cur) {
      const loc = r.locations?.[s.id]
      if (!loc) continue
      row.deposits += totalDeposits(loc)
      row.checks += sumLines(loc.paymentsByCheck)
      row.agency += sumLines(loc.paymentsByAgency)
      row.tuitionExpress += tuitionExpressTotal(loc.tuitionExpress)
      row.declinesRefunds += sumLines(loc.declinesRefunds)
      row.charges += sumLines(loc.tuitionCharges) + sumLines(loc.otherCharges)
      row.credits += sumLines(loc.credits)
    }
    const latestLoc = latest?.locations?.[s.id]
    if (latestLoc) {
      row.outstandingCurrent = latestLoc.outstandingCurrent?.amount || 0
      row.outstandingFormer = latestLoc.outstandingFormer?.amount || 0
    }
    return row
  })

  const total = bySite.reduce(
    (t, s) => {
      for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += s[k]
      return t
    },
    { deposits: 0, checks: 0, agency: 0, tuitionExpress: 0, declinesRefunds: 0, charges: 0, credits: 0, outstandingCurrent: 0, outstandingFormer: 0 }
  )

  let prevDeposits = 0
  for (const r of submitted(prevRows)) {
    for (const s of sites) {
      const loc = r.locations?.[s.id]
      if (loc) prevDeposits += totalDeposits(loc)
    }
  }

  const declines: DeclineRefundRow[] = []
  for (const r of cur) {
    for (const s of sites) {
      for (const d of r.locations?.[s.id]?.declinesRefunds ?? []) {
        if (!d.amount && !d.parent) continue
        declines.push({ date: r.date, site: s.name, type: d.type, parent: d.parent, amount: Number(d.amount) || 0 })
      }
    }
  }

  return { filed: cur.length, bySite, total, prevDeposits, outstandingAsOf: latest?.date ?? null, declines }
}
