// scripts/checkUser.mjs
// READ-ONLY. Shows one auth account's sign-in metadata (has she ever signed in?).
//   node scripts/checkUser.mjs "<key.json>" <email>

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

const [keyPath, email] = process.argv.slice(2)
const key = JSON.parse(readFileSync(keyPath, 'utf8'))
initializeApp({ credential: cert(key) })

const u = await getAuth().getUserByEmail(email)
console.log(`\n${u.email}  (${u.uid})`)
console.log(`  created:       ${u.metadata.creationTime}`)
console.log(`  last sign-in:  ${u.metadata.lastSignInTime ?? 'NEVER'}`)
console.log(`  last refresh:  ${u.metadata.lastRefreshTime ?? '—'}`)
console.log(`  disabled:      ${u.disabled}`)
process.exit(0)
