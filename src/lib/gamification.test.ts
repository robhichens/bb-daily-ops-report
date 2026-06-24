import { describe, it, expect } from 'vitest'
import { emptyReport, type DailyOpsReport, type SiteId } from './schema'
import { withDerived } from './derive'
import {
  computeQualityScore,
  isOnTime,
  isEarlyBird,
  pointsForReport,
  computeStreak,
  weekStatsForSite,
  leaderboard,
  teamGoalProgress,
  badgesForSite,
  workdaysInWeek,
  isWorkday,
} from './gamification'

// --- helpers ---------------------------------------------------------------
const nextDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** A submitted report on `date`. `late` = submitted the next day. */
function submitted(date: string, opts: { site?: SiteId; late?: boolean } = {}): DailyOpsReport {
  const r = emptyReport(opts.site ?? 'crozet', date)
  r.status = 'submitted'
  r.submittedAt = opts.late ? `${nextDay(date)}T09:00:00` : `${date}T12:00:00`
  return withDerived(r)
}

/** A fully, thoroughly filled report → quality 100. */
function fullReport(date: string, site: SiteId = 'crozet'): DailyOpsReport {
  const r = emptyReport(site, date)
  r.attendance.preschool = 20
  r.attendance.subsidy = 5
  r.labor.totalHours = 80
  r.enrollmentMarketing.toursGiven = { count: 2, notes: 'Smith, Jones' }
  r.enrollmentMarketing.enrollmentCommsOut = { count: 15, notes: 'all comms logged' }
  r.staff.callOutsLate = { count: 1, notes: 'Pat — sick' }
  r.directorPacket.completed = true
  r.directorReport = ['Reviewed files', 'Parent call']
  r.status = 'submitted'
  r.submittedAt = `${date}T12:00:00`
  return withDerived(r)
}

const WEEK = '2026-06-15' // Monday
const MON = '2026-06-15', TUE = '2026-06-16', WED = '2026-06-17', THU = '2026-06-18', FRI = '2026-06-19'
const SAT = '2026-06-20'

// ---------------------------------------------------------------------------

describe('workdays', () => {
  it('Mon–Fri are workdays, weekend is not', () => {
    expect(isWorkday(MON)).toBe(true)
    expect(isWorkday(FRI)).toBe(true)
    expect(isWorkday(SAT)).toBe(false)
  })
  it('a week has 5 workdays', () => {
    expect(workdaysInWeek(WEEK)).toEqual([MON, TUE, WED, THU, FRI])
  })
})

describe('quality score', () => {
  it('blank report scores 30 (nothing to annotate)', () => {
    expect(computeQualityScore(emptyReport('crozet', MON))).toBe(30)
  })
  it('thorough report scores 100', () => {
    expect(computeQualityScore(fullReport(MON))).toBe(100)
  })
  it('penalises counts left without notes', () => {
    const r = emptyReport('crozet', MON)
    r.attendance.preschool = 10 // +15
    r.labor.totalHours = 40 // +15
    r.enrollmentMarketing.toursGiven = { count: 3, notes: '' } // counted, no note → 0 of 30
    r.directorPacket.completed = true // +15
    // no director report, no comms note
    expect(computeQualityScore(r)).toBe(45)
  })
  it('persists qualityScore via withDerived', () => {
    expect(fullReport(MON).qualityScore).toBe(100)
  })
})

describe('timeliness & points', () => {
  it('same-day submit is on time, next-day is late', () => {
    expect(isOnTime(submitted(MON))).toBe(true)
    expect(isOnTime(submitted(MON, { late: true }))).toBe(false)
    expect(isOnTime(emptyReport('crozet', MON))).toBe(false) // draft
  })
  it('points = base(on-time 10/late 5) + round(quality/10) + early-bird (+3)', () => {
    expect(pointsForReport(fullReport(MON))).toBe(23) // 10 on-time + 10 quality + 3 early (noon)
    const onTimeLate = fullReport(MON)
    onTimeLate.submittedAt = `${MON}T20:00:00` // same day but after 6 PM → no bonus
    expect(pointsForReport(onTimeLate)).toBe(20) // 10 + 10 + 0
    const lateFull = fullReport(MON)
    lateFull.submittedAt = `${nextDay(MON)}T09:00:00` // next day → late
    expect(pointsForReport(lateFull)).toBe(15) // 5 + 10 + 0
    expect(pointsForReport(emptyReport('crozet', MON))).toBe(0) // unsubmitted
  })
  it('early-bird only before 6 PM on the report day', () => {
    expect(isEarlyBird(submitted(MON))).toBe(true) // noon
    const evening = submitted(MON)
    evening.submittedAt = `${MON}T18:30:00`
    expect(isEarlyBird(evening)).toBe(false)
    expect(isEarlyBird(submitted(MON, { late: true }))).toBe(false)
  })
})

