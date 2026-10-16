import { useState } from 'react'

/**
 * A password box with a show/hide button inside it.
 *
 * One component rather than the same markup three times: sign in, create an
 * account and the two boxes on the reset screen all want it, and a toggle that
 * behaves differently on the reset screen than on the sign-in screen is a
 * small bug waiting to be written.
 *
 * The button is `type="button"` — inside a form, a button without that submits
 * it, which here would mean trying to sign in every time you looked at what
 * you had typed.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  disabled,
  autoFocus,
  children,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  autoComplete: string
  minLength?: number
  disabled?: boolean
  autoFocus?: boolean
  /** Help or error text shown under the box. */
  children?: React.ReactNode
}) {
  const [shown, setShown] = useState(false)

  return (
    <label className="field">
      <span>{label}</span>
      <span className="password-box">
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className="password-reveal"
          onClick={() => setShown((s) => !s)}
          disabled={disabled}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          title={shown ? 'Hide password' : 'Show password'}
        >
          <EyeIcon off={shown} />
        </button>
      </span>
      {children}
    </label>
  )
}

/**
 * An eye, struck through once the password is visible. Struck through means
 * "press this to hide", which is what the button does in that state — the
 * icon shows the action, not the status.
 */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 20 20 4" />}
    </svg>
  )
}
