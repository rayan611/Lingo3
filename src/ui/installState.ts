import { useSyncExternalStore } from 'react'

/**
 * Whether this device can install the app, and how — shared by the header's
 * Install button and the banner along the top, so the two never disagree and
 * never both try to replay the same browser prompt (it can be used only once).
 *
 * Chrome, Edge and the Android browsers fire `beforeinstallprompt`, and only
 * while the app is NOT installed: no event means installed already, or a
 * browser that cannot install. Safari fires nothing; there installing is a
 * menu action, so all the page can do is say which one.
 */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallMode =
  | 'installed' // running as the installed app, or just installed
  | 'prompt' // the browser handed us its install prompt
  | 'ios' // iPhone/iPad Safari: Share → Add to Home Screen
  | 'mac-safari' // Safari on a Mac: File → Add to Dock
  | 'none' // nothing we can offer

let deferred: InstallPromptEvent | null = null
let justInstalled = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates the media query.
    (navigator as { standalone?: boolean }).standalone === true
  )
}

function detect(): InstallMode {
  if (justInstalled || isStandalone()) return 'installed'
  if (deferred) return 'prompt'
  const ua = navigator.userAgent
  const ios =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS reports itself as a Mac, but a Mac has no touch points.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios) return 'ios'
  const safari = /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|opr|firefox/i.test(ua)
  if (safari && /macintosh/i.test(ua)) return 'mac-safari'
  return 'none'
}

if (typeof window !== 'undefined') {
  // boot.js listens from the very first script, in case the browser fires
  // before this bundle has loaded.
  const early = (window as { __installPrompt?: InstallPromptEvent }).__installPrompt
  if (early) deferred = early
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    justInstalled = true
    deferred = null
    notify()
  })
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, detect, () => 'none')
}

/** Show the browser's own install dialog. Only meaningful in 'prompt' mode. */
export async function promptInstall() {
  const e = deferred
  if (!e) return
  // A prompt can be shown once. If they say no, the browser offers a
  // fresh one on a later visit.
  deferred = null
  notify()
  try {
    await e.prompt()
  } catch {
    /* already used, or the browser refused — nothing to do */
  }
}
