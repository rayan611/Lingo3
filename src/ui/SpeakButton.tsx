import { useEffect, useState } from 'react'
import { canSpeak, speak, stopSpeaking } from '../lib/speak'
import type { Lang } from '../db/types'

/**
 * A speaker beside a word or a sentence.
 *
 * It renders nothing at all when the device cannot speak that language and is
 * offline (so the fallback audio cannot be fetched either), rather than
 * showing a button that does nothing when tapped — a dead control is worse
 * than an absent one.
 *
 * One size and one look everywhere it appears: the same action in a smaller
 * place is still the same action, and a quieter copy of it read as a second,
 * different control.
 */
export function SpeakButton({
  text,
  lang,
  label,
  rate,
}: {
  text: string
  lang: Lang
  label?: string
  /** The speaking rate from Settings; the module's own default when absent. */
  rate?: number
}) {
  const [speaking, setSpeaking] = useState(false)

  // Anything still speaking when this leaves the screen — the next card, a
  // closed text — stops with it.
  useEffect(() => () => stopSpeaking(), [])

  if (!text.trim() || !canSpeak(lang)) return null

  function go() {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    speak(text, lang, { rate })
    setSpeaking(true)
    // speechSynthesis fires `end` on the utterance, but not reliably when it
    // is cancelled mid-sentence on some browsers, so the button also clears
    // itself on a timer proportional to the text.
    const ms = Math.min(20000, 1200 + text.length * 70)
    window.setTimeout(() => setSpeaking(false), ms)
  }

  return (
    <button
      type="button"
      className={`speak ${speaking ? 'speaking' : ''}`}
      onClick={go}
      title={label ?? 'Listen'}
      aria-label={speaking ? 'Stop speaking' : label ?? 'Listen'}
      aria-pressed={speaking}
    >
      <svg
        viewBox="0 0 24 24"
        width={16}
        height={16}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
        {/* The waves carry the only state this control has: speaking or not. */}
        <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
        <path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" opacity={speaking ? 1 : 0.45} />
      </svg>
    </button>
  )
}
