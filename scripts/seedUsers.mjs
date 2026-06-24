// scripts/seedUsers.mjs
// Seeds TEST auth accounts + users/{uid} profile docs for the Daily Ops Report.
// Uses the Firebase *client* SDK against the live bb-daily-ops-report project
// (open dev rules). Test accounts only — safe to delete in the Firebase console.
//
//   node scripts/seedUsers.mjs
//
// Requires: Email/Password sign-in enabled in Firebase console
//   (Authentication → Sign-in method → Email/Password → Enable).
// Re-running is safe: existing accounts are detected and only their profile
// docs are re-written.

import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

// --- load VITE_FIREBASE_* from .env.local -----------------------------------
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

// --- the test users ----------------------------------------------------------
// NOTE: director→site mapping is a guess for testing — confirm with Rob.
const TEST_PASSWORD = 'BBdor-test-2026!'
const USERS = [
  { email: 'admin@bbdor.test',      password: TEST_PASSWORD, role: 'admin',                          displayName: 'Admin (Leadership)' },
  { email: 'crozet@bbdor.test',     password: TEST_PASSWORD, role: 'director', siteId: 'crozet',      displayName: 'Jacqueline Lang' },
  { email: 'forestlakes@bbdor.test',password: TEST_PASSWORD, role: 'director', siteId: 'forest-lakes',displayName: 'Jess Rybak' },
  { email: 'millcreek@bbdor.test',  password: TEST_PASSWORD, role: 'director', siteId: 'mill-creek',  displayName: 'Laura Baker' },
]

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

async function ensureUser(u) {
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(auth, u.email, u.password)
    uid = cred.user.uid
    await updateProfile(cred.user, { displayName: u.displayName })
    console.log(`  created  ${u.email}`)
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, u.email, u.password)
      uid = cred.user.uid
      console.log(`  exists   ${u.email}`)
    } else {
      throw err
    }
  }
  const profile = { role: u.role, displayName: u.displayName, email: u.email }
  if (u.siteId) profile.siteId = u.siteId
  await setDoc(doc(db, 'users', uid), profile, { merge: true })
  console.log(`  profile  users/${uid}  (${u.role}${u.siteId ? ' · ' + u.siteId : ''})`)
}

console.log(`Seeding ${USERS.length} test users into "${firebaseConfig.projectId}"…`)
for (const u of USERS) {
  // eslint-disable-next-line no-await-in-loop
  await ensureUser(u)
}
console.log('\nDone. Test password for all accounts:', TEST_PASSWORD)
process.exit(0)
