/**
 * Speaking, through the browser's own voices.
 *
 * `speechSynthesis` is built into every browser this app runs in, so there is
 * no key, no network call and no cost — which matters because the rule in this
 * project is that reviewing never waits on a network. A voice that is already
 * installed speaks offline; one that is not simply is not there.
 *
 * Quality is the device's, not ours. Swedish and German voices are good on
 * Android, Windows and macOS. iOS ships a basic voice and downloads a better
 * one only when the user asks for it in Settings → Accessibility → Spoken
 * Content, which is why `voiceNote` exists rather than us pretending the
 * output is the same everywhere.
 */

import { LANG_BCP47, type Lang } from '../db/types'

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * The voice list arrives asynchronously in some browsers and synchronously in
 * others, and on Chrome it is empty until the engine has woken up. Everything
 * here tolerates an empty list: no voice means the platform default, which is
 * usually right for the requested language anyway.
 */
let voices: SpeechSynthesisVoice[] = []

function refreshVoices() {
  if (!speechSupported()) return
  voices = window.speechSynthesis.getVoices()
}

if (speechSupported()) {
  refreshVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
}

/**
 * The best installed voice for a language.
 *
 * Exact region first (sv-SE over sv-FI), then any voice for the language, then
 * nothing. A local voice is preferred over a network one: it works offline and
 * starts instantly.
 */
function pickVoice(bcp47: string): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) refreshVoices()
  const lang = bcp47.toLowerCase()
  const base = lang.split('-')[0]
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(base))
  if (candidates.length === 0) return undefined
  const exact = candidates.filter((v) => v.lang.toLowerCase() === lang)
  const pool = exact.length > 0 ? exact : candidates
  return pool.find((v) => v.localService) ?? pool[0]
}

/** Is there any voice at all for this language on this device? */
export function hasVoiceFor(lang: Lang): boolean {
  if (!speechSupported()) return false
  // An empty list is not the same as no voice: the engine may not have woken
  // up yet, and refusing to show the button then would hide it permanently on
  // the first render. Assume yes until we know otherwise.
  if (voices.length === 0) {
    refreshVoices()
    if (voices.length === 0) return true
  }
  return pickVoice(LANG_BCP47[lang]) !== undefined
}

/**
 * Speaks a word or a sentence.
 *
 * Anything already speaking is cancelled first: tapping a second speaker
 * should replace the first, not queue behind it. Slightly under normal speed,
 * because the point is to hear where the word breaks rather than to sound
 * natural at conversational pace.
 */
export function speak(text: string, lang: Lang, opts: { rate?: number } = {}) {
  if (!speechSupported() || !text.trim()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = LANG_BCP47[lang]
  const voice = pickVoice(u.lang)
  if (voice) u.voice = voice
  u.rate = opts.rate ?? 0.95
  synth.speak(u)
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel()
}
