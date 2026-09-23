// src/lib/users.ts
// User profiles live in Firestore `users/{uid}` = { role, siteId?, siteIds?, displayName?, email? }.
// Mirrors the bb-platform role set. Roles that reach the DOR: `admin` (Kathe/
// Molly/Rob — see everything), `director` (site-scoped DDR), `co_director` (fills
// the CDR for a campus), and `finance` / `admissions` (scoped to one org report —
// FDR / ADR — via reportAccess, no DDR or all-org access).
// `siteIds` (list) is the source of truth for site access; legacy docs may only
// have `siteId`, so always read access through `userSites()`.

import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth, db } from './firebase'
import type { ReportAccessLevel, ReportKey, SiteId } from './schema'

export type UserRole =
  | 'admin'
  | 'director'
  | 'co_director'
  | 'finance'
  | 'admissions'
  | 'teacher'
  | 'assistant'
  | 'floater'
  | 'new_hire'

export interface UserProfile {
  uid: string
  role: UserRole
  siteId?: SiteId // legacy single site; kept in sync with siteIds[0]
  siteIds?: SiteId[] // site access list (directors)
  displayName?: string
  email?: string
  dayNotesSeenAt?: string // ISO — last time this user opened Day Notes (nudge sync)
  disabled?: boolean // deactivated: can't sign in (mirrored from Auth by manage-user)
  /** Per-report grants for NON-admins: 'fill' (submit) or 'view' (read-only).
   *  Admins implicitly have 'fill' on everything; directors implicitly have
   *  'fill' on DDR for their site(s). Managed from Users & Access. */
  reportAccess?: Partial<Record<ReportKey, ReportAccessLevel>>
}

/** Roles permitted to open the Daily Ops Report app at all. */
export const DOR_ROLES: UserRole[] = ['admin', 'director', 'co_director', 'finance', 'admissions']

export const canAccessDor = (role: UserRole | undefined): boolean =>
  !!role && DOR_ROLES.includes(role)

export const isAdmin = (role: UserRole | undefined): boolean => role === 'admin'

/** A user's site access as a list, whichever field the doc has. */
export function userSites(profile: UserProfile | null): SiteId[] {
  if (!profile) return []
  if (profile.siteIds?.length) return profile.siteIds
  return profile.siteId ? [profile.siteId] : []
}

/**
 * A user's access level to one report, or null for none.
 *  - Admins (all leadership): 'fill' on everything.
 *  - DDR: only DIRECTORS auto-get 'fill' (for their site). A co-director also has
 *    a campus but must NOT touch the DDR, so DDR is gated on the role, not the
 *    site — everyone else needs a per-user grant.
 *  - FDR/ADR/CDR/etc.: the per-user grant in reportAccess (a co-director is
 *    seeded reportAccess.edr='fill' at invite time, so they fill the CDR only).
 * Assigning a report to a user also makes that report's dashboard data visible.
 */
export function reportAccessLevel(
  profile: UserProfile | null,
  key: ReportKey
): ReportAccessLevel | null {
  if (!profile) return null
  if (isAdmin(profile.role)) return 'fill'
  if (key === 'ddr' && profile.role === 'director' && userSites(profile).length > 0) return 'fill'
  return profile.reportAccess?.[key] ?? null
}

/** All reports a user can reach (fill OR view), in registry order isn't known here
 *  so callers order via the registry; this just filters. */
export function accessibleReportKeys(profile: UserProfile | null): ReportKey[] {
  const all: ReportKey[] = ['ddr', 'adr', 'mdr', 'edr', 'fdr']
  return all.filter((k) => reportAccessLevel(profile, k) !== null)
}

const usersRef = (uid: string) => doc(db, 'users', uid)

/** One-shot read of a user's profile. Returns null if the doc doesn't exist. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(usersRef(uid))
  if (!snap.exists()) return null
  return { uid, ...(snap.data() as Omit<UserProfile, 'uid'>) }
}

/** Upsert a user's profile (used by the seed script / admin tooling). */
export async function upsertUserProfile(profile: UserProfile): Promise<void> {
  const { uid, ...rest } = profile
  await setDoc(usersRef(uid), rest, { merge: true })
}

/** Live list of every user profile (admin Users & Access panel). */
export function subscribeUsers(cb: (users: UserProfile[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'users'), (snap) => {
    cb(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) })))
  })
}

/** Set a director's site access. Keeps legacy `siteId` synced to the first site. */
export async function updateUserSites(uid: string, siteIds: SiteId[]): Promise<void> {
  await setDoc(usersRef(uid), { siteIds, siteId: siteIds[0] ?? null }, { merge: true })
}

/** Grant/revoke one report for a user. `null` removes the grant entirely. */
export async function updateUserReportAccess(
  uid: string,
  key: ReportKey,
  level: ReportAccessLevel | null
): Promise<void> {
  await updateDoc(usersRef(uid), {
    [`reportAccess.${key}`]: level ?? deleteField(),
  })
}

/** Live subscription to just this user's Day-Notes "last seen" timestamp, so the
 *  reply nudge clears across a user's devices. Only writable by admins per
 *  firestore.rules (users/{uid} write = admin only), so directors fall back to
 *  the per-device localStorage marker. */
export function subscribeDayNotesSeenAt(uid: string, cb: (iso: string) => void): Unsubscribe {
  return onSnapshot(usersRef(uid), (snap) => {
    cb((snap.data() as Partial<UserProfile> | undefined)?.dayNotesSeenAt ?? '')
  })
}

/** Persist the Day-Notes "last seen" timestamp on the user doc (admins only). */
export async function setDayNotesSeenAt(uid: string, iso: string): Promise<void> {
  await setDoc(usersRef(uid), { dayNotesSeenAt: iso }, { merge: true })
}

export interface InviteResult {
  uid: string
  reused: boolean // true = the email already had an account; we just resent the set-password email
  emailSent: boolean // true = the branded invite went out; false = fell back to Firebase's plain reset email
}

export type InviteRole = 'admin' | 'director' | 'co_director' | 'finance' | 'admissions'

export interface InviteInput {
  email: string
  name: string // invitee's name — greets them + becomes their displayName
  role: InviteRole
  siteIds: SiteId[]
  note: string // optional personal note shown in the email
}

/** Admin-only: invite someone by email from Users & Access. Creates their
 *  Firebase Auth account + Firestore profile via the invite-user Netlify
 *  Function (privileged — needs firebase-admin, can't run client-side), which
 *  also emails them the branded invite with a set-password link. If that email
 *  couldn't go out, fall back to the plain "Forgot password?" email so they
 *  still get a way in. This code never sees a password. */
export async function inviteUser(idToken: string, input: InviteInput): Promise<InviteResult> {
  const res = await fetch('/api/invite-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(input),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Invite failed (${res.status})`)
  if (!body.emailSent) await sendPasswordResetEmail(auth, input.email)
  return { uid: body.uid, reused: !!body.reused, emailSent: !!body.emailSent }
}

/** Admin-only: deactivate (block sign-in), reactivate, or delete an account.
 *  Routes to the manage-user Netlify Function (privileged). Delete also removes
 *  the Firestore profile — use it to clear a mistyped invite. */
async function manageUser(idToken: string, action: 'disable' | 'enable' | 'delete', uid: string): Promise<void> {
  const res = await fetch('/api/manage-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action, uid }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Action failed (${res.status})`)
  }
}

export const setUserDisabled = (idToken: string, uid: string, disabled: boolean) =>
  manageUser(idToken, disabled ? 'disable' : 'enable', uid)
export const deleteUser = (idToken: string, uid: string) => manageUser(idToken, 'delete', uid)
