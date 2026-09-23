// scripts/listAuthUsers.mjs
// READ-ONLY. Lists Firebase Auth accounts via the Admin SDK (bypasses rules).
// The service-account key is read inside node — its secret never leaves the file.
//   node scripts/listAuthUsers.mjs "<path-to-serviceAccount.json>"

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

const keyPath = process.argv[2]
if (!keyPath) { console.error('Usage: node scripts/listAuthUsers.mjs "<key.json>"'); process.exit(1) }

const key = JSON.parse(readFileSync(keyPath, 'utf8'))
initializeApp({ credential: cert(key) })
console.log(`\nProject: ${key.project_id}\nService account: ${key.client_email}\n`)

const res = await getAuth().listUsers(1000)
console.log(`${res.users.length} Auth accounts:\n`)
console.log('  EMAIL                              UID                           STATE')
console.log('  ---------------------------------  ----------------------------  -----')
for (const u of res.users) {
  console.log(`  ${String(u.email || '—').padEnd(33)}  ${u.uid.padEnd(28)}  ${u.disabled ? 'disabled' : 'active'}`)
}
console.log('')
process.exit(0)
