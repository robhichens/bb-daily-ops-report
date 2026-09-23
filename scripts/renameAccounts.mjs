// scripts/renameAccounts.mjs
// Renames the login email on EXISTING auth accounts (UID unchanged) and syncs the
// matching users/{uid} Firestore doc (email + displayName). No passwords touched.
//   node scripts/renameAccounts.mjs "<key.json>"

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const keyPath = process.argv[2]
if (!keyPath) { console.error('Usage: node scripts/renameAccounts.mjs "<key.json>"'); process.exit(1) }

// from  ->  { email, displayName }   (role/siteId on the user doc are left as-is)
const RENAMES = [
  { from: 'admin@bbdor.test',       email: 'rob@brightbeginningsva.com',         displayName: 'Rob Hichens' },
  { from: 'crozet@bbdor.test',      email: 'crozet@brightbeginningsva.com',      displayName: 'Jacqueline Lang' },
  { from: 'forestlakes@bbdor.test', email: 'forestlakes@brightbeginningsva.com', displayName: 'Jess Rybak' },
  { from: 'millcreek@bbdor.test',   email: 'millcreek@brightbeginningsva.com',   displayName: 'Laura Baker' },
]

const key = JSON.parse(readFileSync(keyPath, 'utf8'))
initializeApp({ credential: cert(key) })
const auth = getAuth()
const db = getFirestore()

for (const r of RENAMES) {
  // eslint-disable-next-line no-await-in-loop
  const u = await auth.getUserByEmail(r.from).catch(() => null)
  if (!u) { console.log(`  SKIP   ${r.from} (not found)`); continue }
  // eslint-disable-next-line no-await-in-loop
  await auth.updateUser(u.uid, { email: r.email, emailVerified: false, displayName: r.displayName })
  // eslint-disable-next-line no-await-in-loop
  await db.collection('users').doc(u.uid).set({ email: r.email, displayName: r.displayName }, { merge: true })
  console.log(`  OK     ${r.from}  ->  ${r.email}   (${u.uid})`)
}
console.log('\nDone.')
process.exit(0)
