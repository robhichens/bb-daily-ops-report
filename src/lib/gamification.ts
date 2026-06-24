// src/lib/gamification.ts
// The engagement engine: quality score, streaks (Mon–Fri), points, badges,
// consistency/leaderboard, and the shared team goal. See gamification.md.
//
// Design rules:
//  - Reward CONSISTENCY + QUALITY of the report, never business outcomes.
//  - All values are DERIVED from the reports themselves (the source of truth).
//  - Self-contained: imports only schema types/config (no cycle with derive.ts;
//    derive.ts imports computeQualityScore from here).

import {
  ENROLLMENT_FIELDS,
  STAFF_FIELDS,
  ENROLLMENT_COMMS_DAILY_GOAL,
  type DailyOpsReport,
  type EnrollmentMarketing,
  type SiteId,
  type Staff,
} from './schema'

// ---------------------------------------------------------------------------
// Workday / date helpers (Mon–Fri; holidays excluded). Local, no UTC drift.
// ---------------------------------------------------------------------------

/** ISO 'YYYY-MM-DD' dates the schools are closed (extend as needed). */
export const HOLIDAYS = new Set<string>([])

const parse = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const toIso = (dt: Date): string =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

const addDays = (iso: string, n: number): string => {
  const dt = parse(iso)
  dt.setDate(dt.getDate() + n)
  return toIso(dt)
}

/** Monday–Friday and not a configured holiday. */
export function isWorkday(iso: string): boolean {
  const day = parse(iso).getDay() // 0 Sun … 6 Sat
  return day >= 1 && day <= 5 && !HOLIDAYS.has(iso)
}

const prevWorkday = (iso: string): string => {
  let c = addDays(iso, -1)
  while (!isWorkday(c)) c = addDays(c, -1)
  return c
}

/** The Mon–Fri workdays of the week starting at `weekOf` (a Monday). */
export function workdaysInWeek(weekOf: string): string[] {
  const out: string[] = []
  for (let i = 0; i < 5; i++) {
    const d = addDays(weekOf, i)
    if (isWorkday(d)) out.push(d)
  }
  return out
}

/** Workdays of the week up to and including `asOf` (so today counts, future doesn't). */
export function workdaysInWeekUpTo(weekOf: string, asOf: string): string[] {
  return workdaysInWeek(weekOf).filter((d) => d <= asOf)
}

// ---------------------------------------------------------------------------
// Quality score (0–100) — rewards thoroughness, not big numbers.
// ---------------------------------------------------------------------------

const hasNote = (n: { notes: string }): boolean => n.notes.trim().length > 0

export function computeQualityScore(r: DailyOpsReport): number {
  let score = 0

  // Sections engaged (30): attendance entered (15) + labor entered (15).
  if (r.attendance.preschool > 0 || r.attendance.subsidy > 0) score += 15
  if (r.labor.totalHours > 0) score += 15

  // Notes where counted (30): every count>0 has a matching note.
  const counted: { count: number; notes: string }[] = []
  for (const f of ENROLLMENT_FIELDS) counted.push(r.enrollmentMarketing[f.key as keyof EnrollmentMarketing])
  for (const f of STAFF_FIELDS) counted.push(r.staff[f.key as keyof Staff])
  const withCount = counted.filter((c) => c.count > 0)
  if (withCount.length === 0) {
    score += 30 // nothing to annotate
  } else {
    const annotated = withCount.filter(hasNote).length
    score += Math.round(30 * (annotated / withCount.length))
  }

  // Director Packet (15): done, or a reason given when not done.
  if (r.directorPacket.completed || r.directorPacket.incompleteReason.trim().length > 0) score += 15

  // Director Report (15): at least one substantive line.
  if (r.directorReport.some((l) => l.trim().length > 0)) score += 15

  // Comms goal context (10): the comms-out notes are filled (process, not count).
  if (hasNote(r.enrollmentMarketing.enrollmentCommsOut)) score += 10

  return Math.min(100, score)
}

