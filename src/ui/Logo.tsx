import { useId } from 'react'

/**
 * The L3 mark: white "L3" on a sky-blue tile.
 *
 * Inline SVG rather than an image file so it costs no request and stays crisp
 * at any size. The colours are fixed rather than themed — a mark that changes
 * colour with the palette is decoration, not identity — and they are the same
 * colours as the installed home-screen icon, which `scripts/make-icons.py`
 * renders from the same three values. Change one, re-run that.
 *
 * Two things that were decided the hard way. The gradient is the one place in
 * this app where a gradient belongs: an icon is a picture, not part of the
 * interface, and flat navy read as a placeholder at home-screen size. The
 * letters are sans rather than the Georgia the wordmark uses, because the
 * smallest place this appears is a 16px browser tab, where a serif's thin
 * strokes simply vanish.
 */
export function Logo({ size = 30 }: { size?: number }) {
  // One gradient id per instance: the header and the landing page both render
  // a Logo, and two <defs> sharing an id is a silent wrong fill.
  const gradientId = useId()

  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Lingo3"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--logo-tile-top)" />
          <stop offset="1" stopColor="var(--logo-tile)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradientId})`} />
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--logo-ink)"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="30"
        fontWeight="700"
        letterSpacing="-1.2"
      >
        L3
      </text>
    </svg>
  )
}
