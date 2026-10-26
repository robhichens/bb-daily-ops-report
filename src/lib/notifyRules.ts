// src/lib/notifyRules.ts
// Who gets told when someone comments on a note (Rob, 2026-10-27: "only the
// person being replied to"):
//   • an ADMIN comments → the person who posted the note;
//   • the POSTER replies → the admin(s) who commented in that thread.
// Everyone can still read the whole thread on the note; this is only who gets a
// bell notification. Pure functions so the routing is easy to test.

import type { UserProfile } from './users'

type UserRef = Pick<UserProfile, 'uid' | 'displayName' | 'role' | 'siteIds' | 'siteId'>

/** A message already in a thread (DDR comment or org-note comment). */
export interface ThreadAuthor {
  author: string
  authorUid?: string
  role?: 'admin' | 'director'
}

export type CommentNoticeKind = 'comment' | 'reply'

/** A message's author as a uid: the stored uid, else the user whose display name matches
 *  (older messages only saved a name). */
export function uidOf(c: { author: string; authorUid?: string }, users: Pick<UserRef, 'uid' | 'displayName'>[]): string | undefined {
  if (c.authorUid) return c.authorUid
  const name = c.author.trim().toLowerCase()
  if (!name) return undefined
  const hit = users.filter((u) => (u.displayName ?? '').trim().toLowerCase() === name)
  return hit.length === 1 ? hit[0].uid : undefined // ambiguous names are not guessed
}

/** The people who posted a DDR note: whoever created that day's report plus the
 *  school's directors (a school can have more than one). */
export function ddrNoteOwners(report: { siteId: string; createdByUid?: string }, users: UserRef[]): string[] {
  const owners = new Set<string>()
  if (report.createdByUid) owners.add(report.createdByUid)
  for (const u of users) {
    if (u.role !== 'director') continue
    const sites = u.siteIds?.length ? u.siteIds : u.siteId ? [u.siteId] : []
    if (sites.includes(report.siteId as never)) owners.add(u.uid)
  }
  return [...owners]
}

export function commentRecipients(args: {
  commenter: { uid: string; role: 'admin' | 'director' }
  /** uids of the people who posted the note. */
  owners: string[]
  /** Messages already in the thread, oldest first (not including this one). */
  thread: ThreadAuthor[]
  users: Pick<UserRef, 'uid' | 'displayName'>[]
  /** Role assumed for messages saved before roles existed (DDR threads: 'admin'). */
  legacyRole?: 'admin' | 'director'
}): { uid: string; kind: CommentNoticeKind }[] {
  const { commenter, owners, thread, users, legacyRole } = args
  let uids: string[]
  let kind: CommentNoticeKind
  if (commenter.role === 'admin') {
    uids = owners
    kind = 'comment'
  } else {
    uids = thread
      .filter((m) => (m.role ?? legacyRole) === 'admin')
      .map((m) => uidOf(m, users))
      .filter((u): u is string => !!u)
    kind = 'reply'
  }
  return [...new Set(uids)].filter((u) => u !== commenter.uid).map((uid) => ({ uid, kind }))
}

/** Who made a Buy/Fix request, for the "it's done" notification. */
export function requestOwners(item: { kind: 'ddr' | 'org' }, ctx: { report?: { siteId: string; createdByUid?: string }; noteAuthorUid?: string }, users: UserRef[]): string[] {
  if (item.kind === 'org') return ctx.noteAuthorUid ? [ctx.noteAuthorUid] : []
  return ctx.report ? ddrNoteOwners(ctx.report, users) : []
}

/** One line of a message for the bell ("…" when long). */
export function preview(text: string, max = 110): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}
