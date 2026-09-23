// scripts/backfillHeadlines.mjs
// One-time fill of the shared `headlines` collection (see src/lib/headlines.ts)
// from reports filed BEFORE the app started mirroring them: one headline per
// SUBMITTED DDR (full-time headcount + withdrawals) and the latest ADR's Openings
// grid. Safe to re-run — it only overwrites headline docs with fresh copies.
// Mirrors ddrHeadline() / withdrawals() in the app; keep them in step.
//
//   node scripts/backfillHeadlines.mjs "<key.json>"          # dry run: counts only
//   node scripts/backfillHeadlines.mjs "<key.json>" --write  # actually write

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const SITE_NAMES = { crozet: 'Crozet', 'forest-lakes': 'Forest Lakes', 'mill-creek': 'Mill Creek' }

const [keyPath, flag] = process.argv.slice(2)
const write = flag === '--write'
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
const db = getFirestore()
const now = new Date().toISOString()

function withdrawals(r) {
  const out = []
  for (const it of r.enrollmentMarketing?.terminationsToday?.items ?? []) {
    const name = String(it.name ?? '').trim()
    const reason = String(it.reason ?? '').trim()
    if (!name && !reason) continue
    out.push({
      name: name || '—',
      room: String(it.room ?? '').trim(),
      date: String(it.terminationDate ?? '').trim() || r.date,
      reason,
      site: r.siteName || SITE_NAMES[r.siteId] || r.siteId,
    })
  }
  return out
}

const ddrs = (await db.collection('dailyOpsReports').where('status', '==', 'submitted').get()).docs
const batch = db.batch()
for (const d of ddrs) {
  const r = d.data()
  batch.set(db.collection('headlines').doc(`ddr_${d.id}`), {
    kind: 'ddr',
    siteId: r.siteId,
    date: r.date,
    fullTime: r.enrollmentMarketing?.fullTimeEnrollment?.count ?? 0,
    withdrawals: withdrawals(r),
    updatedAt: now,
  })
}

const latestAdr = (await db.collection('admissionsReports').orderBy('date', 'desc').limit(1).get()).docs[0]?.data()
if (latestAdr) {
  batch.set(db.collection('headlines').doc('openings'), {
    kind: 'openings',
    date: latestAdr.date,
    cells: latestAdr.data?.openingsToStaff ?? {},
    updatedAt: now,
  })
}

console.log(`${ddrs.length} submitted DDRs → headlines/ddr_*`)
console.log(latestAdr ? `Openings grid from the ADR of ${latestAdr.date} → headlines/openings` : 'No ADR yet — no openings headline')
if (write) {
  await batch.commit()
  console.log('Written.')
} else {
  console.log('Dry run — nothing written. Add --write to write.')
}
process.exit(0)
