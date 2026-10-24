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
 *
 * When the device has no voice at all for a language — Swedish on many
 * Android phones, most languages on desktop Chrome on Linux — the word is
 * fetched as audio from /api/tts instead, so the speaker is still there.
 * That needs a connection; with a local voice nothing changes.
 */

import { LANG_BCP47, type Lang } from '../db/types'
import { authConfigured, supabase } from '../auth/supabase'

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
 * Can a speaker for this language do anything here: a voice on the device,
 * or a connection to fetch one.
 */
export function canSpeak(lang: Lang): boolean {
  if (speechSupported() && hasVoiceFor(lang)) return true
  return typeof navigator === 'undefined' || navigator.onLine !== false
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
  if (!text.trim()) return
  stopSpeaking()
  if (!speechSupported() || !hasVoiceFor(lang)) {
    void speakRemote(text, lang, opts.rate ?? 0.95)
    return
  }
  const synth = window.speechSynthesis
  const u = new SpeechSynthesisUtterance(text)
  u.lang = LANG_BCP47[lang]
  const voice = pickVoice(u.lang)
  if (voice) u.voice = voice
  u.rate = opts.rate ?? 0.95
  synth.speak(u)
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel()
  remoteTurn++
  remoteAudio?.pause()
}

// ---------------------------------------------------------------------------
// The fallback: audio from /api/tts
// ---------------------------------------------------------------------------

let remoteAudio: HTMLAudioElement | null = null
let remoteUnlocked = false
/** Bumped by every speak and stop, so a slow fetch cannot talk over a newer one. */
let remoteTurn = 0
/** Clips already fetched this session, as object URLs, oldest first. */
const clips = new Map<string, string>()
const CLIPS_MAX = 80

/**
 * A few milliseconds of silence as a WAV. Played once inside the tap that
 * first asks for remote audio: iOS only lets an audio element play later,
 * after the fetch, if it has already played inside a user gesture.
 */
function silentWav(): string {
  const bytes = new Uint8Array(44 + 16)
  const view = new DataView(bytes.buffer)
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + 16, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 8000, true)
  view.setUint32(28, 16000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, 16, true)
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`
}

async function clipFor(text: string, lang: Lang): Promise<string | null> {
  const key = `${lang}:${text}`
  const hit = clips.get(key)
  if (hit) return hit
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (authConfigured) {
    const { data } = await supabase().auth.getSession()
    const token = data.session?.access_token
    if (token) headers.authorization = `Bearer ${token}`
  }
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, lang }),
    })
    if (!res.ok) return null
    const url = URL.createObjectURL(await res.blob())
    clips.set(key, url)
    for (const [old, oldUrl] of clips) {
      if (clips.size <= CLIPS_MAX) break
      clips.delete(old)
      URL.revokeObjectURL(oldUrl)
    }
    return url
  } catch {
    return null
  }
}

async function speakRemote(text: string, lang: Lang, rate: number) {
  if (typeof Audio === 'undefined') return
  const turn = remoteTurn
  const audio = (remoteAudio ??= new Audio())
  if (!remoteUnlocked) {
    remoteUnlocked = true
    audio.src = silentWav()
    audio.play().catch(() => {})
  }
  const url = await clipFor(text.trim(), lang)
  if (!url || turn !== remoteTurn) return
  audio.src = url
  audio.playbackRate = rate
  audio.play().catch(() => {})
}
