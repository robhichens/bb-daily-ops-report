// scripts/deleteAuthUser.mjs  (Admin SDK)
// Deletes an Auth account + its Firestore users/{uid} doc by email. Use for junk
// / mistyped invite accounts that were never used.
//   node scripts/deleteAuthUser.mjs "<key.json>" <email>

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const [keyPath, email] = process.argv.slice(2)
const key = JSON.parse(readFileSync(keyPath, 'utf8'))
initializeApp({ credential: cert(key) })
const auth = getAuth()
const db = getFirestore()

const u = await auth.getUserByEmail(email)
if (u.metadata.lastSignInTime) {
  console.log(`REFUSING: ${email} has signed in before (lastSignIn ${u.metadata.lastSignInTime}). Not deleting.`)
  process.exit(1)
}
await auth.deleteUser(u.uid)
await db.doc(`users/${u.uid}`).delete()
console.log(`Deleted ${email} (${u.uid}) — Auth account + users doc.`)
process.exit(0)
