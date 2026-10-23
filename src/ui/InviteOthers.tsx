import { useState } from 'react'
import {
  INVITE_ORIGIN,
  INVITE_SUBJECT,
  INVITE_TEMPLATE,
  fillInvite,
  inviteLink,
  shareTargets,
  type ShareChannel,
} from '../lib/invite'

/** The person's own edit of the message. Device-local: it is a draft, not a setting. */
const DRAFT_KEY = 'lingua.inviteDraft'

function readDraft(): string | null {
  try {
    return window.localStorage.getItem(DRAFT_KEY)
  } catch {
    return null
  }
}

function writeDraft(value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(DRAFT_KEY)
    else window.localStorage.setItem(DRAFT_KEY, value)
  } catch {
    /* a draft is not worth an error */
  }
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const CHANNELS: { id: ShareChannel; label: string }[] = [
  { id: 'whatsapp', label: '💬 WhatsApp' },
  { id: 'telegram', label: '✈️ Telegram' },
  { id: 'sms', label: '📱 SMS' },
  { id: 'email', label: '✉️ Email' },
  { id: 'facebook', label: '📘 Facebook' },
]

/**
 * Settings → Invite others: a short note with the person's own link, which
 * they can edit and then send through the phone's share sheet, a messaging
 * app or email, or simply copy.
 */
export function InviteOthers({ name }: { name: string | undefined }) {
  const link = inviteLink(INVITE_ORIGIN, name)
  const signed = name?.trim() ?? ''
  const original = fillInvite(INVITE_TEMPLATE, { name: signed, link }).replace(/\n\n— $/, '')
  const subject = fillInvite(INVITE_SUBJECT, { name: signed || 'A friend' })
  const [text, setText] = useState(() => readDraft() ?? original)
  const [status, setStatus] = useState<string | null>(null)

  // An edit that dropped the link gets it back at the end, so an invitation is never sent without one.
  const message = () => {
    const v = text.trim() || original
    return v.includes(link) ? v : `${v}\n\n${link}`
  }

  async function copyAndSay(value: string, done = 'Copied.') {
    setStatus((await copy(value)) ? done : 'Could not copy — select the text and copy it by hand.')
  }

  async function send(channel: ShareChannel) {
    const url = shareTargets(message(), link, subject)[channel]
    if (channel === 'facebook') {
      await copyAndSay(message(), 'Message copied. Facebook only takes the link, so paste the words in yourself.')
    }
    if (channel === 'sms' || channel === 'email') window.location.href = url
    else window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="panel">
      <h2>Invite others</h2>
      <p className="muted small">
        Send a friend a short note with your personal link. You can change the
        words first.
      </p>
      {!signed && (
        <p className="muted small">
          Add your name under <strong>You</strong> above, so your friend knows
          the invite is from you.
        </p>
      )}

      <label className="field">
        <span>Your message</span>
        <textarea
          rows={7}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            writeDraft(e.target.value)
          }}
        />
      </label>
      <div className="row">
        <button
          className="link"
          onClick={() => {
            setText(original)
            writeDraft(null)
          }}
        >
          Use the original text
        </button>
      </div>

      <label className="field">
        <span>Your personal link</span>
        <input readOnly value={link} onFocus={(e) => e.target.select()} />
      </label>

      <div className="row">
        {typeof navigator.share === 'function' && (
          <button
            onClick={() => void navigator.share({ title: subject, text: message() }).catch(() => {})}
          >
            Share…
          </button>
        )}
        <button onClick={() => void copyAndSay(message())}>Copy message</button>
        <button onClick={() => void copyAndSay(link)}>Copy link</button>
      </div>
      <div className="row">
        {CHANNELS.map((c) => (
          <button key={c.id} onClick={() => void send(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      {status && (
        <p className="muted small" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  )
}
