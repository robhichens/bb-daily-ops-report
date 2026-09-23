// scripts/setTempPassword.mjs
// Sets a temporary password on an existing account (admin override) so the user
// can sign in immediately, then change it via "Forgot password?" later.
//   node scripts/setTempPassword.mjs "<key.json>" <email> <password>

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

const [keyPath, email, password] = process.argv.slice(2)
if (!keyPath || !email || !password) {
  console.error('Usage: node scripts/setTempPassword.mjs "<key.json>" <email> <password>')
  process.exit(1)
}
const key = JSON.parse(readFileSync(keyPath, 'utf8'))
initializeApp({ credential: cert(key) })

const u = await getAuth().getUserByEmail(email)
await getAuth().updateUser(u.uid, { password })
console.log(`\n✓ Temp password set for ${email} (${u.uid})`)
console.log(`  They can sign in now, then change it via "Forgot password?".`)
process.exit(0)
