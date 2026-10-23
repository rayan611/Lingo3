/**
 * The tab icons.
 *
 * Inline SVG, drawn in `currentColor`, rather than an icon font or images: no
 * extra request, nothing that can fail to load, and the colour comes from the
 * chip around it so each tab can carry its own hue without a second asset.
 *
 * Every icon is drawn on the same 24-unit grid with the same stroke weight,
 * and rendered at a fixed 15px inside the existing 24px chip — so the bar is
 * exactly the size it was before. The glyphs they replace (+ ◎ ▤ ✓ ☰ ⚙) were
 * font-dependent and rendered at a different weight on every platform.
 */

const base = {
  viewBox: '0 0 24 24',
  width: 15,
  height: 15,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Add — a plus. */
export function IconAdd() {
  return (
    <svg {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** Training — cards being flipped through: one behind, one in front. */
export function IconTraining() {
  return (
    <svg {...base}>
      <rect x="3" y="6" width="13" height="13" rx="2.5" />
      <path d="M8 3h10a3 3 0 0 1 3 3v10" />
    </svg>
  )
}

/** Reading — an open book. */
export function IconReading() {
  return (
    <svg {...base}>
      <path d="M12 7.5v12" />
      <path d="M12 7.5C10.5 6 8.5 5.2 4 5.2V17c4.5 0 6.5.8 8 2.3 1.5-1.5 3.5-2.3 8-2.3V5.2c-4.5 0-6.5.8-8 2.3Z" />
    </svg>
  )
}

/** Review — a tick inside a ring: the thing you do to a word that is due. */
export function IconReview() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </svg>
  )
}

/** Words — a list. */
export function IconWords() {
  return (
    <svg {...base}>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
    </svg>
  )
}

/** Settings — sliders, not a cog. A cog at 15px is a smudge. */
export function IconSettings() {
  return (
    <svg {...base}>
      <path d="M4 8h10M18 8h2M4 16h3M11 16h9" />
      <circle cx="16" cy="8" r="2.2" />
      <circle cx="9" cy="16" r="2.2" />
    </svg>
  )
}

/** Translate — two speech marks crossing, an A and a mark. */
export function IconTranslate() {
  return (
    <svg {...base}>
      <path d="M4 5h8M8 3v2M10 5c-.5 3-2.5 5.5-5 7M6.5 8.5c1 1.5 2.5 2.7 4 3.5" />
      <path d="M13 21l3.5-8 3.5 8M14.2 18.3h4.6" />
    </svg>
  )
}

/** Add later — a bookmark: kept, not yet dealt with. */
export function IconLater() {
  return (
    <svg {...base}>
      <path d="M7 4h10v16l-5-3.5L7 20z" />
    </svg>
  )
}
