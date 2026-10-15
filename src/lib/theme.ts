/**
 * Theme choice.
 *
 * The choice follows the account since v3.3; this module only applies it and
 * keeps a copy for the next cold start. A device that wants its own theme
 * pins it in Settings, which is a separate thing from this cache.
 *
 * Cached in localStorage and applied as `data-theme` on <html>, which the
 * stylesheet keys off. "Match my device" is the absence of the attribute, and
 * the automatic dark palette is written as `:root:not([data-theme])` — so a
 * named theme, bright or dark, is never second-guessed by the device.
 */
export const THEMES = ['bloom', 'system', 'light', 'dark', 'dark-blue'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  bloom: 'Bloom — bright',
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
  'dark-blue': 'Dark blue',
}

/**
 * What you get having chosen nothing.
 *
 * Bloom rather than "match my device", which was the old default and is the
 * cautious one: it hands the decision to a setting the person made about
 * their phone, not about this app. The app now has a look of its own, and the
 * front door is the same look, so opening the app should not feel like
 * walking into a different building.
 */
export const DEFAULT_THEME: Theme = 'bloom'

/** The page colour each theme paints, matched to `--bg` in the stylesheet. */
const CHROME: Record<Theme, string> = {
  bloom: '#fdfbff',
  system: '#f7f5f0',
  light: '#f7f5f0',
  dark: '#171c22',
  'dark-blue': '#121a28',
}

/**
 * Fetch the two faces the bloom theme and the landing page share.
 *
 * One request for both, and the same URL in both places, so anyone who came
 * in through the front door already has it cached by the time the app opens.
 * `display=swap` means nothing ever waits on it: the fallbacks are a rounded
 * system face and the system sans.
 */
export function ensureDisplayFonts(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('lx-fonts')) return
  const pre = document.createElement('link')
  pre.rel = 'preconnect'
  pre.href = 'https://fonts.gstatic.com'
  pre.crossOrigin = ''
  const css = document.createElement('link')
  css.id = 'lx-fonts'
  css.rel = 'stylesheet'
  css.href =
    'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Inter:wght@400;500;600&display=swap'
  document.head.append(pre, css)
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
  return DEFAULT_THEME
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  // The absence of the attribute is what "follow the device" means, and the
  // stylesheet's automatic dark block is keyed on exactly that.
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)

  if (theme === 'bloom') ensureDisplayFonts()

  // Keep the browser chrome in step with the page, or a dark app sits under a
  // light status bar on Android.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    // Every named theme knows its own colour; only "match my device" has to
    // be asked, and only then can it differ from what CHROME lists.
    const systemDark =
      theme === 'system' &&
      (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
    meta.setAttribute('content', systemDark ? '#171c22' : CHROME[theme])
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
