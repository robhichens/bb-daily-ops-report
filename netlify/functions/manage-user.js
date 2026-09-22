// netlify/functions/manage-user.js
// Admin-only user management: disable (make inactive), enable (reactivate), or
// delete an account. Deleting also removes the Firestore users/{uid} profile —
// use it to clear out a mistyped invite. Disabling blocks sign-in but keeps the
// account + history (offboarding a real person). A disabled flag is mirrored to
// the users doc so Users & Access can show status live.
//
// Privileged (firebase-admin) — cannot run client-side. Same auth model and
// FIREBASE_SERVICE_ACCOUNT_KEY env var as invite-user.js.

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const VALID_ACTIONS = ['disable', 'enable', 'delete']

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
    return json(500, { error: 'User management is not configured yet — FIREBASE_SERVICE_ACCOUNT_KEY is missing in Netlify.' })
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

  const action = body.action
  const uid = String(body.uid || '')
  if (!VALID_ACTIONS.includes(action)) return json(400, { error: 'Unknown action' })
  if (!uid) return json(400, { error: 'Missing user id' })
  if (uid === callerUid) return json(400, { error: 'You can’t deactivate or delete your own account.' })

  try {
    if (action === 'delete') {
      await auth.deleteUser(uid).catch((e) => { if (e?.code !== 'auth/user-not-found') throw e })
      await db.doc(`users/${uid}`).delete()
    } else {
      const disabled = action === 'disable'
      await auth.updateUser(uid, { disabled })
      await db.doc(`users/${uid}`).set({ disabled }, { merge: true })
    }
  } catch (err) {
    console.error(err)
    return json(500, { error: 'Could not update that account' })
  }

  return json(200, { ok: true, uid, action })
}
