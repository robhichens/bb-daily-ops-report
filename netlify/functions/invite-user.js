// netlify/functions/invite-user.js
// Admin-only: create a Firebase Auth account for an email address (no
// password set) and a matching Firestore users/{uid} profile, so the person
// shows up in Users & Access ready to be granted schools/reports. The client
// follows up with sendPasswordResetEmail (same path as "Forgot password?"),
// so the person sets their own password on first login — this function never
// sees or sets one.
//
// Needs firebase-admin (privileged) — cannot run client-side. Requires the
// FIREBASE_SERVICE_ACCOUNT_KEY env var in Netlify: the full JSON content of a
// service account key for the bb-daily-ops-report Firebase project (Firebase
// Console → Project settings → Service accounts → Generate new private key),
// pasted as-is. Rob already generated one of these for this project during
// account setup (kept outside the repo) — that same key works here.

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = ['admin', 'director']
const VALID_SITES = ['crozet', 'forest-lakes', 'mill-creek']

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(obj),
  }
}

function admin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set')
    let key
    try {
      key = JSON.parse(raw)
    } catch {
      key = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    }
    initializeApp({ credential: cert(key) })
  }
  return { auth: getAuth(), db: getFirestore() }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let auth, db
  try {
    ;({ auth, db } = admin())
  } catch (err) {
    console.error(err)
    return json(500, { error: 'Invite is not configured yet — FIREBASE_SERVICE_ACCOUNT_KEY is missing in Netlify.' })
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return json(401, { error: 'Missing auth token' })

  let callerUid
  try {
    callerUid = (await auth.verifyIdToken(idToken)).uid
  } catch {
    return json(401, { error: 'Invalid auth token' })
  }

  const callerSnap = await db.doc(`users/${callerUid}`).get()
  if (callerSnap.data()?.role !== 'admin') {
    return json(403, { error: 'Admin access required' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid request body' })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const role = body.role
  const siteIds = Array.isArray(body.siteIds) ? body.siteIds.filter((s) => VALID_SITES.includes(s)) : []

  if (!EMAIL_RE.test(email)) return json(400, { error: 'Enter a valid email address' })
  if (!VALID_ROLES.includes(role)) return json(400, { error: 'Role must be admin or director' })
  if (role === 'director' && siteIds.length === 0) return json(400, { error: 'Pick at least one school for a director' })

  let userRecord
  let isNew = false
  try {
    userRecord = await auth.getUserByEmail(email)
  } catch {
    try {
      userRecord = await auth.createUser({ email, emailVerified: false })
      isNew = true
    } catch (err) {
      console.error(err)
      return json(500, { error: 'Could not create the account' })
    }
  }

  // Only seed the profile for a brand-new account — resending an invite to an
  // existing email must never silently overwrite that person's real role/sites.
  if (isNew) {
    const profile = { email, role, ...(role === 'director' ? { siteIds, siteId: siteIds[0] } : {}) }
    await db.doc(`users/${userRecord.uid}`).set(profile, { merge: true })
  }

  return json(200, { uid: userRecord.uid, reused: !isNew })
}
