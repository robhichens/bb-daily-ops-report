// scripts/inspectUser.mjs  (READ-ONLY, Admin SDK)
// Shows Auth metadata + the Firestore users/{uid} profile for one or more emails.
//   node scripts/inspectUser.mjs "<key.json>" email1 [email2 ...]

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const [keyPath, ...emails] = process.argv.slice(2)
const key = JSON.parse(readFileSync(keyPath, 'utf8'))
initializeApp({ credential: cert(key) })
const auth = getAuth()
const db = getFirestore()

for (const email of emails) {
  console.log(`\n=== ${email} ===`)
  try {
    const u = await auth.getUserByEmail(email)
    console.log(`  uid:          ${u.uid}`)
    console.log(`  disabled:     ${u.disabled}`)
    console.log(`  lastSignIn:   ${u.metadata.lastSignInTime ?? 'NEVER'}`)
    const snap = await db.doc(`users/${u.uid}`).get()
    console.log(`  users doc:    ${snap.exists ? JSON.stringify(snap.data()) : '(none)'}`)
  } catch (e) {
    console.log(`  not found (${e.code || e.message})`)
  }
}
process.exit(0)
