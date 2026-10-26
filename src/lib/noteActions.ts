// src/lib/noteActions.ts
// "Do the thing, then tell the right person": posting a Day Notes comment and
// completing a Buy/Fix request. The write comes first and is what the caller
// awaits; the notification is best-effort (see notifications.ts).

import { addNoteComment, setRequestDone, type RequestItem } from './reports'
import { addOrgNoteComment, setOrgRequestDone } from './orgReports'
import { notify } from './notifications'
import { commentRecipients, ddrNoteOwners, preview, requestOwners, type ThreadAuthor } from './notifyRules'
import { reportMeta } from './reportRegistry'
import type { DailyOpsReport, LedgerNote, NoteComment, SiteId } from './schema'
import type { UserProfile } from './users'

interface Who { uid: string; name: string; role: 'admin' | 'director' }

/** A comment on a DDR note: saves it, then notifies the person being replied to. */
export async function postDdrComment(a: {
  report: { id: string; siteId: SiteId; date: string; createdByUid?: string }
  line: string
  text: string
  by: Who
  /** Earlier messages on THIS note, oldest first. */
  thread: NoteComment[]
  users: UserProfile[]
}): Promise<void> {
  const comment: NoteComment = {
    note: a.line, text: a.text, author: a.by.name, authorUid: a.by.uid, at: new Date().toISOString(), role: a.by.role,
  }
  await addNoteComment(a.report.id, [], comment)
  const to = commentRecipients({
    commenter: { uid: a.by.uid, role: a.by.role },
    owners: ddrNoteOwners(a.report, a.users),
    thread: a.thread as ThreadAuthor[],
    users: a.users,
    legacyRole: 'admin',
  })
  void notify(to.map((r) => ({
    toUid: r.uid, fromUid: a.by.uid, fromName: a.by.name, kind: r.kind,
    text: preview(a.text), about: preview(a.line, 70), to: `/report?site=${a.report.siteId}&date=${a.report.date}`,
  })))
}

/** A comment on an org-report note (ADR/CDR/FDR ledger). */
export async function postOrgComment(a: { note: LedgerNote; text: string; by: Who; users: UserProfile[] }): Promise<void> {
  await addOrgNoteComment(a.note.id, [], {
    text: a.text, author: a.by.name, authorUid: a.by.uid, role: a.by.role, at: new Date().toISOString(),
  })
  const to = commentRecipients({
    commenter: { uid: a.by.uid, role: a.by.role },
    owners: a.note.authorUid ? [a.note.authorUid] : [],
    thread: a.note.comments as ThreadAuthor[],
    users: a.users,
  })
  void notify(to.map((r) => ({
    toUid: r.uid, fromUid: a.by.uid, fromName: a.by.name, kind: r.kind,
    text: preview(a.text), about: preview(a.note.text, 70), to: reportMeta(a.note.source)?.route ?? '/day-notes',
  })))
}

/** Check a Buy/Fix request off with an optional "what was bought / how it was
 *  fixed" note. The note is saved with the item (it shows in the Completed log)
 *  and sent to whoever made the request. */
export async function completeRequest(a: {
  item: RequestItem
  text: string
  by: Who
  reports: DailyOpsReport[]
  orgNotes: LedgerNote[]
  users: UserProfile[]
}): Promise<void> {
  const { item } = a
  const info = { doneNote: a.text, doneBy: a.by.name, doneByUid: a.by.uid }
  if (item.kind === 'ddr') await setRequestDone(item.reportId!, item.tags, item.note, item.list, true, info)
  else await setOrgRequestDone(item.noteId!, item.requests, item.list, true, info)

  const report = item.kind === 'ddr' ? a.reports.find((r) => r.id === item.reportId) : undefined
  const orgNote = item.kind === 'org' ? a.orgNotes.find((n) => n.id === item.noteId) : undefined
  const owners = requestOwners(item, { report, noteAuthorUid: orgNote?.authorUid }, a.users)
  const to = report ? `/report?site=${report.siteId}&date=${report.date}` : orgNote ? reportMeta(orgNote.source)?.route ?? '/dashboard' : '/dashboard'
  void notify(owners.map((uid) => ({
    toUid: uid, fromUid: a.by.uid, fromName: a.by.name, kind: 'request_done' as const,
    text: preview(a.text.trim()), about: preview(item.note, 70), to,
  })))
}