describe('streaks', () => {
  it('5 straight workdays → current & longest 5', () => {
    const reports = [MON, TUE, WED, THU, FRI].map((d) => submitted(d))
    expect(computeStreak(reports, FRI)).toEqual({ current: 5, longest: 5 })
  })
  it("today not filed yet doesn't break the streak", () => {
    const reports = [MON, TUE, WED, THU].map((d) => submitted(d))
    expect(computeStreak(reports, FRI).current).toBe(4)
  })
  it('one missed workday is bridged by the monthly freeze', () => {
    const reports = [MON, TUE, THU, FRI].map((d) => submitted(d)) // missed WED
    expect(computeStreak(reports, FRI).current).toBe(4)
  })
  it('a second miss in the same month breaks the streak', () => {
    const reports = [MON, FRI].map((d) => submitted(d)) // missed TUE, WED, THU
    expect(computeStreak(reports, FRI).current).toBe(1)
  })
  it('no reports → zero', () => {
    expect(computeStreak([], FRI)).toEqual({ current: 0, longest: 0 })
  })
})

describe('weekly stats & leaderboard', () => {
  it('full week → completion 1, consistency 100', () => {
    const reports = [MON, TUE, WED, THU, FRI].map((d) => fullReport(d))
    const s = weekStatsForSite(reports, 'crozet', WEEK, FRI)
    expect(s.filed).toBe(5)
    expect(s.completionPct).toBe(1)
    expect(s.consistency).toBe(100)
  })
  it('ranks the most consistent site first', () => {
    const reports = [
      ...[MON, TUE, WED, THU, FRI].map((d) => fullReport(d, 'crozet')),
      ...[MON, TUE].map((d) => fullReport(d, 'forest-lakes')),
    ]
    const board = leaderboard(reports, ['crozet', 'forest-lakes', 'mill-creek'], WEEK, FRI)
    expect(board[0].siteId).toBe('crozet')
    expect(board[0].rank).toBe(1)
    expect(board[2].siteId).toBe('mill-creek') // filed nothing → last
  })
})

describe('team goal & badges', () => {
  it('team goal met when every site files every workday', () => {
    const sites: SiteId[] = ['crozet', 'forest-lakes', 'mill-creek']
    const reports = sites.flatMap((s) => [MON, TUE, WED, THU, FRI].map((d) => fullReport(d, s)))
    const goal = teamGoalProgress(reports, sites, WEEK, FRI)
    expect(goal.target).toBe(15) // 3 sites × 5 workdays
    expect(goal.current).toBe(15)
    expect(goal.met).toBe(true)
  })
  it('awards a 7-day streak + perfect-week badge', () => {
    const reports = [MON, TUE, WED, THU, FRI].map((d) => fullReport(d))
    // extend to 7 workdays for the streak badge
    const prevWeek = ['2026-06-11', '2026-06-12'].map((d) => fullReport(d))
    const ids = badgesForSite([...prevWeek, ...reports], 'crozet', WEEK, FRI).map((b) => b.id)
    expect(ids).toContain('streak-7')
    expect(ids).toContain('perfect-week')
  })
  it('back-on-track when today is filed after a miss', () => {
    const reports = [MON, TUE, /* missed WED */ THU, FRI].map((d) => submitted(d))
    // FRI filed, THU filed... need prev workday of asOf missed. Use asOf with prev missed:
    const r2 = [MON, TUE, WED, /* missed THU */ FRI].map((d) => submitted(d))
    const ids = badgesForSite(r2, 'crozet', WEEK, FRI).map((b) => b.id)
    expect(ids).toContain('back-on-track')
    expect(reports.length).toBe(4)
  })
})
