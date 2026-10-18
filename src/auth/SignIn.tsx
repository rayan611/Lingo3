import { useState } from 'react'
import {
  consumeAuthLinkError,
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
} from './useSession'
import { PasswordField } from './PasswordField'

type Mode = 'in' | 'up' | 'forgot'

export function SignIn() {
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // Read once, on the first render after landing: if a reset link brought
  // them here and failed, that is the first thing they need to know.
  const [error, setError] = useState<string | null>(() => consumeAuthLinkError())
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email.trim())
        // Deliberately the same answer whether or not that address has an
        // account. "No such user" would turn this box into a way of finding
        // out who has one.
        setNotice(
          'If that address has an account, a reset link is on its way. It is good for one hour — check spam if it does not arrive.',
        )
      } else if (mode === 'in') {
        await signIn(email.trim(), password)
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password)
        if (needsConfirmation) {
          setNotice(
            'Account created. Check your email for a confirmation link, then sign in.',
          )
          setMode('in')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="signin">
        <header className="signin-intro">
          <h1 className="signin-brand">Lingo3</h1>
          <p className="signin-tagline">
            A place to make your own learning material and study up to three
            languages at once.
          </p>
          <p className="signin-blurb">
            Add a word once in your own language. It comes back with the meaning,
            gender and verb forms in every language you are learning, side by
            side, and then returns for review exactly when you are about to
            forget it.
          </p>
          <ul className="signin-points">
            <li>
              <strong>Three languages, one card.</strong> Each language is
              scheduled on its own, so the one you find hard does not drag the
              easy ones with it.
            </li>
            <li>
              <strong>Works offline.</strong> Reviewing never needs a
              connection — only adding new words does.
            </li>
            <li>
              <strong>Your words, everywhere.</strong> Add on your computer,
              review on your phone.
            </li>
          </ul>
        </header>

        <form className="panel" onSubmit={submit}>
          <h2>
            {mode === 'in'
              ? 'Sign in'
              : mode === 'up'
                ? 'Create an account'
                : 'Reset your password'}
          </h2>

          {mode === 'forgot' && (
            <p className="muted small">
              Give the address you signed up with and we will send a link that
              lets you set a new password.
            </p>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              disabled={busy}
            />
          </label>

          {/* No password field when resetting: asking for the thing you have
              just said you cannot remember is the classic version of this
              form, and it is nonsense. */}
          {mode !== 'forgot' && (
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              minLength={6}
              disabled={busy}
            />
          )}

          {mode === 'in' && (
            <div className="signin-forgot">
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode('forgot')
                  setError(null)
                  setNotice(null)
                }}
              >
                Forgot your password?
              </button>
            </div>
          )}

          <button className="primary big" type="submit" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'in'
                ? 'Sign in'
                : mode === 'up'
                  ? 'Create account'
                  : 'Send reset link'}
          </button>

          {/* Not offered while resetting a password: the whole point of that
              screen is an account that has one, and Google accounts do not. */}
          {mode !== 'forgot' && (
            <>
              <div className="signin-or">
                <span>or</span>
              </div>
              <button
                type="button"
                className="big google"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setNotice(null)
                  // No `busy` reset on success: the page is leaving.
                  signInWithGoogle().catch((err) => {
                    setBusy(false)
                    setError(err instanceof Error ? err.message : String(err))
                  })
                  setBusy(true)
                }}
              >
                <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {error && <div className="status error">{error}</div>}
          {notice && <div className="status ok">{notice}</div>}

          <div className="signin-switch">
            {mode === 'in' && (
              <button type="button" className="link" onClick={() => setMode('up')}>
                No account yet? Create one
              </button>
            )}
            {mode === 'up' && (
              <button type="button" className="link" onClick={() => setMode('in')}>
                Already have an account? Sign in
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode('in')
                  setError(null)
                  setNotice(null)
                }}
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
