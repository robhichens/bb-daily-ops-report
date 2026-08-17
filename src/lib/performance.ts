// src/lib/performance.ts
// Builds the side-by-side Director Performance report over the whole period
// since launch. Two deliberately separate lenses:
//   • Report discipline & quality — the director's own habits (the thing the
//     scoring engine is designed to measure fairly).
//   • Operational snapshot — site outcomes (enrollment, overtime, attendance).
//     Partly market-driven, so shown as context, never as a grade.
// Neutral by design: no ranking, no composite score — just the numbers.

import {
  type DailyOpsReport,
  type SiteConfig,
  type SiteId,
} from './schema'
import {
  weekStatsForSite,
  computeStreak,
  isOnTime,
  isEarlyBird,
  pointsForReport,
  computeQualityScore,
  isWorkday,
} from './gamification'
import { weekOf as weekOfFn } from './derive'
import { addIsoDays } from './dates'

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)
const qualityOf = (r: DailyOpsReport) => r.qualityScore ?? computeQualityScore(r)
const round1 = (n: number) => Math.round(n * 10) / 10

/** Inclusive count of Mon–Fri workdays between two ISO dates. */
function countWorkdays(start: string, end: string): number {
  if (!start || start > end) return 0
  let n = 0
  for (let d = start; d <= end; d = addIsoDays(d, 1)) if (isWorkday(d)) n++
  return n
}

/** The director name typed most often on a site's reports (guards a stray typo). */
function modeDirector(rows: DailyOpsReport[]): string {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const n = (r.director || '').trim()
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [n, c] of counts) if (c > bestCount) { best = n; bestCount = c }
  return best
}

export interface WeeklyPoint {
  weekOf: string
  consistency: number // 0–100
}

export interface DirectorScorecard {
  siteId: SiteId
  siteName: string
  director: string

  // Report discipline & quality
  reportsFiled: number
  expectedWorkdays: number
  completionPct: number // 0–100
  onTimePct: number     // 0–100 of filed
  earlyBirdPct: number  // 0–100 of filed
  avgQuality: number    // 0–100
  currentStreak: number
  longestStreak: number
  points: number

  // Operational snapshot (context, not a grade)
  avgAttendance: number
  overtimePct: number
  toursScheduled: number
  toursGiven: number
  regFeesPaid: number
  newStarts: number
  enrollments: number
  terminations: number
  netEnrollment: number
  packetPct: number
  callOuts: number
  commsOut: number
  timeRecruiting: number

  weekly: WeeklyPoint[]
}

export interface PerformanceReport {
  periodStart: string
  asOf: string
  weeks: string[]
  cards: DirectorScorecard[]
}

/** Build one scorecard per site over the whole period since the first report. */
export function buildPerformanceReport(
  reports: DailyOpsReport[],
  sites: SiteConfig[],
  today: string
): PerformanceReport {
  const scope = new Set(sites.map((s) => s.id))
  const submitted = reports.filter((r) => r.status === 'submitted' && scope.has(r.siteId))
  const asOf = today

  const dates = submitted.map((r) => r.date).sort()
  const periodStart = dates.length ? dates[0] : weekOfFn(today)
  const expectedWorkdays = countWorkdays(periodStart, asOf)

  // Weeks spanning the period, for the trend sparklines.
  const weeks: string[] = []
  for (let w = weekOfFn(periodStart); w <= weekOfFn(asOf); w = addIsoDays(w, 7)) weeks.push(w)

  const cards: DirectorScorecard[] = sites.map((site) => {
    const mine = submitted.filter((r) => r.siteId === site.id)
    const filedCount = mine.length
    const workdayFilings = new Set(mine.filter((r) => isWorkday(r.date)).map((r) => r.date)).size
    const distinctDays = Math.max(1, new Set(mine.map((r) => r.date)).size)

    const onTime = mine.filter(isOnTime).length
    const early = mine.filter(isEarlyBird).length
    const avgQuality = filedCount ? Math.round(sum(mine.map(qualityOf)) / filedCount) : 0
    const streak = computeStreak(mine, asOf)

    const em = (k: keyof DailyOpsReport['enrollmentMarketing']) => sum(mine.map((r) => r.enrollmentMarketing[k].count))
    const st = (k: keyof DailyOpsReport['staff']) => sum(mine.map((r) => r.staff[k].count))

    const totalLabor = sum(mine.map((r) => r.labor.totalHours))
    const totalOt = sum(mine.map((r) => r.labor.overtimeHours))
    const newStarts = em('newStarts')
    const terminations = em('terminationsToday')

    const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0)

    return {
      siteId: site.id,
      siteName: site.name,
      director: modeDirector(mine),

      reportsFiled: filedCount,
      expectedWorkdays,
      completionPct: pct(workdayFilings, expectedWorkdays),
      onTimePct: pct(onTime, filedCount),
      earlyBirdPct: pct(early, filedCount),
      avgQuality,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      points: sum(mine.map(pointsForReport)),

      avgAttendance: Math.round(sum(mine.map((r) => r.attendance.total)) / distinctDays),
      overtimePct: totalLabor > 0 ? round1((totalOt / totalLabor) * 100) : 0,
      toursScheduled: em('toursScheduled'),
      toursGiven: em('toursGiven'),
      regFeesPaid: em('regFeesPaid'),
      newStarts,
      enrollments: em('enrollmentsToday'),
      terminations,
      netEnrollment: newStarts - terminations,
      packetPct: pct(mine.filter((r) => r.directorPacket.completed).length, filedCount),
      callOuts: st('callOutsLate'),
      commsOut: em('enrollmentCommsOut'),
      timeRecruiting: round1(st('timeSpentRecruiting')),

      weekly: weeks.map((w) => ({ weekOf: w, consistency: weekStatsForSite(mine, site.id, w, asOf).consistency })),
    }
  })

  return { periodStart, asOf, weeks, cards }
}
