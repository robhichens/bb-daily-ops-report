// src/lib/users.ts
// User profiles live in Firestore `users/{uid}` = { role, siteId?, siteIds?, displayName?, email? }.
// Mirrors the bb-platform role set; only `director` (site-scoped) and `admin` reach the DOR.
// `siteIds` (list) is the source of truth for site access; legacy docs may only
// have `siteId`, so always read access through `userSites()`.

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { SiteId } from './schema'

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
