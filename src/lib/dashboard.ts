// src/lib/dashboard.ts
// Pure aggregation helpers for the leadership dashboard. Operates on a set of
// SUBMITTED reports for a given week. Gamification (streaks/leaderboard/badges)
// lives in gamification.ts; this file covers the operational KPIs, funnel,
// staff watch, packet compliance, and the red-flag / celebration feeds.

import {
  ENROLLMENT_COMMS_DAILY_GOAL,
  SITES,
  siteName,
  type DailyOpsReport,
  type SiteId,
} from './schema'
import { badgesForSite, weekStatsForSite } from './gamification'

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)
const distinctDays = (rows: DailyOpsReport[]) => new Set(rows.map((r) => r.date)).size

// ---------------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------------

export interface Kpis {
  avgAttendance: number
  overtimeHours: number
  overtimePct: number // 0–100
  overtimeFlag: boolean // > 5%
  commsOut: number
  commsGoal: number
  commsMet: boolean
  netNewStarts: number
}

export function computeKpis(rows: DailyOpsReport[]): Kpis {
  const days = Math.max(1, distinctDays(rows))
  const totalLabor = sum(rows.map((r) => r.labor.totalHours))
  const totalOt = sum(rows.map((r) => r.labor.overtimeHours))
  const commsOut = sum(rows.map((r) => r.enrollmentMarketing.enrollmentCommsOut.count))
  const commsGoal = rows.length * ENROLLMENT_COMMS_DAILY_GOAL
  const newStarts = sum(rows.map((r) => r.enrollmentMarketing.newStarts.count))
  const terms = sum(rows.map((r) => r.enrollmentMarketing.terminationsToday.count))
  const otPct = totalLabor > 0 ? (totalOt / totalLabor) * 100 : 0

  return {
    avgAttendance: Math.round(sum(rows.map((r) => r.attendance.total)) / days),
    overtimeHours: Math.round(totalOt * 10) / 10,
    overtimePct: Math.round(otPct * 10) / 10,
    overtimeFlag: otPct > 5,
    commsOut,
    commsGoal,
    commsMet: commsOut >= commsGoal && commsGoal > 0,
    netNewStarts: newStarts - terms,
  }
}

// ---------------------------------------------------------------------------
// Attendance by site (always all sites, for comparison)
// ---------------------------------------------------------------------------

export interface SiteBar {
  siteId: SiteId
  name: string
  value: number
}

export function attendanceBySite(weekRows: DailyOpsReport[]): SiteBar[] {
  return SITES.map((s) => ({
    siteId: s.id,
    name: s.name,
    value: sum(weekRows.filter((r) => r.siteId === s.id).map((r) => r.attendance.total)),
  }))
}

// ---------------------------------------------------------------------------
// Enrollment pipeline funnel
// ---------------------------------------------------------------------------

export interface FunnelStage {
  label: string
  value: number
}

export function enrollmentFunnel(rows: DailyOpsReport[]): FunnelStage[] {
  const em = (k: keyof DailyOpsReport['enrollmentMarketing']) =>
    sum(rows.map((r) => r.enrollmentMarketing[k].count))
  return [
    { label: 'Tours Scheduled', value: em('toursScheduled') },
    { label: 'Tours Given', value: em('toursGiven') },
    { label: 'Reg Fees Paid', value: em('regFeesPaid') },
    { label: 'New Starts', value: em('newStarts') },
    { label: 'Enrollments', value: em('enrollmentsToday') },
  ]
}

// ---------------------------------------------------------------------------
// Staff watch
// ---------------------------------------------------------------------------

export interface StaffWatchRow {
  label: string
  value: number
  unit?: string
}

export function staffWatch(rows: DailyOpsReport[]): StaffWatchRow[] {
  const st = (k: keyof DailyOpsReport['staff']) => sum(rows.map((r) => r.staff[k].count))
  return [
    { label: 'Call Outs / Late', value: st('callOutsLate') },
    { label: 'Sent Home', value: st('sentHome') },
    { label: 'Staff Terminating', value: st('staffTerminating') },
    { label: 'Future Hires', value: st('futureHires') },
    { label: 'Time Recruiting', value: Math.round(st('timeSpentRecruiting') * 10) / 10, unit: 'hrs' },
  ]
}

// ---------------------------------------------------------------------------
// Director packet compliance
// ---------------------------------------------------------------------------

export interface PacketCompliance {
  pct: number // 0–100
  completed: number
  total: number
  misses: { site: string; date: string; director: string; reason: string }[]
}

