import { useEffect, useState } from 'react'
import { LANG_NAMES, type Lang } from '../db/types'
import { missingVoices, onVoicesChanged } from '../lib/speak'

type Platform = 'android' | 'ios' | 'mac' | 'windows'

const PLATFORM_LABELS: Record<Platform, string> = {
  android: 'Android',
  ios: 'iPhone / iPad',
  mac: 'Mac',
  windows: 'Windows',
}

/** The guide opens on the device you are holding; the others are a tap away. */
function guessPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'android'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  // iPadOS reports itself as a Mac; the touch points give it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/macintosh|mac os x/i.test(ua)) return 'mac'
  if (/windows/i.test(ua)) return 'windows'
  return 'android'
}

function Steps({ platform, names }: { platform: Platform; names: string }) {
  if (platform === 'android') {
    return (
      <ol className="voice-steps">
        <li>
          Open <strong>Settings</strong> and search for <strong>Text-to-speech</strong> (on
          Samsung: Settings → General management → Text-to-speech; elsewhere usually System →
          Languages &amp; input → Text-to-speech output).
        </li>
        <li>
          Choose <strong>Speech Services by Google</strong> as the engine and tap the gear ⚙ next
          to it.
        </li>
        <li>
          Tap <strong>Install voice data</strong>, find {names} and tap the download arrow.
        </li>
        <li>When it has downloaded, close Lingo3 and the browser completely and open them again.</li>
      </ol>
    )
  }
  if (platform === 'ios') {
    return (
      <ol className="voice-steps">
        <li>
          Open <strong>Settings → Accessibility → Spoken Content → Voices</strong>.
        </li>
        <li>Tap {names} and pick a voice — an Enhanced or Premium one sounds best.</li>
        <li>Tap the download ⤓ button and wait for it to finish.</li>
        <li>Close Lingo3 (swipe it away) and open it again.</li>
      </ol>
    )
  }
  if (platform === 'windows') {
    return (
      <ol className="voice-steps">
        <li>
          Open <strong>Settings → Time &amp; language → Speech</strong>.
        </li>
        <li>
          Under <strong>Manage voices</strong>, click <strong>Add voices</strong>, tick {names}{' '}
          and click <strong>Add</strong>.
        </li>
        <li>
          If {names} is not in that list: <strong>Time &amp; language → Language &amp; region →
          Add a language</strong>, choose it and keep <strong>Text-to-speech</strong> ticked.
        </li>
        <li>
          Restart the computer, then open Lingo3 again. If Chrome still has no voice, try Microsoft
          Edge, which also has natural voices of its own.
        </li>
      </ol>
    )
  }
  return (
    <ol className="voice-steps">
      <li>
        Open <strong>System Settings → Accessibility → Spoken Content</strong>.
      </li>
      <li>
        Next to <strong>System voice</strong>, open the menu and choose{' '}
        <strong>Manage Voices…</strong>
      </li>
      <li>Find {names}, tick a voice and click OK to download it.</li>
      <li>Quit the browser (⌘Q) and open Lingo3 again.</li>
    </ol>
  )
}

/**
 * A note under the languages you study when this device has no voice for
 * one of them, with a guide to installing it.
 *
 * Those languages still speak — over the internet, see `speak.ts` — but a
 * voice on the device works offline, starts at once and on most phones
 * sounds better, so it is worth the one-time download.
 */
export function VoiceHint({ langs }: { langs: readonly Lang[] }) {
  // The voice list arrives late on some browsers; re-check when it does.
  const [, setTick] = useState(0)
  useEffect(() => onVoicesChanged(() => setTick((t) => t + 1)), [])
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<Platform>(guessPlatform)

  const missing = missingVoices(langs)
  if (missing.length === 0) return null

  const names = missing.map((l) => LANG_NAMES[l]).join(', ')
  const voice = missing.length === 1 ? `a ${names} voice` : `voices for ${names}`

  return (
    <div className="voice-hint" role="note">
      <p>
        <strong>🔈 This device has no {names} voice installed.</strong>{' '}
        <span className="muted">
          The speakers still work while you are online, but with {voice} installed on the device
          they also work offline, start instantly and usually sound better.
        </span>
      </p>
      <button
        type="button"
        className="voice-hint-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide the steps' : 'How to install a voice'}
      </button>
      {open && (
        <div className="voice-guide">
          <div className="voice-tabs" role="tablist" aria-label="Your device">
            {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={platform === p}
                className={platform === p ? 'on' : ''}
                onClick={() => setPlatform(p)}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          <Steps platform={platform} names={names} />
          <p className="muted small">
            Menu names differ a little between phone makers and system versions. If a step is not
            where it says, search the Settings app for “text-to-speech”, “speech” or “spoken content”.
          </p>
        </div>
      )}
    </div>
  )
}