/** qualityScore from the persisted field, falling back to a fresh compute. */
const qualityOf = (r: DailyOpsReport): number => r.qualityScore ?? computeQualityScore(r)

// ---------------------------------------------------------------------------
// Points & timeliness
// ---------------------------------------------------------------------------

/** Submitted on the same local calendar day as the report date. */
export function isOnTime(r: DailyOpsReport): boolean {
  if (r.status !== 'submitted' || !r.submittedAt) return false
  // On time = submitted on or before the end of the report's own day.
  return toIso(new Date(r.submittedAt)) <= r.date
}

/** Points for one report: base (on-time 10 / late 5) + round(quality/10). 0 if unsubmitted. */
export function pointsForReport(r: DailyOpsReport): number {
  if (r.status !== 'submitted') return 0
  const base = isOnTime(r) ? 10 : 5
  return base + Math.round(qualityOf(r) / 10)
}

// ---------------------------------------------------------------------------
// Streaks (per site). One streak-freeze per calendar month bridges a miss.
// ---------------------------------------------------------------------------

export interface StreakResult {
  current: number
  longest: number
}

/** Build the set of dates that have a SUBMITTED report. */
export function submittedDateSet(reports: DailyOpsReport[]): Set<string> {
  return new Set(reports.filter((r) => r.status === 'submitted').map((r) => r.date))
}

export function computeStreak(reports: DailyOpsReport[], asOf: string): StreakResult {
  const filed = submittedDateSet(reports)
  if (filed.size === 0) return { current: 0, longest: 0 }

  const earliest = [...filed].sort()[0]

  // --- current streak: walk backwards from the latest required workday ---
  let cursor = isWorkday(asOf) ? asOf : prevWorkday(asOf)
  // Today not filed yet shouldn't break the streak — start from the prior workday.
  if (isWorkday(asOf) && !filed.has(asOf)) cursor = prevWorkday(asOf)

  let current = 0
  const usedFreezeCurrent = new Set<string>()
  while (cursor >= earliest) {
    if (filed.has(cursor)) {
      current++
      cursor = prevWorkday(cursor)
    } else {
      const monthKey = cursor.slice(0, 7)
      if (!usedFreezeCurrent.has(monthKey)) {
        usedFreezeCurrent.add(monthKey) // freeze bridges this miss
        cursor = prevWorkday(cursor)
      } else {
        break
      }
    }
  }

  // --- longest streak: forward scan over all workdays in range ---
  let best = 0
  let run = 0
  const usedFreezeLong = new Set<string>()
  let d = earliest
  while (d <= asOf) {
    if (isWorkday(d)) {
      if (filed.has(d)) {
        run++
        best = Math.max(best, run)
      } else {
        const monthKey = d.slice(0, 7)
        if (!usedFreezeLong.has(monthKey)) {
          usedFreezeLong.add(monthKey) // freeze bridges, run continues
        } else {
          run = 0
        }
      }
    }
    d = addDays(d, 1)
  }

  return { current, longest: Math.max(best, current) }
}

// ---------------------------------------------------------------------------
// Weekly stats, consistency score, leaderboard
// ---------------------------------------------------------------------------

export interface WeekStats {
  siteId: SiteId
  expected: number
  filed: number
  onTime: number
  avgQuality: number
  points: number
  completionPct: number // 0–1
  consistency: number // 0–100
}

export function weekStatsForSite(
  reports: DailyOpsReport[],
  siteId: SiteId,
  weekOf: string,
  asOf: string
): WeekStats {
  const mine = reports.filter((r) => r.siteId === siteId && r.weekOf === weekOf)
  const submitted = mine.filter((r) => r.status === 'submitted')
  const expected = Math.max(1, workdaysInWeekUpTo(weekOf, asOf).length)
  const filed = submitted.length
  const onTime = submitted.filter(isOnTime).length
  const avgQuality = filed ? submitted.reduce((s, r) => s + qualityOf(r), 0) / filed : 0
  const points = submitted.reduce((s, r) => s + pointsForReport(r), 0)
  const completionPct = Math.min(1, filed / expected)

  const consistency = Math.round(
    100 * (0.5 * completionPct + 0.2 * (onTime / expected) + 0.3 * (avgQuality / 100))
  )

  return { siteId, expected, filed, onTime, avgQuality: Math.round(avgQuality), points, completionPct, consistency }
}

