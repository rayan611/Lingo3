import { useState } from 'react'
import { authConfigured, supabase } from '../auth/supabase'

type ProviderStatus =
  | { provider: string; configured: false }
  | {
      provider: string
      configured: true
      position: number
      model: string
      ok: boolean
      ms: number
      sample?: string
      error?: string
    }

const NAMES: Record<string, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  anthropic: 'Claude',
}

/**
 * Is each AI actually answering? Part of the admin panel.
 *
 * The fallback only ever reaches a backup when the first provider fails, so
 * on a good day nothing shows whether Groq or Claude would work when needed.
 * This asks each of them directly — one real translation apiece, through the
 * same code the app uses — and shows who answered, how fast and with what.
 * Nothing runs until the button is pressed: each press is a few model calls.
 */
export function AiStatus() {
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ProviderStatus[] | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    setBusy(true)
    setError(null)
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (authConfigured) {
        const { data } = await supabase().auth.getSession()
        const token = data.session?.access_token
        if (token) headers.authorization = `Bearer ${token}`
      }
      const res = await fetch('/api/ai-status', { method: 'POST', headers, body: '{}' })
      const body = (await res.json().catch(() => ({}))) as {
        providers?: ProviderStatus[]
        checkedAt?: string
        error?: string
      }
      if (!res.ok || !body.providers) {
        throw new Error(body.error ?? `The check failed (HTTP ${res.status}).`)
      }
      setRows(body.providers)
      setCheckedAt(body.checkedAt ?? new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ai-status">
      <h3>AI status</h3>
      <p className="muted small">
        Sends “Good morning” to each AI that has a key and asks for Swedish —
        each on its own, without the fallback, so a backup is tested even on a
        day the first one is fine.
      </p>
      <button type="button" className="inspect" disabled={busy} onClick={() => void check()}>
        {busy ? 'Checking…' : rows ? 'Check again' : 'Check the AIs'}
      </button>

      {error && <p className="error-text small">{error}</p>}

      {rows && (
        <ul className="ai-status-list">
          {rows.map((r) => (
            <li
              key={r.provider}
              className={!r.configured ? 'is-none' : r.ok ? 'is-ok' : 'is-bad'}
            >
              <div className="ai-status-head">
                <span className="ai-status-dot" aria-hidden="true" />
                <strong>{NAMES[r.provider] ?? r.provider}</strong>
                {r.configured ? (
                  <span className="muted small">
                    {r.position === 1 ? 'asked first' : `backup ${r.position - 1}`} · {r.model}
                  </span>
                ) : (
                  <span className="muted small">no key — not used</span>
                )}
                {r.configured && <span className="ai-status-ms">{(r.ms / 1000).toFixed(1)} s</span>}
              </div>
              {r.configured && r.ok && (
                <p className="small">Works — answered “{r.sample}”.</p>
              )}
              {r.configured && !r.ok && <p className="small error-text">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
      {checkedAt && (
        <p className="muted small">Checked {new Date(checkedAt).toLocaleTimeString()}.</p>
      )}
    </div>
  )
}
