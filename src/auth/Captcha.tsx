import { useEffect, useRef, useState } from 'react'

/**
 * Cloudflare Turnstile, in front of every call Supabase Auth checks a CAPTCHA
 * on: sign-in, sign-up, password reset — and the password check before an
 * account is deleted, which is a sign-in underneath.
 *
 * Off until VITE_TURNSTILE_SITE_KEY is set at build time. That ordering is the
 * point: this code ships first, and only once a build carrying the key is live
 * is CAPTCHA protection switched on in the Supabase dashboard. The other way
 * round, every sign-in fails until the deploy lands.
 *
 * Google sign-in does not go through here; Supabase does not ask OAuth for a
 * token, and Google runs checks of its own.
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {}
const SITE_KEY = env.VITE_TURNSTILE_SITE_KEY

export const captchaEnabled = Boolean(SITE_KEY)

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface Turnstile {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let loading: Promise<Turnstile> | null = null

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('CAPTCHA did not load.'))
    script.onerror = () => {
      loading = null
      reject(new Error('Could not load the CAPTCHA. Check your connection and try again.'))
    }
    document.head.append(script)
  })
  return loading
}

/**
 * Renders the widget and reports each token, or null when one expires or
 * fails. Tokens are single-use: bump `resetKey` after every attempt that sent
 * one, or the next attempt is refused.
 */
export function Captcha({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string | null) => void
  resetKey?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  // The latest callback, without re-rendering the widget whenever it changes.
  const report = useRef(onToken)
  report.current = onToken
  // Without this a blocked script left the form saying "Checking you are
  // human…" forever, with nothing to say why or what to do.
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    setFailed(null)
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !box.current) return
        widget.current = turnstile.render(box.current, {
          sitekey: SITE_KEY,
          // Follows the app's own light/dark choice via the media query.
          theme: 'auto',
          size: 'flexible',
          callback: (token: string) => report.current(token),
          'expired-callback': () => report.current(null),
          'error-callback': () => {
            report.current(null)
            setFailed('The human check failed.')
          },
        })
      })
      .catch((err: unknown) => {
        report.current(null)
        if (!cancelled) setFailed(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [attempt])

  useEffect(() => {
    if (resetKey === 0 || !widget.current) return
    report.current(null)
    window.turnstile?.reset(widget.current)
  }, [resetKey])

  if (!SITE_KEY) return null
  return (
    <>
      <div className="captcha" ref={box} />
      {failed && (
        <p className="error-text small">
          {failed}{' '}
          <button type="button" className="link" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}
    </>
  )
}
