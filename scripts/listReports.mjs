// scripts/listReports.mjs
// READ-ONLY. Lists every report in Firestore so we can see demo (createdByUid:'seed')
// vs real submissions. Writes nothing, deletes nothing.
//   node scripts/listReports.mjs

import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

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

const snap = await getDocs(collection(db, 'dailyOpsReports'))
const rows = snap.docs.map((d) => d.data())
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : String(a.siteName).localeCompare(b.siteName)))

let seed = 0, real = 0
console.log(`\n${rows.length} reports in "${env.VITE_FIREBASE_PROJECT_ID}":\n`)
console.log('  KIND  DATE        SITE          DIRECTOR           UID')
console.log('  ----  ----------  ------------  -----------------  ---')
for (const r of rows) {
  const isSeed = r.createdByUid === 'seed'
  isSeed ? seed++ : real++
  console.log(
    `  ${isSeed ? 'demo' : 'REAL'}  ${r.date}  ${String(r.siteName).padEnd(12)}  ${String(r.director || '—').padEnd(17)}  ${r.createdByUid}`
  )
}
console.log(`\n  ${seed} demo (createdByUid:'seed')   ·   ${real} REAL submissions\n`)
process.exit(0)
