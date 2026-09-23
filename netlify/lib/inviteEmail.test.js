import { describe, expect, it } from 'vitest'
import { buildInviteEmail } from './inviteEmail.js'

const base = {
  name: 'Hannah Wirt',
  role: 'director',
  siteIds: ['crozet', 'mill-creek'],
  inviterName: 'Rob Hichens',
  note: '',
  link: 'https://example.com/reset?oobCode=abc&mode=resetPassword',
  appUrl: 'https://bbdor.netlify.app',
}

describe('buildInviteEmail', () => {
  it('greets by first name, names the inviter, and lists campuses', () => {
    const { subject, html, text } = buildInviteEmail(base)
    expect(subject).toBe('Rob invited you to the BB Daily Ops Report')
    expect(text).toContain('Hi Hannah,')
    expect(text).toContain('Rob Hichens has set you up')
    expect(text).toContain('Director Daily Report for Crozet and Mill Creek')
    expect(html).toContain('href="https://example.com/reset?oobCode=abc&amp;mode=resetPassword"')
  })

  it('falls back gracefully with no name or inviter', () => {
    const { subject, text } = buildInviteEmail({ ...base, name: '', inviterName: '' })
    expect(subject).toBe("You're invited to the BB Daily Ops Report")
    expect(text).toContain('Hi there,')
    expect(text).toContain('The Bright Beginnings team')
  })

  it('writes role-specific copy for scoped roles', () => {
    expect(buildInviteEmail({ ...base, role: 'co_director', siteIds: ['forest-lakes'] }).text)
      .toContain('Co-Director Daily Report for Forest Lakes')
    expect(buildInviteEmail({ ...base, role: 'finance', siteIds: [] }).text).toContain('Finance Daily Report')
    expect(buildInviteEmail({ ...base, role: 'admissions', siteIds: [] }).text).toContain('Admissions Daily Report')
  })

  it('shows the personal note only when given, HTML-escaped', () => {
    expect(buildInviteEmail(base).html).not.toContain('A note from')
    const { html } = buildInviteEmail({ ...base, note: 'See you <b>Monday</b> & welcome!' })
    expect(html).toContain('A note from Rob')
    expect(html).toContain('See you &lt;b&gt;Monday&lt;/b&gt; &amp; welcome!')
  })
})
