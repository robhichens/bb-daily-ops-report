// src/lib/users.ts
// User profiles live in Firestore `users/{uid}` = { role, siteId?, siteIds?, displayName?, email? }.
// Mirrors the bb-platform role set; only `director` (site-scoped) and `admin` reach the DOR.
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
  /** Per-report grants for NON-admins: 'fill' (submit) or 'view' (read-only).
   *  Admins implicitly have 'fill' on everything; directors implicitly have
   *  'fill' on DDR for their site(s). Managed from Users & Access. */
  reportAccess?: Partial<Record<ReportKey, ReportAccessLevel>>
}

/** Roles permitted to open the Daily Ops Report app at all. */
export const DOR_ROLES: UserRole[] = ['admin', 'director']

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
 *  - DDR: directors get 'fill' if they have any site; else per-user grant.
 *  - FDR/ADR/MDR/EDR: the per-user grant in reportAccess.
 * Assigning a report to a user also makes that report's dashboard data visible.
 */
export function reportAccessLevel(
  profile: UserProfile | null,
  key: ReportKey
): ReportAccessLevel | null {
  if (!profile) return null
  if (isAdmin(profile.role)) return 'fill'
  if (key === 'ddr' && userSites(profile).length > 0) return 'fill'
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
}

/** Admin-only: invite someone by email from Users & Access. Creates their
 *  Firebase Auth account + Firestore profile via the invite-user Netlify
 *  Function (privileged — needs firebase-admin, can't run client-side), then
 *  sends the same password-reset email "Forgot password?" uses, so they land
 *  on the set-password screen themselves. This code never sees a password. */
export async function inviteUser(
  idToken: string,
  email: string,
  role: 'admin' | 'director',
  siteIds: SiteId[]
): Promise<InviteResult> {
  const res = await fetch('/api/invite-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ email, role, siteIds }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Invite failed (${res.status})`)
  await sendPasswordResetEmail(auth, email)
  return body as InviteResult
}