export interface LeaderboardRow extends WeekStats {
  rank: number
  streak: number
}

/** Friendly weekly leaderboard — ranked by consistency, ties broken by streak. */
export function leaderboard(
  reports: DailyOpsReport[],
  sites: SiteId[],
  weekOf: string,
  asOf: string
): LeaderboardRow[] {
  const rows = sites.map((siteId) => {
    const stats = weekStatsForSite(reports, siteId, weekOf, asOf)
    const streak = computeStreak(
      reports.filter((r) => r.siteId === siteId),
      asOf
    ).current
    return { ...stats, streak, rank: 0 }
  })
  rows.sort((a, b) => b.consistency - a.consistency || b.streak - a.streak || b.points - a.points)
  rows.forEach((r, i) => (r.rank = i + 1))
  return rows
}

// ---------------------------------------------------------------------------
// Shared team goal
// ---------------------------------------------------------------------------

export interface TeamGoal {
  current: number
  target: number
  pct: number // 0–1
  met: boolean
  label: string
}

/** "Every site filed every workday this week." */
export function teamGoalProgress(
  reports: DailyOpsReport[],
  sites: SiteId[],
  weekOf: string,
  asOf: string
): TeamGoal {
  const perSite = Math.max(1, workdaysInWeekUpTo(weekOf, asOf).length)
  const target = perSite * sites.length
  const current = sites.reduce(
    (sum, siteId) =>
      sum + reports.filter((r) => r.siteId === siteId && r.weekOf === weekOf && r.status === 'submitted').length,
    0
  )
  const pct = Math.min(1, current / target)
  return {
    current,
    target,
    pct,
    met: current >= target,
    label: 'Every site filed every workday this week',
  }
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface Badge {
  id: string
  label: string
  emoji: string
  description: string
}

/** Badges earned by a site, given its full report history and `asOf`. */
export function badgesForSite(
  reports: DailyOpsReport[],
  siteId: SiteId,
  weekOf: string,
  asOf: string
): Badge[] {
  const mine = reports.filter((r) => r.siteId === siteId)
  const out: Badge[] = []
  const { current, longest } = computeStreak(mine, asOf)
  const best = Math.max(current, longest)

  if (best >= 100) out.push({ id: 'streak-100', label: '100-day streak', emoji: '💯', description: '100 workdays filed' })
  else if (best >= 30) out.push({ id: 'streak-30', label: '30-day streak', emoji: '🌟', description: '30 workdays filed' })
  else if (best >= 7) out.push({ id: 'streak-7', label: '7-day streak', emoji: '🔥', description: 'A full week filed' })

  const week = weekStatsForSite(mine, siteId, weekOf, asOf)
  if (week.expected > 0 && week.filed >= week.expected && week.onTime >= week.expected) {
    out.push({ id: 'perfect-week', label: 'Perfect week', emoji: '🏅', description: 'Every workday, on time' })
  }
  if (week.filed > 0 && week.avgQuality >= 90) {
    out.push({ id: 'thorough', label: 'Thorough', emoji: '📝', description: 'Quality ≥ 90 this week' })
  }

  // Back on track: filed today after missing the previous workday.
  const filed = submittedDateSet(mine)
  if (isWorkday(asOf) && filed.has(asOf) && !filed.has(prevWorkday(asOf))) {
    out.push({ id: 'back-on-track', label: 'Back on track', emoji: '💪', description: 'Bounced back after a miss' })
  }

  return out
}

export { ENROLLMENT_COMMS_DAILY_GOAL }
