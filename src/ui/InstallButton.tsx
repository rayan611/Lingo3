import { useState } from 'react'
import { promptInstall, useInstallMode } from './installState'

/**
 * Offer to install the app, in the two different ways the two platforms need.
 *
 * Chrome and the Android browsers fire `beforeinstallprompt`, which can be
 * stashed and replayed on a click. iOS Safari never fires it and has no API at
 * all — there, installing is Share → Add to Home Screen, and the only thing
 * that helps is saying so.
 *
 * Either way the button disappears once the app is already installed, which is
 * what `display-mode: standalone` tells us. Without that check it would nag
 * forever on the one device where it is least useful.
 */
const DISMISSED = 'lingua.installHintDismissed'

export function InstallButton() {
  const mode = useInstallMode()
  const [showIosHint, setShowIosHint] = useState(false)

  if (mode === 'installed') return null

  let dismissed = false
  try {
    dismissed = localStorage.getItem(DISMISSED) === '1'
  } catch {
    /* storage blocked — show it */
  }

  if (mode === 'prompt') {
    return (
      <button className="install-button" onClick={() => void promptInstall()}>
        Install
      </button>
    )
  }

  if (mode === 'ios' && !dismissed) {
    return (
      <>
        <button className="install-button" onClick={() => setShowIosHint(true)}>
          Install
        </button>
        {showIosHint && (
          <div className="panel install-hint">
            <p className="small">
              On iPhone and iPad this is a Safari thing rather than something
              the page can do: tap the <strong>Share</strong> button, then{' '}
              <strong>Add to Home Screen</strong>. It then opens full screen and
              works offline.
            </p>
            <div className="row">
              <button onClick={() => setShowIosHint(false)}>Got it</button>
              <button
                className="link"
                onClick={() => {
                  try {
                    localStorage.setItem(DISMISSED, '1')
                  } catch {
                    /* nothing to do */
                  }
                  setShowIosHint(false)
                }}
              >
                Don't show this again
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}
