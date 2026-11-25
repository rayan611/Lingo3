import type { Locale } from './types'

const BCP47: Record<Locale, string> = { en: 'en-GB', sv: 'sv-SE', fa: 'fa-IR', de: 'de-DE' }

/** The viewer's own IANA time zone, e.g. "Europe/Stockholm". */
export function userTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Format an ISO instant for a viewer: weekday, date and time in their own zone. */
export function formatLessonTime(iso: string | null | undefined, locale: Locale, timeZone = userTimeZone()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(BCP47[locale], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

/** Show a second line only when the other person's zone differs, e.g. "14:00 in Europe/Stockholm". */
export function otherZoneHint(iso: string, locale: Locale, otherZone: string | null | undefined): string {
  if (!otherZone || otherZone === userTimeZone()) return ''
  const time = new Intl.DateTimeFormat(BCP47[locale], { hour: '2-digit', minute: '2-digit', timeZone: otherZone }).format(
    new Date(iso)
  )
  return `${time} · ${otherZone}`
}
