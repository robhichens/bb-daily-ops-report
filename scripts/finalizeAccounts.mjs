// scripts/finalizeAccounts.mjs
// 1) Writes users/{uid} admin role docs for the new leadership accounts.
// 2) Generates a password-SETUP link for all accounts so each person sets their
//    own password. No passwords are read or set here.
//   node scripts/finalizeAccounts.mjs "<key.json>"

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const keyPath = process.argv[2]
if (!keyPath) { console.error('Usage: node scripts/finalizeAccounts.mjs "<key.json>"'); process.exit(1) }

// New leadership accounts that still need a role doc (admin).
const NEW_ADMINS = [
  { email: 'kathe@brightbeginningsva.com',  displayName: 'Kathe Petchel' },
  { email: 'molly@brightbeginningsva.com',  displayName: 'Molly Hichens' },
  { email: 'alicia@brightbeginningsva.com', displayName: 'Alicia Williams' },
]

// Everyone who should get a setup link, in send order.
const ALL = [
  { email: 'rob@brightbeginningsva.com',         name: 'Rob Hichens (Admin)' },
  { email: 'kathe@brightbeginningsva.com',        name: 'Kathe Petchel (Admin)' },
  { email: 'molly@brightbeginningsva.com',        name: 'Molly Hichens (Admin)' },
  { email: 'alicia@brightbeginningsva.com',       name: 'Alicia Williams (Admin)' },
  { email: 'crozet@brightbeginningsva.com',       name: 'Jacqueline Lang (Crozet)' },
  { email: 'forestlakes@brightbeginningsva.com',  name: 'Jess Rybak (Forest Lakes)' },
  { email: 'millcreek@brightbeginningsva.com',    name: 'Laura Baker (Mill Creek)' },
]

const key = JSON.parse(readFileSync(keyPath, 'utf8'))
initializeApp({ credential: cert(key) })
const auth = getAuth()
const db = getFirestore()

console.log('\n--- Role docs (new admins) ---')
for (const a of NEW_ADMINS) {
  // eslint-disable-next-line no-await-in-loop
  const u = await auth.getUserByEmail(a.email).catch(() => null)
  if (!u) { console.log(`  SKIP ${a.email} (not found)`); continue }
  // eslint-disable-next-line no-await-in-loop
  await db.collection('users').doc(u.uid).set(
    { role: 'admin', displayName: a.displayName, email: a.email }, { merge: true }
  )
  console.log(`  OK   ${a.email}  -> role:admin  (${u.uid})`)
}

console.log('\n--- Password-setup links (expire ~1 hour — send promptly) ---\n')
for (const p of ALL) {
  // eslint-disable-next-line no-await-in-loop
  const link = await auth.generatePasswordResetLink(p.email).catch((e) => `ERROR: ${e.message}`)
  console.log(`${p.name}\n  ${p.email}\n  ${link}\n`)
}
process.exit(0)
