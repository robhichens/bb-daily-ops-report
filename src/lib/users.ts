// src/lib/users.ts
// User profiles live in Firestore `users/{uid}` = { role, siteId?, displayName?, email? }.
// Mirrors the bb-platform role set; only `director` (site-scoped) and `admin` reach the DOR.

import { doc, getDoc, setDoc } from 'firebase/firestore'
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
  siteId?: SiteId // required in practice for directors
  displayName?: string
  email?: string
}

/** Roles permitted to open the Daily Ops Report app at all. */
export const DOR_ROLES: UserRole[] = ['admin', 'director']

export const canAccessDor = (role: UserRole | undefined): boolean =>
  !!role && DOR_ROLES.includes(role)

export const isAdmin = (role: UserRole | undefined): boolean => role === 'admin'

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
