// src/lib/dayNotesRead.ts
// Tracks when a user last opened Day Notes so we can nudge them about replies
// they haven't seen. Read-state is per-device (localStorage): directors can't
// write their own users/{uid} doc under firestore.rules, and a nudge doesn't
// need to be perfectly cross-device. Keyed by uid so a shared browser doesn't
// bleed one account's "seen" into another's.

import type { DailyOpsReport, NoteComment, SiteId } from './schema'

const keyFor = (uid: string) => `bbdor:dayNotesSeen:${uid}`

/** ISO timestamp the user last opened Day Notes ('' if never). */
export function getDayNotesSeen(uid: string): string {
  if (!uid) return ''
  try {
    return localStorage.getItem(keyFor(uid)) ?? ''
  } catch {
    return ''
  }
}

/** Mark Day Notes as read now, and notify any listening nav badge. */
export function markDayNotesSeen(uid: string): void {
  if (!uid) return
  try {
    localStorage.setItem(keyFor(uid), new Date().toISOString())
    window.dispatchEvent(new Event('daynotes-seen'))
  } catch {
    /* ignore private-mode / storage failures — the nudge is best-effort */
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
