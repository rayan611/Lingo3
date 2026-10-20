import { useState } from 'react'
import { saveSettings } from '../db/db'
import { parkWord } from '../db/later'
import { LANGS, type Lang } from '../db/langs'
import { activeTargets, type Settings } from '../db/types'
import {
  TRANSLATE_LANGS,
  TRANSLATE_MAX_CHARS,
  TRANSLATE_RTL,
  isTranslateLang,
} from '../db/translateLangs'
import { translate, type Translation } from '../ai/translate'
import { SpeakButton } from './SpeakButton'

const CODES = Object.keys(TRANSLATE_LANGS)
/** The interface name, without the "(Farsi)" the model is told. */
const label = (code: string) =>
  (TRANSLATE_LANGS as Record<string, string>)[code]?.replace(/ \(.*\)$/, '') ?? code
const studied = (code: string): code is Lang => (LANGS as string[]).includes(code)

/**
 * Quick translate: type in one language, see it in up to three others.
 *
 * Deliberately not tied to the languages you study — this is the "what is
 * this in…" tool. Its own choice of languages is account data, so it opens
 * the same way on every device. Anything you see can be parked for later with
 * one tap; adding it properly is the Add screen's job.
 */
export function Translate({ settings }: { settings: Settings }) {
  const from = isTranslateLang(settings.translateFrom)
    ? settings.translateFrom
    : settings.nativeLang
  const to: string[] = (
    settings.translateTo?.filter(isTranslateLang) ??
    activeTargets(settings).slice(0, 3)
  ).slice(0, 3)
  // Three slots, an empty one meaning "none".
  const slots: string[] = [to[0] ?? "", to[1] ?? "", to[2] ?? ""]

  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ source: Translation; rows: Translation[] } | null>(null)
  const [parked, setParked] = useState<Record<string, string>>({})

  function setFrom(code: string) {
    void saveSettings({ translateFrom: code, translateTo: to.filter((c) => c !== code) })
  }
  function setSlot(i: number, code: string) {
    const next: string[] = [...slots]
    next[i] = code
    const clean = [...new Set(next.filter((c) => c && c !== from))]
    void saveSettings({ translateTo: clean })
  }

  async function run(e?: React.FormEvent) {
    e?.preventDefault()
    const clean = text.trim()
    if (!clean || to.length === 0) return
    setBusy(true)
    setError(null)
    setParked({})
    try {
      const rows = await translate(clean, from, to)
      setResult({ source: { lang: from, text: clean }, rows })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function later(row: Translation) {
    const key = `${row.lang}:${row.text}`
    const added = await parkWord(row.text)
    setParked((p) => ({ ...p, [key]: added ? 'Saved for later' : 'Already on the list' }))
  }

  const card = (row: Translation, isSource = false) => {
    const key = `${row.lang}:${row.text}`
    return (
      <div key={key} className={`translate-row${isSource ? ' source' : ''}`}>
        <div className="translate-row-head">
          <span className="lang-chip">{label(row.lang)}</span>
          {studied(row.lang) && (
            <SpeakButton text={row.text} lang={row.lang} rate={settings.speechRate} />
          )}
        </div>
        <div
          className={`translate-text${TRANSLATE_RTL.has(row.lang) ? ' rtl' : ''}`}
          lang={row.lang}
        >
          {row.text}
        </div>
        {studied(row.lang) &&
          (parked[key] ? (
            <span className="muted small">{parked[key]}</span>
          ) : (
            <button type="button" className="link small" onClick={() => void later(row)}>
              + add later
            </button>
          ))}
      </div>
    )
  }

  return (
    <div className="stack">
      <form className="panel translate" onSubmit={run}>
        <h2>Quick translate</h2>
        <div className="translate-langs">
          <label className="field inline">
            <span className="muted small">From</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {CODES.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          </label>
          <span className="muted small">to</span>
          {slots.map((code, i) => (
            <select
              key={i}
              value={code}
              onChange={(e) => setSlot(i, e.target.value)}
              aria-label={`Target language ${i + 1}`}
            >
              <option value="">—</option>
              {CODES.filter((c) => c !== from).map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void run()
            }
          }}
          maxLength={TRANSLATE_MAX_CHARS}
          rows={2}
          placeholder={`Type in ${label(from)}`}
          lang={from}
          dir={TRANSLATE_RTL.has(from) ? 'rtl' : undefined}
        />
        <button className="primary" disabled={busy || !text.trim() || to.length === 0}>
          {busy ? 'Translating…' : 'Translate'}
        </button>
        {error && <p className="error-text small">{error}</p>}
        <p className="muted small">Translated by AI. Nothing you type here is saved.</p>
      </form>

      {result && (
        <div className="panel translate-results">
          {card(result.source, true)}
          {result.rows.map((row) => card(row))}
        </div>
      )}
    </div>
  )
}
