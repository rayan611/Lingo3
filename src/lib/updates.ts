import { useSyncExternalStore } from 'react'

/**
 * Knowing when a new version is out, and switching to it.
 *
 * The service worker already installs a new deploy by itself (skipWaiting in
 * vite.config.ts), but nothing told the page: the old code kept running until
 * the app happened to be reopened. A phone reopens its apps all the time, so
 * there it looked fine; a desktop app stays open for days, and a browser only
 * checks for a new worker when a page loads — so there it never updated.
 *
 * Two signals, either is enough:
 *   - the service worker taking over with a new version (controllerchange);
 *   - /version.json, written at build time, naming a build other than ours.
 *     It works without a service worker too, and is what the periodic check
 *     reads.
 *
 * Nothing reloads by itself: a reload in the middle of a test would lose your
 * place. The page says a new version is ready and offers a button.
 */

export type UpdateStatus = 'idle' | 'checking' | 'current' | 'ready' | 'updating' | 'error'

const CHECK_EVERY_MS = 30 * 60_000
/** Coming back to the app checks again, but not more often than this. */
const MIN_GAP_MS = 5 * 60_000

let status: UpdateStatus = 'idle'
const listeners = new Set<() => void>()
let registration: ServiceWorkerRegistration | null = null
let lastCheck = 0
let started = false

function set(next: UpdateStatus) {
  // Once ready, only applying the update moves it on.
  if (status === 'ready' && next !== 'updating') return
  status = next
  listeners.forEach((l) => l())
}

export function useUpdateStatus(): UpdateStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}

/** Is a build other than this one on the server? null when it cannot tell. */
async function newerOnServer(): Promise<boolean | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { build?: string }
    return typeof body.build === 'string' ? body.build !== __BUILD_ID__ : null
  } catch {
    return null
  }
}

/** Looks for a new version. Quiet: it only changes what the page shows. */
export async function checkForUpdate(): Promise<UpdateStatus> {
  if (status === 'ready' || status === 'updating') return status
  lastCheck = Date.now()
  set('checking')
  // Also lets the service worker fetch the new version in the background,
  // so the update is already downloaded by the time the button is pressed.
  void registration?.update().catch(() => {})
  const newer = await newerOnServer()
  set(newer === true ? 'ready' : newer === false ? 'current' : 'error')
  return status
}

function checkIfDue() {
  if (Date.now() - lastCheck >= MIN_GAP_MS) void checkForUpdate()
}

/** Waits until a service worker that is installing has taken over, or gives up. */
function settle(reg: ServiceWorkerRegistration, ms: number): Promise<void> {
  const worker = reg.installing ?? reg.waiting
  if (!worker) return Promise.resolve()
  // A worker that waits instead of taking over at once is told to.
  if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' })
  return new Promise((resolve) => {
    const done = () => resolve()
    const timer = window.setTimeout(done, ms)
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        window.clearTimeout(timer)
        done()
      }
    })
  })
}

/** Switches to the new version: makes sure it is downloaded, then reloads. */
export async function applyUpdate(): Promise<void> {
  set('updating')
  try {
    if (registration) {
      await registration.update().catch(() => {})
      await settle(registration, 15_000)
    }
  } finally {
    window.location.reload()
  }
}

/** Registers the service worker and starts watching for new versions. Once. */
export function startUpdates(): void {
  if (started || typeof window === 'undefined') return
  started = true
  // The development server has neither a service worker nor version.json.
  if (!import.meta.env.PROD) return

  if ('serviceWorker' in navigator) {
    // A first install is not an update: only a takeover of a page that
    // already had a worker means new code arrived.
    let hadController = Boolean(navigator.serviceWorker.controller)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) set('ready')
      hadController = true
    })
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          registration = reg
        })
        .catch(() => {
          /* no worker: the version file still tells us about updates */
        })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }

  window.setInterval(() => void checkForUpdate(), CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkIfDue()
  })
  window.addEventListener('focus', checkIfDue)
  window.addEventListener('online', () => void checkForUpdate())
  // A first look shortly after start, out of the way of the first paint.
  window.setTimeout(() => void checkForUpdate(), 20_000)
}
