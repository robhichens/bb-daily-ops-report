// scripts/cleanReports.mjs
// Backs up ALL reports to a JSON file, then deletes every report EXCEPT the
// id(s) passed in KEEP. Backup happens before any delete, so this is recoverable.
//   node scripts/cleanReports.mjs <backupPath> <keepId> [keepId...]

import { writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore'

const [backupPath, ...KEEP] = process.argv.slice(2)
if (!backupPath || KEEP.length === 0) {
  console.error('Usage: node scripts/cleanReports.mjs <backupPath> <keepId> [keepId...]')
  process.exit(1)
}
const keepSet = new Set(KEEP)

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

// 1) Backup everything first.
const snap = await getDocs(collection(db, 'dailyOpsReports'))
const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
writeFileSync(backupPath, JSON.stringify(all, null, 2))
console.log(`Backed up ${all.length} reports → ${backupPath}\n`)

// 2) Delete everything except KEEP.
let deleted = 0, kept = 0
for (const r of all) {
  if (keepSet.has(r.id)) {
    kept++
    console.log(`  KEEP    ${r.id}  (${r.director || '—'})`)
    continue
  }
  // eslint-disable-next-line no-await-in-loop
  await deleteDoc(doc(db, 'dailyOpsReports', r.id))
  deleted++
  console.log(`  deleted ${r.id}`)
}
console.log(`\nDone. Kept ${kept}, deleted ${deleted}.`)
process.exit(0)
