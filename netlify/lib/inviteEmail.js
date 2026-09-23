// netlify/lib/inviteEmail.js
// The branded "you're invited" email sent by invite-user. Pure function — no
// I/O — so it can be previewed locally (scripts/previewInviteEmail.mjs) and the
// copy edited here without touching the function.
//
// WHERE TO EDIT THE COPY: the ROLE_LINES map and the body text in buildInviteEmail.
// Email-client-safe HTML only: tables + inline styles, no <style> blocks, no web
// fonts (falls back to Arial), images by absolute URL.

const SITE_NAMES = { crozet: 'Crozet', 'forest-lakes': 'Forest Lakes', 'mill-creek': 'Mill Creek' }

const C = {
  coral: '#F08782',
  coralDark: '#C45E59',
  coralSoft: '#FAE8E7',
  charcoal: '#545454',
  gray: '#8A8A8A',
  cream: '#FAFAF5',
  border: '#ECE9E1',
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** "Crozet", "Crozet and Mill Creek", "Crozet, Forest Lakes, and Mill Creek" */
function joinSites(siteIds) {
  const names = (siteIds || []).map((id) => SITE_NAMES[id] || id)
  if (names.length <= 1) return names[0] || ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/** What they'll be doing, in one or two sentences, per role. */
const ROLE_LINES = {
  director: (sites) =>
    `You'll be filing the Director Daily Report for ${sites}. It takes a few minutes at the end of the day, and it's how the whole team stays close to what's happening at each school.`,
  co_director: (sites) =>
    `You'll be filing the Co-Director Daily Report for ${sites}: communication, enrollment, hiring, and how the building closed up for the day.`,
  admin: () =>
    `You'll have access to every report and the live dashboard across all three schools.`,
  finance: () => `You'll be filing the Finance Daily Report.`,
  admissions: () => `You'll be filing the Admissions Daily Report.`,
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || ''

/**
 * @param {object} o
 * @param {string} o.name        invitee's name ('' → "Hi there")
 * @param {string} o.role        admin | director | co_director | finance | admissions
 * @param {string[]} o.siteIds
 * @param {string} o.inviterName who sent it ('' → "The Bright Beginnings team")
 * @param {string} o.note        optional personal note from the inviter
 * @param {string} o.link        Firebase set-password link
 * @param {string} o.appUrl      e.g. https://bbdor.netlify.app
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildInviteEmail({ name, role, siteIds, inviterName, note, link, appUrl }) {
  const first = firstName(name)
  const inviter = String(inviterName || '').trim()
  const inviterFirst = firstName(inviter)
  const roleLine = (ROLE_LINES[role] || ROLE_LINES.admin)(joinSites(siteIds))
  const noteText = String(note || '').trim()
  const appHost = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const greeting = first ? `Hi ${first},` : 'Hi there,'
  const intro = inviter
    ? `${inviter} has set you up with an account on the Bright Beginnings Daily Ops Report, the app our team uses to share how each day went.`
    : `You've been set up with an account on the Bright Beginnings Daily Ops Report, the app our team uses to share how each day went.`
  const subject = inviterFirst
    ? `${inviterFirst} invited you to the BB Daily Ops Report`
    : `You're invited to the BB Daily Ops Report`

  // ---------- plain text ----------
  const text = [
    greeting,
    '',
    intro,
    '',
    roleLine,
    ...(noteText ? ['', `A note from ${inviterFirst || 'us'}:`, noteText] : []),
    '',
    'First, set your password here:',
    link,
    '',
    `Then sign in any time at ${appHost}. It works great on your phone, and you can add it to your home screen.`,
    '',
    `This link expires after an hour. If it's run out, tap "Forgot password?" on the sign-in page for a fresh one.`,
    '',
    'Welcome aboard,',
    inviter || 'The Bright Beginnings team',
    'Bright Beginnings Preschool',
  ].join('\n')

  // ---------- html ----------
  const p = (html, extra = '') =>
    `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${C.charcoal};${extra}">${html}</p>`

  const noteBlock = noteText
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
        <tr><td style="background:${C.coralSoft};border-left:4px solid ${C.coral};border-radius:6px;padding:14px 18px;">
          <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:${C.coralDark};">A note from ${escapeHtml(inviterFirst || 'us')}</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${C.charcoal};white-space:pre-line;">${escapeHtml(noteText)}</p>
        </td></tr>
      </table>`
    : ''

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;">Set your password and you're ready to go.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td align="center" style="padding:0 0 24px;">
        <img src="${appUrl}/brand/bb-logo-full.png" width="200" alt="Bright Beginnings" style="display:block;width:200px;max-width:60%;height:auto;border:0;">
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid ${C.border};border-top:5px solid ${C.coral};border-radius:12px;padding:36px 36px 28px;">
        ${p(escapeHtml(greeting), 'font-size:20px;font-weight:bold;')}
        ${p(escapeHtml(intro))}
        ${p(escapeHtml(roleLine))}
        ${noteBlock}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
          <tr><td style="border-radius:8px;background:${C.coralDark};">
            <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:8px;">Set your password</a>
          </td></tr>
        </table>
        ${p(`Then sign in any time at <a href="${appUrl}" style="color:${C.coralDark};font-weight:bold;text-decoration:none;">${escapeHtml(appHost)}</a>. It works great on your phone, and you can add it to your home screen.`)}
        ${p(`Welcome aboard,<br><strong>${escapeHtml(inviter || 'The Bright Beginnings team')}</strong><br><span style="color:${C.gray};">Bright Beginnings Preschool</span>`, 'margin:24px 0 0;')}
      </td></tr>
      <tr><td align="center" style="padding:20px 24px 0;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${C.gray};">The button works for one hour. If it's run out, tap “Forgot password?” on the sign-in page for a fresh one.${inviter ? ' Questions? Just reply to this email.' : ''}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  return { subject, html, text }
}
