import { describe, expect, it } from 'vitest'
import { commentRecipients, ddrNoteOwners, preview, uidOf, type ThreadAuthor } from './notifyRules'

const users = [
  { uid: 'laura', displayName: 'Laura Baker', role: 'director' as const, siteIds: ['mill-creek' as const] },
  { uid: 'jess', displayName: 'Jess Rybak', role: 'director' as const, siteIds: ['forest-lakes' as const] },
  { uid: 'rob', displayName: 'Rob Hichens', role: 'admin' as const },
  { uid: 'katlin', displayName: 'Katlin Gordon', role: 'admin' as const },
]

describe('ddrNoteOwners', () => {
  it('is the report’s creator plus the school’s directors (not other schools’)', () => {
    expect(ddrNoteOwners({ siteId: 'mill-creek', createdByUid: 'laura' }, users)).toEqual(['laura'])
    expect(ddrNoteOwners({ siteId: 'mill-creek' }, users)).toEqual(['laura'])
    expect(ddrNoteOwners({ siteId: 'forest-lakes', createdByUid: 'rob' }, users).sort()).toEqual(['jess', 'rob'])
  })
})

describe('commentRecipients — only the person being replied to', () => {
  const owners = ['laura']

  it('an admin comment goes to the person who posted the note (not to other admins)', () => {
    const r = commentRecipients({ commenter: { uid: 'rob', role: 'admin' }, owners, thread: [], users })
    expect(r).toEqual([{ uid: 'laura', kind: 'comment' }])
  })

  it('the poster’s reply goes to the admin who commented — and only admins who commented', () => {
    const thread: ThreadAuthor[] = [
      { author: 'Rob Hichens', authorUid: 'rob', role: 'admin' },
      { author: 'Katlin Gordon', role: 'admin' }, // older message: no uid, found by name
      { author: 'Laura Baker', authorUid: 'laura', role: 'director' },
    ]
    const r = commentRecipients({ commenter: { uid: 'laura', role: 'director' }, owners, thread, users })
    expect(r.map((x) => x.uid).sort()).toEqual(['katlin', 'rob'])
    expect(r.every((x) => x.kind === 'reply')).toBe(true)
  })

  it('never notifies yourself, and nobody when no admin has commented yet', () => {
    expect(commentRecipients({ commenter: { uid: 'laura', role: 'admin' }, owners: ['laura'], thread: [], users })).toEqual([])
    expect(commentRecipients({ commenter: { uid: 'laura', role: 'director' }, owners, thread: [], users })).toEqual([])
  })

  it('treats old DDR messages with no role as leadership (legacyRole)', () => {
    const thread: ThreadAuthor[] = [{ author: 'Rob Hichens' }]
    expect(commentRecipients({ commenter: { uid: 'laura', role: 'director' }, owners, thread, users, legacyRole: 'admin' }).map((x) => x.uid)).toEqual(['rob'])
    expect(commentRecipients({ commenter: { uid: 'laura', role: 'director' }, owners, thread, users })).toEqual([])
  })
})

describe('helpers', () => {
  it('uidOf never guesses between two people with the same name', () => {
    const dup = [...users, { uid: 'rob2', displayName: 'Rob Hichens', role: 'director' as const }]
    expect(uidOf({ author: 'Rob Hichens' }, dup)).toBeUndefined()
    expect(uidOf({ author: 'Rob Hichens', authorUid: 'rob' }, dup)).toBe('rob')
  })
  it('preview trims long text with an ellipsis', () => {
    expect(preview('  hello   world ')).toBe('hello world')
    expect(preview('x'.repeat(200), 20)).toHaveLength(20)
    expect(preview('x'.repeat(200), 20).endsWith('…')).toBe(true)
  })
})
