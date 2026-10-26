// src/lib/notifications.ts
// In-app notifications: one small doc per person per event in `notifications`
// (firestore.rules: you can only read/clear your own; any DOR user can create
// one "from" themselves). The bell in the header reads them live. Push to a
// phone later = a function that watches this collection; the data already says
// who, what and where. Writes are best-effort and never block the comment/
// request they describe.

import {
  addDoc, collection, doc, limit, onSnapshot, query, updateDoc, where, writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export type NotificationKind = 'comment' | 'reply' | 'request_done'

export interface NotificationInput {
  toUid: string
  fromUid: string
  fromName: string
  kind: NotificationKind
  /** First line of what was said (comment text, or how a request was resolved). */
  text: string
  /** Short context: the note or request it's about. */
  about: string
  /** Where tapping it goes, e.g. "/report?site=mill-creek&date=2026-10-20". */
  to: string
}

export interface AppNotification extends NotificationInput {
  id: string
  at: string // ISO
  read: boolean
}

const COL = 'notifications'

export async function notify(inputs: NotificationInput[]): Promise<void> {
  const at = new Date().toISOString()
  await Promise.all(
    inputs
      .filter((n) => n.toUid && n.toUid !== n.fromUid)
      .map((n) => addDoc(collection(db, COL), { ...n, at, read: false }))
  ).catch((err) => console.warn('Notification skipped', err))
}

/** My notifications, newest first. (Equality filter only: no composite index.) */
export function subscribeMyNotifications(uid: string, cb: (rows: AppNotification[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, COL), where('toUid', '==', uid), limit(100)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
          .sort((a, b) => (a.at < b.at ? 1 : -1))
      ),
    () => cb([])
  )
}

export const markNotificationRead = (id: string) => updateDoc(doc(db, COL, id), { read: true })

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return
  const batch = writeBatch(db)
  for (const id of ids.slice(0, 400)) batch.update(doc(db, COL, id), { read: true })
  await batch.commit()
}
