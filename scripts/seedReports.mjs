// scripts/seedReports.mjs
// Seeds varied SUBMITTED demo reports so the dashboard has something to show.
// Test data only (open dev rules). Safe to delete docs in the Firestore console.
//   node scripts/seedReports.mjs

import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

// --- date helpers (local) ---
const pad = (n) => String(n).padStart(2, '0')
const toIso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (iso, n) => { const dt = parse(iso); dt.setDate(dt.getDate() + n); return toIso(dt) }
const dayName = (iso) => parse(iso).toLocaleDateString('en-US', { weekday: 'long' })
const mondayOf = (iso) => { const dt = parse(iso); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return toIso(dt) }

const SITE_NAME = { crozet: 'Crozet', 'forest-lakes': 'Forest Lakes', 'mill-creek': 'Mill Creek' }
const DIRECTOR = { crozet: 'Jacqueline Lang', 'forest-lakes': 'Jess Rybak', 'mill-creek': 'Laura Baker' }
const cn = (count, notes = '') => ({ count, notes })

function mk(siteId, date, o = {}) {
  const now = new Date().toISOString()
  return {
    id: `${siteId}_${date}`, siteId, siteName: SITE_NAME[siteId], date,
    day: dayName(date), weekOf: mondayOf(date), director: DIRECTOR[siteId],
    attendance: { preschool: o.pre ?? 40, subsidy: o.sub ?? 8, total: (o.pre ?? 40) + (o.sub ?? 8) },
    labor: { totalHours: o.labor ?? 120, overtimeHours: o.ot ?? 1.5, directorMinutesInRooms: o.dmin ?? 45 },
    enrollmentMarketing: {
      toursGiven: cn(o.toursGiven ?? 2, 'Smith family, Lee family'),
      toursScheduled: cn(o.toursScheduled ?? 3, 'Checked IKS'),
      callsInEmailsWeb: cn(o.calls ?? 5, 'Various inquiries logged'),
      enrollmentCommsOut: cn(o.comms ?? 16, 'Two-way comms with waitlist'),
      regFeesPaid: cn(o.reg ?? 1, 'Nguyen — Tigers — 7/1'),
      newStarts: cn(o.newStarts ?? 1, 'Parker — Bunnies'),
      enrollmentsToday: cn(o.enroll ?? 1, 'Parker — Bunnies — 6/30'),
      terminationsToday: cn(o.terms ?? 0, o.terms ? 'Family relocating' : ''),
    },
    staff: {
      callOutsLate: cn(o.callOuts ?? 1, o.callOuts ? 'Pat — sick' : ''),
      rtoVacation: cn(0, ''),
      sentHome: cn(0, ''),
      staffTerminating: cn(0, ''),
      timeSpentRecruiting: cn(o.recruit ?? 1.5, 'Phone screens'),
      futureHires: cn(o.future ?? 1, 'Kelly — Assistant — 7/15'),
    },
    directorPacket: o.packetNo
      ? { completed: false, incompleteReason: o.packetReason ?? 'Ran out of time — covering a classroom' }
      : { completed: true, incompleteReason: '' },
    directorReport: o.report ?? ['Walkthrough complete', 'Followed up on supply order'],
    qualityScore: o.q ?? 92,
    status: 'submitted',
    submittedAt: o.late ? `${addDays(date, 1)}T08:30:00` : `${date}T12:00:00`,
    createdAt: now, updatedAt: now, createdByUid: 'seed',
  }
}

const today = toIso(new Date())
const thisMon = mondayOf(today)
const lastMon = addDays(thisMon, -7)
const wd = (mon) => [0, 1, 2, 3, 4].map((i) => addDays(mon, i)) // Mon..Fri
const upToToday = (dates) => dates.filter((d) => d <= today)

const reports = []

// Crozet — model site: long streak, thorough, goals met
for (const d of [...wd(lastMon), ...upToToday(wd(thisMon))]) {
  reports.push(mk('crozet', d, { pre: 46, sub: 9, comms: 17, newStarts: 2, q: 96, ot: 1 }))
}
// Forest Lakes — solid but missed TODAY, comms below goal, one high-OT day
for (const d of [...wd(lastMon).slice(0, 3), ...upToToday(wd(thisMon)).filter((x) => x !== today)]) {
  const highOt = d === addDays(thisMon, 1)
  reports.push(mk('forest-lakes', d, { pre: 38, sub: 6, comms: 11, q: 82, ot: highOt ? 9 : 2, labor: highOt ? 110 : 120, terms: d === thisMon ? 1 : 0 }))
}
// Mill Creek — fewer days, a packet miss, a call-out spike, one late submit
for (const d of upToToday(wd(thisMon)).slice(0, 2)) {
  const isTue = d === addDays(thisMon, 1)
  reports.push(mk('mill-creek', d, {
    pre: 33, sub: 5, comms: 9, q: 71, callOuts: isTue ? 3 : 1,
    packetNo: isTue, late: isTue, newStarts: 0,
  }))
}

console.log(`Seeding ${reports.length} demo reports into "${env.VITE_FIREBASE_PROJECT_ID}"…`)
for (const r of reports) {
  // eslint-disable-next-line no-await-in-loop
  await setDoc(doc(db, 'dailyOpsReports', r.id), r)
  console.log(`  ${r.id}  q=${r.qualityScore}`)
}
console.log('\nDone.')
process.exit(0)
