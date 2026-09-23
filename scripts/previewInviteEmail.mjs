// scripts/previewInviteEmail.mjs
// Renders the branded invite email to an HTML file so the copy/design can be
// checked in a browser without sending anything. Edit netlify/lib/inviteEmail.js,
// then:   node scripts/previewInviteEmail.mjs [out.html]

import { writeFileSync } from 'node:fs'
import { buildInviteEmail } from '../netlify/lib/inviteEmail.js'

const out = process.argv[2] || 'invite-email-preview.html'
const { subject, html } = buildInviteEmail({
  name: 'Hannah Wirt',
  role: 'director',
  siteIds: ['crozet'],
  inviterName: 'Rob Hichens',
  note: "So glad you're joining us! Reach out any time if you get stuck.",
  link: 'https://bbdor.netlify.app/login',
  appUrl: 'https://bbdor.netlify.app',
})
writeFileSync(out, html)
console.log(`Subject: ${subject}\nWrote ${out}`)
