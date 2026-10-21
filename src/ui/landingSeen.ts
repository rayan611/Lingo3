/**
 * Whether the front page has been seen on this device.
 *
 * Its own module, apart from Landing.tsx, so that App can ask the question at
 * startup without pulling the whole landing page into the main bundle; the
 * page itself is loaded only when it is actually shown.
 */
export const SEEN_KEY = 'lingua.landingSeen'

/**
 * Has this visitor already been past the front door?
 *
 * Three ways to be past it, and all three skip the landing:
 *
 *  - the app is installed and launched from the home screen, where a
 *    marketing page between the icon and the words would be absurd;
 *  - they have opened it before on this device;
 *  - they are signed in, which is checked by the caller.
 *
 * The flag is device-local on purpose. It is a fact about this browser, not
 * about the account, so it has no business in the synced settings row — and
 * it is the one preference that did NOT move to the account in v3.3.
 */
export function shouldShowLanding(): boolean {
  if (typeof window === 'undefined') return false
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari does not implement display-mode and uses this instead.
    (navigator as { standalone?: boolean }).standalone === true
  if (standalone) return false
  try {
    return window.localStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    // Private mode, or storage blocked. Showing the page once per visit is a
    // better failure than throwing on the way to the app.
    return true
  }
}
