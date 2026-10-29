import { useState } from 'react'
import { applyUpdate, useUpdateStatus } from '../lib/updates'

/**
 * "A new version is ready" with an Update button, floating at the top of the
 * screen on every page — the desktop app as much as the phone. At the top
 * because the bottom belongs to Review's Next bar.
 *
 * It never updates by itself: reloading in the middle of a test would lose
 * your place. "Later" hides it for an hour; it comes back after that, and the
 * new version also loads by itself the next time the app is opened.
 */
const LATER_MS = 60 * 60_000

export function UpdateBanner() {
  const status = useUpdateStatus()
  const [hiddenUntil, setHiddenUntil] = useState(0)
  const [, setTick] = useState(0)

  if (status !== 'ready' && status !== 'updating') return null
  if (status === 'ready' && Date.now() < hiddenUntil) return null

  const later = () => {
    setHiddenUntil(Date.now() + LATER_MS)
    window.setTimeout(() => setTick((t) => t + 1), LATER_MS + 1000)
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner-text">✨ A new version of Lingo3 is ready.</span>
      <button
        type="button"
        className="update-banner-go"
        disabled={status === 'updating'}
        onClick={() => void applyUpdate()}
      >
        {status === 'updating' ? 'Updating…' : 'Update now'}
      </button>
      {status === 'ready' && (
        <button type="button" className="update-banner-later" onClick={later}>
          Later
        </button>
      )}
    </div>
  )
}
