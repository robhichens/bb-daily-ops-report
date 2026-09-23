// scripts/listUsers.mjs
// READ-ONLY. Lists users/{uid} docs so we can confirm roles/siteIds exist BEFORE
// deploying role-based firestore.rules (missing docs = lockout). Writes nothing.
//   node scripts/listUsers.mjs

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

const snap = await getDocs(collection(db, 'users'))
console.log(`\n${snap.size} users/{uid} docs in "${env.VITE_FIREBASE_PROJECT_ID}":\n`)
console.log('  ROLE      SITE          DISPLAY / EMAIL                 UID')
console.log('  --------  ------------  -----------------------------  ---')
for (const d of snap.docs) {
  const u = d.data()
  console.log(
    `  ${String(u.role || '—').padEnd(8)}  ${String(u.siteId || '—').padEnd(12)}  ${String(u.displayName || u.email || '—').padEnd(29)}  ${d.id}`
  )
}
console.log('')
process.exit(0)
