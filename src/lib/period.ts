// src/lib/period.ts
// The dashboard's selected time window + the preset ranges. Kept out of the
// picker component so that file exports only a component (fast-refresh clean).

import { todayIso, addIsoDays, monthStart, monthEnd } from './dates'
import { weekOf } from './derive'

export interface Period {
  start: string
  end: string
}

export interface PresetRange {
  key: string
  label: string
  start: string
  end: string
}

/** The default period the dashboard opens on: Monday → today. */
export const thisWeekPeriod = (): Period => {
  const today = todayIso()
  return { start: weekOf(today), end: today }
}

/** Preset ranges, computed from today. "This Week"/"MTD" run up to today (no
 *  future days with no data); "Last Week"/months are the full past period. */
export function periodPresets(): PresetRange[] {
  const today = todayIso()
  const wk = weekOf(today)
  const lastMon = addIsoDays(wk, -7)
  const prevMonth = addIsoDays(monthStart(today), -1) // a day guaranteed in last month
  return [
    { key: 'today', label: 'Today', start: today, end: today },
    { key: 'thisWeek', label: 'This Week', start: wk, end: today },
    { key: 'lastWeek', label: 'Last Week', start: lastMon, end: addIsoDays(lastMon, 6) },
    { key: 'mtd', label: 'MTD', start: monthStart(today), end: today },
    { key: 'thisMonth', label: 'This Month', start: monthStart(today), end: monthEnd(today) },
    { key: 'lastMonth', label: 'Last Month', start: monthStart(prevMonth), end: monthEnd(prevMonth) },
  ]
}
