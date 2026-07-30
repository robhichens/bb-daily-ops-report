// src/lib/dayNotesRead.ts
// Tracks when a user last opened Day Notes so we can nudge them about replies
// they haven't seen. Read-state is per-device (localStorage): directors can't
// write their own users/{uid} doc under firestore.rules, and a nudge doesn't
// need to be perfectly cross-device. Keyed by uid so a shared browser doesn't
// bleed one account's "seen" into another's.

import type { DailyOpsReport, NoteComment, SiteId } from './schema'
import { setDayNotesSeenAt } from './users'

const keyFor = (uid: string) => `bbdor:dayNotesSeen:${uid}`

/** The later of two ISO timestamps ('' counts as earliest). */
export function laterIso(a: string, b: string): string {
  return a > b ? a : b
}

/** Per-device ISO timestamp the user last opened Day Notes ('' if never). */
export function getDayNotesSeen(uid: string): string {
  if (!uid) return ''
  try {
    return localStorage.getItem(keyFor(uid)) ?? ''
  } catch {
    return ''
  }
}

/**
 * Mark Day Notes as read now. Always writes the per-device localStorage marker
 * and pokes the nav badge; when `syncRemote` (admins, who may write their own
 * user doc) it also persists to Firestore so the nudge clears on their other
 * devices. Directors pass syncRemote=false — the write would be denied.
 */
export function markDayNotesSeen(uid: string, syncRemote: boolean): void {
  if (!uid) return
  const now = new Date().toISOString()
  try {
    localStorage.setItem(keyFor(uid), now)
    window.dispatchEvent(new Event('daynotes-seen'))
  } catch {
    /* ignore private-mode / storage failures — the nudge is best-effort */
  }
  if (syncRemote) {
    setDayNotesSeenAt(uid, now).catch(() => {
      /* best-effort; localStorage still covers this device */
    })
  }
}

const isFromAdmin = (c: NoteComment) => (c.role ?? 'admin') === 'admin'

/**
 * Count thread messages from the OTHER side that arrived after `since`.
 * For a director: unseen leadership replies on their own schools' notes.
 * For an admin: unseen director replies across every school.
 */
export function countUnreadReplies(
  reports: DailyOpsReport[],
  opts: { isAdmin: boolean; sites: SiteId[]; since: string }
): number {
  let n = 0
  for (const r of reports) {
    if (!opts.isAdmin && !opts.sites.includes(r.siteId)) continue
    for (const c of r.noteComments ?? []) {
      const fromOtherSide = opts.isAdmin ? !isFromAdmin(c) : isFromAdmin(c)
      if (fromOtherSide && (!opts.since || c.at > opts.since)) n++
    }
  }
  return n
}
