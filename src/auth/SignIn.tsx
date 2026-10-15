import { useState } from 'react'
import {
  consumeAuthLinkError,
  requestPasswordReset,
  signIn,
  signUp,
} from './useSession'

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
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                minLength={6}
                required
                disabled={busy}
              />
            </label>
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
