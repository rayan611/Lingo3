import { useState } from 'react'
import { signOut, updatePassword } from './useSession'
import { PasswordField } from './PasswordField'

/**
 * Set a new password, after arriving on a reset link.
 *
 * This screen is the half of "forgot password" that is easy to leave out. A
 * Supabase recovery link signs you in — so without this the app simply opens,
 * the person never gets to choose a password, and the next time they are
 * signed out they are exactly as locked out as before.
 *
 * It stands in front of the app rather than sitting in Settings, because
 * someone who has just clicked a reset link is here to do one thing.
 */
const MIN = 8

export function ResetPassword({
  email,
  onDone,
}: {
  email: string | null
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = password.length > 0 && password.length < MIN
  const mismatch = again.length > 0 && again !== password
  const ready = password.length >= MIN && again === password

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !ready) return
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="signin">
        <form className="panel" onSubmit={submit}>
          <h2>Choose a new password</h2>
          <p className="muted small">
            {email
              ? `You are setting the password for ${email}.`
              : 'You followed a reset link, so you can set a new password now.'}
          </p>

          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={MIN}
            disabled={busy}
            autoFocus
          >
            <span className="muted small">
              {tooShort
                ? `At least ${MIN} characters.`
                : `${MIN} characters or more. A phrase you will remember beats a short one you will not.`}
            </span>
          </PasswordField>

          <PasswordField
            label="Type it again"
            value={again}
            onChange={setAgain}
            autoComplete="new-password"
            disabled={busy}
          >
            {mismatch && (
              <span className="muted small error-text">
                These two do not match yet.
              </span>
            )}
          </PasswordField>

          <button className="primary big" type="submit" disabled={busy || !ready}>
            {busy ? 'Saving…' : 'Save password and continue'}
          </button>

          {error && <div className="status error">{error}</div>}

          <div className="signin-switch">
            <button
              type="button"
              className="link"
              disabled={busy}
              onClick={() => {
                // Sign out rather than just dismissing: the link signed them
                // in, and someone who backs out of setting a password has not
                // asked to be left logged in on this device.
                void signOut()
                onDone()
              }}
            >
              Not now — sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
