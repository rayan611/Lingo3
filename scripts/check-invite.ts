/**
 * Settings → Invite others: the personal link and the share addresses.
 *
 * The name in the link is shown back on the front page, so this is where it
 * is checked that markup cannot survive the trip and a broken escape does not
 * throw.
 *
 * Run with: npx tsx scripts/check-invite.ts
 */
import assert from 'node:assert/strict'
import { fillInvite, inviteLink, inviteSlug, inviterFromPath, shareTargets } from '../src/lib/invite'

assert.equal(inviteSlug('  Maryam Rayan '), 'Maryam-Rayan')
assert.equal(inviteSlug('<b>Ali</b>!'), 'bAlib')
assert.equal(inviteSlug('مریم'), 'مریم')
assert.equal(inviteLink('https://lingo3.com/', 'Maryam Rayan'), 'https://lingo3.com/invite/Maryam-Rayan')
assert.equal(inviteLink('https://lingo3.com', undefined), 'https://lingo3.com/')
assert.equal(inviterFromPath('/invite/Maryam-Rayan'), 'Maryam Rayan')
assert.equal(inviterFromPath('/invite/' + encodeURIComponent('مریم')), 'مریم')
assert.equal(inviterFromPath('/invite/%3Cscript%3E'), 'script')
assert.equal(inviterFromPath('/invite/%E0%A4%A'), '')
assert.equal(inviterFromPath('/privacy'), '')
assert.equal(fillInvite('Hi {name}: {link} {x}', { name: 'A', link: 'L' }), 'Hi A: L {x}')

const link = 'https://lingo3.com/invite/A'
const s = shareTargets(`Join me: ${link}`, link, 'S')
assert.equal(s.whatsapp, 'https://wa.me/?text=' + encodeURIComponent(`Join me: ${link}`))
assert.ok(s.telegram.endsWith('&text=' + encodeURIComponent('Join me:')))
assert.ok(s.email.startsWith('mailto:?subject=S&body='))
assert.ok(s.sms.startsWith('sms:?&body='))
assert.equal(s.facebook, 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link))

console.log('invite: ok')
