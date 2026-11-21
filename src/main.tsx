/*
 * CHANGELOG CHECK REQUIRED — 2026-11-19, policy revision 1
 * Before code/config edits: read CHANGELOG.md, verify version/recent changes,
 * then read AGENTS.md and docs/DEVELOPMENT_HANDOFF.md.
 * Before finishing: update CHANGELOG.md with each change's version, date,
 * description and verification; commit with the code and update the handoff.
 * Follow AGENTS.md for version bumps, documentation revisions and route maps.
 */
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { InstallBanner } from './ui/InstallBanner'
import { UpdateBanner } from './ui/UpdateBanner'
import { startUpdates } from './lib/updates'
import './styles.css'

startUpdates()

function BootSignal() {
  useEffect(() => {
    document.getElementById('root')?.setAttribute('data-lingo-mounted', 'true')
    document.getElementById('boot-fallback')?.classList.remove('visible')
  }, [])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BootSignal />
      <InstallBanner />
      <UpdateBanner />
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
