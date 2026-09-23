// src/lib/dates.ts — small local-date helpers (no UTC drift).

/** Today's date as 'YYYY-MM-DD' in the user's local timezone. */
export function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Add `n` days to an ISO date, returning ISO (local, no UTC drift). */
export function addIsoDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' → 'Jun 23' short label. */
export function formatShort(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** First day of the month containing `iso`, as 'YYYY-MM-DD'. */
export function monthStart(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}

/** Last day of the month containing `iso`, as 'YYYY-MM-DD'. */
export function monthEnd(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m, 0) // day 0 of next month = last day of this month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whole days from `a` to `b` (b − a); negative if b precedes a. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000)
}

/** A period label: a single day long-form, else 'Sep 1 – Sep 23'. */
export function formatRange(start: string, end: string): string {
  if (!start || !end) return ''
  return start === end ? formatLong(start) : `${formatShort(start)} – ${formatShort(end)}`
}

/** 'YYYY-MM-DD' → 'Monday, June 23, 2026' (parsed as local). */
export function formatLong(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
