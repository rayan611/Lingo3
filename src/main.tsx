import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { InstallBanner } from './ui/InstallBanner'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <InstallBanner />
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
