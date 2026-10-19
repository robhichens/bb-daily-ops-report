// src/lib/requestPrint.ts
// Print / PDF sheet for the dashboard's Purchase + Maintenance request lists
// (Day Note Requests). Open items only, grouped by school, with a blank tick
// column and a few empty rows so it works as a walk-around checklist.

import { SITES, type RequestList } from './schema'
import { formatLong, formatShort } from './dates'
import type { RequestItem } from './reports'
import type { PrintModel, PrintSection } from './printModel'

export interface RequestListGroup {
  list: RequestList
  label: string // "Purchase Requests"
  items: RequestItem[]
}

const SHORT: Record<RequestList, string> = { purchase: 'BUY', maintenance: 'FIX' }
const ORG_WIDE = 'Org-wide (HQ)'

/** The school an item belongs to, read from its context label
 *  ("Crozet · Jacqueline", "FDR · Mill Creek"); reports with no campus → HQ. */
export function itemSchool(item: RequestItem): string {
  return SITES.find((s) => item.contextLabel.includes(s.name))?.name ?? ORG_WIDE
}

/** Who/what it came from, minus the school (already the group heading). */
function fromLabel(item: RequestItem, school: string): string {
  if (school === ORG_WIDE) return item.contextLabel
  const rest = item.contextLabel
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p && p !== school)
  return rest.join(' · ')
}

export function buildRequestsPrintModel(groups: RequestListGroup[], today: string): PrintModel {
  const order = [...SITES.map((s) => s.name), ORG_WIDE]
  const sections: PrintSection[] = []

  for (const g of groups) {
    const bySchool = new Map<string, RequestItem[]>()
    for (const it of g.items) {
      const school = itemSchool(it)
      bySchool.set(school, [...(bySchool.get(school) ?? []), it])
    }
    const schools = order.filter((s) => bySchool.has(s))
    if (schools.length === 0) {
      sections.push({ title: g.label, hint: 'Nothing open on this list.', blocks: [] })
      continue
    }
    schools.forEach((school, i) => {
      const items = [...(bySchool.get(school) ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1)) // oldest first
      sections.push({
        title: i === 0 ? `${g.label} · ${school}` : school,
        hint: i === 0 ? `${g.items.length} open · tick each one off as it’s done` : undefined,
        blocks: [{
          kind: 'table',
          table: {
            columns: ['Done', 'Request', 'From', 'Logged'],
            widths: ['8%', '58%', '22%', '12%'],
            rows: items.map((it) => ['☐', it.note, fromLabel(it, school), it.date ? formatShort(it.date) : '']),
          },
        }],
      })
    })
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0)
  return {
    reportName: groups.length === 1 ? groups[0].label : 'Purchase & Maintenance Requests',
    short: groups.map((g) => SHORT[g.list]).join(' + '),
    meta: [
      { label: 'Printed', value: formatLong(today) },
      { label: 'Open items', value: String(total) },
    ],
    sections,
  }
}
