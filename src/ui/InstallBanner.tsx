import { useState } from 'react'
import { promptInstall, useInstallMode } from './installState'

/**
 * A slim strip along the top asking to install the app, on every visit until
 * it is installed. Closing it hides it for this visit only — the next one asks
 * again — and once the app is installed it never shows.
 *
 * "This visit" is sessionStorage, so it stays closed while moving around the
 * app and comes back after the tab is closed.
 */
const CLOSED = 'lingua.installBannerClosed'

function closedThisVisit() {
  try {
    return sessionStorage.getItem(CLOSED) === '1'
  } catch {
    return false
  }
}

export function InstallBanner() {
  const mode = useInstallMode()
  const [closed, setClosed] = useState(closedThisVisit)

  if (closed || mode === 'installed' || mode === 'none') return null

  const close = () => {
    try {
      sessionStorage.setItem(CLOSED, '1')
    } catch {
      /* storage blocked — it just comes back on reload */
    }
    setClosed(true)
  }

  return (
    <div className="install-banner" role="region" aria-label="Install Lingo3">
      <p>
        {mode === 'prompt' && <>Install Lingo3 — it opens full screen and works offline.</>}
        {mode === 'ios' && (
          <>
            Install Lingo3: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          </>
        )}
        {mode === 'mac-safari' && (
          <>
            Install Lingo3: in Safari choose <strong>File → Add to Dock</strong>.
          </>
        )}
      </p>
      {mode === 'prompt' && (
        <button className="install-banner-go" onClick={() => void promptInstall()}>
          Install
        </button>
      )}
      <button className="install-banner-close" onClick={close} aria-label="Close" title="Close">
        ×
      </button>
    </div>
  )
}
