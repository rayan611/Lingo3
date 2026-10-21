import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { deleteAccount, verifyPassword } from '../auth/deleteAccount'
import { Captcha, captchaEnabled } from '../auth/Captcha'

/**
 * Deleting an account: required by both app stores, and the one control in
 * this app that destroys something unrecoverable.
 *
 * Three decisions shape it, all from the same principle — the cost of making
 * this slightly annoying is a few seconds, and the cost of making it easy is
 * someone's year of vocabulary.
 *
 *  1. It is NOT at hand. It lives behind a closed section at the very bottom
 *     of Settings, so it is never a thing you can hit while scrolling past.
 *  2. Two confirmations of DIFFERENT KINDS. Typing the word proves you read
 *     the warning; the password proves it is you, and not someone holding your
 *     unlocked phone. Two dialogs that both say "are you sure" are one
 *     confirmation asked twice.
 *  3. It states the real numbers. "Delete 45 words and 123 reviews" is a
 *     sentence you can refuse; "delete your data" is not.
 */
type Stage = 'closed' | 'typed' | 'password'

const CONFIRM_WORD = 'DELETE'

export function DeleteAccount({
  userId,
  email,
}: {
  userId: string
  email: string
}) {
  const [stage, setStage] = useState<Stage>('closed')
  const [typed, setTyped] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)

  /** What will actually be lost, counted rather than described. */
  const counts = useLiveQuery(async () => {
    const [words, reviews] = await Promise.all([
      db.concepts.filter((c) => !c.deletedAt).count(),
      db.reviewLog.count(),
    ])
    return { words, reviews }
  }, [])

  function reset() {
    setStage('closed')
    setTyped('')
    setPassword('')
    setError(null)
  }

  async function confirmPassword() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      // Checked before anything is deleted, so a wrong password costs nothing.
      await verifyPassword(email, password, captchaToken ?? undefined)
      await deleteAccount(userId)
      // A full reload rather than a state change: every live query, the open
      // Dexie handle and the session are all gone underneath this component,
      // and a reload is the one way to be sure nothing stale survives.
      window.location.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
      // The token was spent on that attempt.
      if (captchaEnabled) setCaptchaReset((n) => n + 1)
    }
  }

  return (
    <details className="panel account-danger">
      <summary>Account</summary>

      {stage === 'closed' && (
        <>
          <p className="muted small">
            Signed in as {email}. Deleting your account removes your words,
            your review history and your settings from the server and from this
            device. It cannot be undone, and there is no copy kept anywhere.
          </p>
          <p className="muted small">
            If you might want your vocabulary later, use Export above first —
            it is one file and it takes a second.
          </p>
          <button className="link danger" onClick={() => setStage('typed')}>
            Delete my account
          </button>
        </>
      )}

      {stage === 'typed' && (
        <>
          <p>
            This will permanently delete{' '}
            <strong>
              {counts ? `${counts.words} words and ${counts.reviews} reviews` : 'everything you have added'}
            </strong>
            , along with your settings and your sign-in. Nothing is recoverable
            afterwards.
          </p>
          <label className="field">
            <span>
              Type <strong>{CONFIRM_WORD}</strong> to continue
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="row">
            <button onClick={reset}>Cancel</button>
            <button
              className="danger"
              disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
              onClick={() => setStage('password')}
            >
              Continue
            </button>
          </div>
        </>
      )}

      {stage === 'password' && (
        <>
          <p>
            Last step. Enter your password to confirm it is you — this is the
            check that stops someone deleting your account from a phone you
            left unlocked.
          </p>
          <label className="field">
            <span>Password for {email}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          <Captcha onToken={setCaptchaToken} resetKey={captchaReset} />
          {error && <p className="error-text small">{error}</p>}
          <div className="row">
            <button onClick={reset} disabled={busy}>
              Cancel
            </button>
            <button
              className="danger"
              disabled={busy || password.length === 0 || (captchaEnabled && !captchaToken)}
              onClick={() => void confirmPassword()}
            >
              {busy ? 'Deleting…' : 'Delete my account permanently'}
            </button>
          </div>
        </>
      )}
    </details>
  )
}
