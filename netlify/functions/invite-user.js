// netlify/functions/invite-user.js
// Admin-only: create a Firebase Auth account for an email address (no
// password set) and a matching Firestore users/{uid} profile, so the person
// shows up in Users & Access ready to be granted schools/reports. Then it
// emails them a branded invite (netlify/lib/inviteEmail.js) via Resend, with a
// Firebase set-password link, so the person sets their own password on first
// login — this function never sees or sets one.
//
// If RESEND_API_KEY isn't set (or Resend fails) it returns emailSent:false and
// the client falls back to the plain Firebase "reset password" email, so an
// invite always goes out one way or the other.
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
import { buildInviteEmail } from '../lib/inviteEmail.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = ['admin', 'director', 'co_director', 'finance', 'admissions']
// Scoped roles get their one report seeded at invite time so it works immediately.
const SEEDED_ACCESS = { co_director: { edr: 'fill' }, finance: { fdr: 'fill' }, admissions: { adr: 'fill' } }
const SITE_ROLES = ['director', 'co_director']
const APP_URL = (process.env.URL || 'https://bbdor.netlify.app').replace(/\/$/, '')
const FROM = 'Bright Beginnings <noreply@brightbeginningsva.com>'
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
  const caller = callerSnap.data()
  if (caller?.role !== 'admin') {
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
  const name = String(body.name || '').trim().slice(0, 80)
  const note = String(body.note || '').trim().slice(0, 1000)
  const siteIds = Array.isArray(body.siteIds) ? body.siteIds.filter((s) => VALID_SITES.includes(s)) : []

  if (!EMAIL_RE.test(email)) return json(400, { error: 'Enter a valid email address' })
  if (!VALID_ROLES.includes(role)) return json(400, { error: 'Pick a valid role' })
  if (SITE_ROLES.includes(role) && siteIds.length === 0) return json(400, { error: 'Pick at least one school' })

  let userRecord
  let isNew = false
  try {
    userRecord = await auth.getUserByEmail(email)
  } catch {
    try {
      userRecord = await auth.createUser({ email, emailVerified: false, ...(name ? { displayName: name } : {}) })
      isNew = true
    } catch (err) {
      console.error(err)
      return json(500, { error: 'Could not create the account' })
    }
  }

  // Only seed the profile for a brand-new account — resending an invite to an
  // existing email must never silently overwrite that person's real role/sites.
  if (isNew) {
    const profile = { email, role }
    if (name) profile.displayName = name
    if (SITE_ROLES.includes(role)) {
      profile.siteIds = siteIds
      profile.siteId = siteIds[0]
    }
    // Co-director → CDR, finance → FDR, admissions → ADR: seed that one grant so
    // it works immediately and shows as "Fill" in Users & Access.
    if (SEEDED_ACCESS[role]) profile.reportAccess = SEEDED_ACCESS[role]
    await db.doc(`users/${userRecord.uid}`).set(profile, { merge: true })
  } else if (name && !userRecord.displayName) {
    await auth.updateUser(userRecord.uid, { displayName: name })
  }

  // For a resend, describe the account as it really is, not what the form said.
  let emailRole = role
  let emailSites = siteIds
  if (!isNew) {
    const existing = (await db.doc(`users/${userRecord.uid}`).get()).data() || {}
    emailRole = existing.role || role
    emailSites = existing.siteIds || (existing.siteId ? [existing.siteId] : siteIds)
  }

  let inviterName = caller.displayName || ''
  if (!inviterName) {
    try { inviterName = (await auth.getUser(callerUid)).displayName || '' } catch { /* optional */ }
  }

  const emailSent = await sendInvite({
    to: email,
    replyTo: caller.email,
    name: name || userRecord.displayName || '',
    role: emailRole,
    siteIds: emailSites,
    inviterName,
    note,
    auth,
  })

  return json(200, { uid: userRecord.uid, reused: !isNew, emailSent })
}

/** Branded invite via Resend. Returns false (never throws) so the client can
 *  fall back to Firebase's own reset email. */
async function sendInvite({ to, replyTo, name, role, siteIds, inviterName, note, auth }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    let link
    try {
      // Send them back to the app's sign-in page after they set a password.
      link = await auth.generatePasswordResetLink(to, { url: `${APP_URL}/login` })
    } catch {
      link = await auth.generatePasswordResetLink(to) // domain not authorized for continue URLs
    }
    const { subject, html, text } = buildInviteEmail({ name, role, siteIds, inviterName, note, link, appUrl: APP_URL })
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    })
    if (!res.ok) {
      console.error('Resend error', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error(err)
    return false
  }
}
