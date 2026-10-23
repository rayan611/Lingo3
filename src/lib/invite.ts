/**
 * "Invite others": the personal link and the share addresses.
 *
 * The link carries the inviter's name — lingo3.com/invite/Maryam — so the
 * front page can greet the friend by it. Nothing is looked up: the name in the
 * link is only ever shown back as plain text, so a made-up name costs nothing
 * and reveals nothing.
 */

export const INVITE_ORIGIN = 'https://lingo3.com'

/** The default message. {name} is the inviter, {link} their personal link. */
export const INVITE_TEMPLATE =
  "Hi! 👋 I've been learning languages with Lingo3. You type one word and it comes back in every language you study, with the article, the forms and an example sentence, then it helps you remember it with smart reviews. It's free, works offline and I think you'd like it.\n\nHere's my personal invite: {link}\n\n— {name}"

export const INVITE_SUBJECT = '{name} invited you to Lingo3'
export const INVITE_WELCOME = '{name} invited you to Lingo3'

/** "Maryam Rayan" -> "Maryam-Rayan". Letters of any script, digits and dashes; at most 30 characters. */
export function inviteSlug(name: string | null | undefined): string {
  return String(name ?? '')
    .normalize('NFC')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{M}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
}

/** "/invite/Maryam-Rayan" -> "Maryam Rayan", or "" when the path is not an invite. */
export function inviterFromPath(path: string): string {
  const m = /^\/invite\/([^/?#]+)/.exec(path)
  if (!m) return ''
  let raw = m[1]
  try {
    raw = decodeURIComponent(raw)
  } catch {
    return ''
  }
  return inviteSlug(raw).replace(/-/g, ' ')
}

export function inviteLink(origin: string, name: string | null | undefined): string {
  const slug = inviteSlug(name)
  return origin.replace(/\/+$/, '') + (slug ? `/invite/${encodeURIComponent(slug)}` : '/')
}

export function fillInvite(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

export type ShareChannel = 'whatsapp' | 'telegram' | 'sms' | 'email' | 'facebook'

/**
 * One address per channel. `text` is the whole message and already contains
 * the link. Telegram and Facebook draw the link as a preview card, so they get
 * it separately; Facebook ignores any text it is handed.
 */
export function shareTargets(text: string, link: string, subject: string): Record<ShareChannel, string> {
  const e = encodeURIComponent
  const rest = text.split(link).join('').trim()
  return {
    whatsapp: `https://wa.me/?text=${e(text)}`,
    telegram: `https://t.me/share/url?url=${e(link)}&text=${e(rest)}`,
    sms: `sms:?&body=${e(text)}`,
    email: `mailto:?subject=${e(subject)}&body=${e(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${e(link)}`,
  }
}
