import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { InstallBanner } from './ui/InstallBanner'
import { UpdateBanner } from './ui/UpdateBanner'
import { startUpdates } from './lib/updates'
import './styles.css'

startUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <InstallBanner />
      <UpdateBanner />
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