export function packetCompliance(rows: DailyOpsReport[]): PacketCompliance {
  const total = rows.length
  const completed = rows.filter((r) => r.directorPacket.completed).length
  const misses = rows
    .filter((r) => !r.directorPacket.completed)
    .map((r) => ({
      site: r.siteName,
      date: r.date,
      director: r.director,
      reason: r.directorPacket.incompleteReason,
    }))
  return { pct: total ? Math.round((completed / total) * 100) : 0, completed, total, misses }
}

// ---------------------------------------------------------------------------
// Red flags & celebrations
// ---------------------------------------------------------------------------

export interface Flag {
  id: string
  text: string
  site?: string
  date?: string
}

/** Operational red flags across all sites. Never tied to a director's score. */
export function redFlags(
  weekRows: DailyOpsReport[],
  weekOf: string,
  asOf: string,
  today: string
): Flag[] {
  const flags: Flag[] = []

  // Missed report today (only meaningful when viewing the current week).
  const todayInWeek = today >= weekOf && today <= asOf
  if (todayInWeek) {
    for (const s of SITES) {
      const filedToday = weekRows.some((r) => r.siteId === s.id && r.date === today)
      if (!filedToday) flags.push({ id: `missed-${s.id}`, text: `${s.name} hasn’t filed today`, site: s.name, date: today })
    }
  }

  // Per-site overtime over 5% for the week.
  for (const s of SITES) {
    const mine = weekRows.filter((r) => r.siteId === s.id)
    const lab = sum(mine.map((r) => r.labor.totalHours))
    const ot = sum(mine.map((r) => r.labor.overtimeHours))
    if (lab > 0 && ot / lab > 0.05) {
      flags.push({ id: `ot-${s.id}`, text: `${s.name} overtime at ${Math.round((ot / lab) * 1000) / 10}% (target ≤ 5%)`, site: s.name })
    }
  }

  // Packet "No", termination & call-out spikes (per report-day).
  for (const r of weekRows) {
    if (!r.directorPacket.completed) {
      flags.push({ id: `packet-${r.id}`, text: `${r.siteName}: Director Packet not completed — ${r.directorPacket.incompleteReason || 'no reason given'}`, site: r.siteName, date: r.date })
    }
    if (r.enrollmentMarketing.terminationsToday.count >= 2) {
      flags.push({ id: `terms-${r.id}`, text: `${r.siteName}: ${r.enrollmentMarketing.terminationsToday.count} terminations`, site: r.siteName, date: r.date })
    }
    if (r.staff.callOutsLate.count >= 3) {
      flags.push({ id: `callout-${r.id}`, text: `${r.siteName}: ${r.staff.callOutsLate.count} call-outs/late`, site: r.siteName, date: r.date })
    }
  }

  return flags
}

/** Wins worth celebrating across all sites. */
export function celebrations(weekRows: DailyOpsReport[], weekOf: string, asOf: string): Flag[] {
  const out: Flag[] = []

  for (const s of SITES) {
    const mine = weekRows.filter((r) => r.siteId === s.id)
    if (mine.length === 0) continue

    // Streak / perfect-week / thorough badges
    for (const b of badgesForSite(weekRows, s.id, weekOf, asOf)) {
      out.push({ id: `${b.id}-${s.id}`, text: `${b.emoji} ${s.name}: ${b.label}`, site: s.name })
    }

    // Comms goal met for the week
    const comms = sum(mine.map((r) => r.enrollmentMarketing.enrollmentCommsOut.count))
    const goal = mine.length * ENROLLMENT_COMMS_DAILY_GOAL
    if (goal > 0 && comms >= goal) {
      out.push({ id: `comms-${s.id}`, text: `📣 ${s.name}: enrollment comms goal hit (${comms}/${goal})`, site: s.name })
    }

    // Net-positive enrollment
    const net = sum(mine.map((r) => r.enrollmentMarketing.newStarts.count)) - sum(mine.map((r) => r.enrollmentMarketing.terminationsToday.count))
    if (net > 0) out.push({ id: `net-${s.id}`, text: `🌱 ${s.name}: net +${net} enrollment this week`, site: s.name })
  }

  return out
}

// ---------------------------------------------------------------------------
// "Most improved" — biggest consistency gain vs the prior week
// ---------------------------------------------------------------------------

export function mostImproved(
  thisWeekRows: DailyOpsReport[],
  lastWeekRows: DailyOpsReport[],
  weekOf: string,
  lastWeekOf: string,
  asOf: string,
  lastAsOf: string
): { site: string; delta: number } | null {
  let best: { site: string; delta: number } | null = null
  for (const s of SITES) {
    const now = weekStatsForSite(thisWeekRows, s.id, weekOf, asOf).consistency
    const prev = weekStatsForSite(lastWeekRows, s.id, lastWeekOf, lastAsOf).consistency
    const delta = now - prev
    if (delta > 0 && (!best || delta > best.delta)) best = { site: siteName(s.id), delta }
  }
  return best
}
