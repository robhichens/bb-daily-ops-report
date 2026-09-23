// scripts/resetLink.mjs
// Generates a fresh password-setup link for one account. No passwords read or set.
//   node scripts/resetLink.mjs "<key.json>" <email>

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

const [keyPath, email] = process.argv.slice(2)
if (!keyPath || !email) { console.error('Usage: node scripts/resetLink.mjs "<key.json>" <email>'); process.exit(1) }

const key = JSON.parse(readFileSync(keyPath, 'utf8'))
initializeApp({ credential: cert(key) })
const link = await getAuth().generatePasswordResetLink(email)
console.log(`\n${email}\n${link}\n`)
process.exit(0)
