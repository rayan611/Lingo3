import { useEffect, useState } from 'react'
import { hasVoiceFor, speak, speechSupported, stopSpeaking } from '../lib/speak'
import type { Lang } from '../db/types'

/**
 * A speaker beside a word or a sentence.
 *
 * It renders nothing at all when the device cannot speak that language, rather
 * than showing a button that does nothing when tapped — a dead control is
 * worse than an absent one.
 *
 * Two sizes: `sm` sits inline beside a headword, the default beside a block of
 * text. Both are the same control; only the circle changes.
 */
export function SpeakButton({
  text,
  lang,
  size = 'md',
  label,
  rate,
}: {
  text: string
  lang: Lang
  size?: 'sm' | 'md'
  label?: string
  /** The speaking rate from Settings; the module's own default when absent. */
  rate?: number
}) {
  const [speaking, setSpeaking] = useState(false)

  // Anything still speaking when this leaves the screen — the next card, a
  // closed text — stops with it.
  useEffect(() => () => stopSpeaking(), [])

  if (!speechSupported() || !text.trim() || !hasVoiceFor(lang)) return null

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
      className={`speak ${size === 'sm' ? 'speak-sm' : ''} ${speaking ? 'speaking' : ''}`}
      onClick={go}
      title={label ?? 'Listen'}
      aria-label={label ?? 'Listen'}
    >
      <svg
        viewBox="0 0 24 24"
        width={size === 'sm' ? 13 : 15}
        height={size === 'sm' ? 13 : 15}
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
