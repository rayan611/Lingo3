/**
 * Theme choice.
 *
 * The choice follows the account since v3.3; this module only applies it and
 * keeps a copy for the next cold start. A device that wants its own theme
 * pins it in Settings, which is a separate thing from this cache.
 *
 * Cached in localStorage and applied as `data-theme` on <html>, which the
 * stylesheet already keys off: the dark palette is written as
 * `:root:not([data-theme='light'])` under a prefers-color-scheme query, so
 * "system" is simply the absence of an explicit choice.
 */
export const THEMES = ['system', 'light', 'dark', 'dark-blue'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
  'dark-blue': 'Dark blue',
}

const KEY = 'lingua.theme'

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored && (THEMES as readonly string[]).includes(stored)) {
      return stored as Theme
    }
  } catch {
    /* private mode, or storage blocked — fall through to the default */
  }
  return 'system'
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)

  // Keep the browser chrome in step with the page, or a dark app sits under a
  // light status bar on Android.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const dark =
      theme === 'dark' ||
      theme === 'dark-blue' ||
      (theme === 'system' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    meta.setAttribute('content', dark ? '#171c22' : '#f7f5f0')
  }
}

/**
 * Apply a theme and remember it as this device's boot cache.
 *
 * The choice itself lives in the settings row and follows the account; what
 * localStorage holds is only the last theme this device painted, so the first
 * frame after a cold start is the right colour. Nothing reads it except boot.
 */
export function cacheTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* the cache just does not survive a reload; the account still decides */
  }
  applyTheme(theme)
}
