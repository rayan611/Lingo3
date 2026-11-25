import { useMemo, useState } from 'react'
import type { Locale } from './types'

export type WeekSlot = { id: string; status: 'free' | 'busy' | string; starts_at: string; ends_at: string }

const BCP47: Record<Locale, string> = { en: 'en-GB', sv: 'sv-SE', fa: 'fa-IR', de: 'de-DE' }
const HOUR_PX = 40

const T: Record<
  Locale,
  { prev: string; next: string; free: string; busy: string; none: string; limit: string; thisWeek: string }
> = {
  en: {
    prev: 'Previous week',
    next: 'Next week',
    free: 'Free',
    busy: 'Booked',
    none: 'No free times this week. Try the next week.',
    limit: 'You can choose up to',
    thisWeek: 'This week'
  },
  sv: {
    prev: 'Föregående vecka',
    next: 'Nästa vecka',
    free: 'Ledig',
    busy: 'Bokad',
    none: 'Inga lediga tider den här veckan. Prova nästa vecka.',
    limit: 'Du kan välja upp till',
    thisWeek: 'Denna vecka'
  },
  fa: {
    prev: 'هفتهٔ قبل',
    next: 'هفتهٔ بعد',
    free: 'آزاد',
    busy: 'رزروشده',
    none: 'این هفته زمان آزادی نیست. هفتهٔ بعد را ببینید.',
    limit: 'حداکثر می‌توانید انتخاب کنید',
    thisWeek: 'این هفته'
  },
  de: {
    prev: 'Vorherige Woche',
    next: 'Nächste Woche',
    free: 'Frei',
    busy: 'Belegt',
    none: 'Keine freien Zeiten diese Woche. Nächste Woche ansehen.',
    limit: 'Sie können bis zu',
    thisWeek: 'Diese Woche'
  }
}

function mondayOf(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/**
 * A week at a glance: days across, hours down, free times as blocks you can tap.
 * Shown in the viewer's own time zone (the browser's). Busy blocks are shown grey and cannot be chosen.
 */
export function AcademyWeekPicker({
  locale,
  slots,
  selected = [],
  max = 3,
  readOnly = false,
  onToggle
}: {
  locale: Locale
  slots: WeekSlot[]
  selected?: string[]
  max?: number
  readOnly?: boolean
  onToggle?: (slot: WeekSlot) => void
}) {
  const t = T[locale]
  const [offset, setOffset] = useState(0)
  const first = useMemo(() => {
    const monday = mondayOf(new Date())
    monday.setDate(monday.getDate() + offset * 7)
    return monday
  }, [offset])
  const days = useMemo(
    () =>
      Array.from(
        { length: 7 },
        (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)
      ),
    [first]
  )
  const weekEnd = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7)
  const now = Date.now()

  const inWeek = useMemo(
    () =>
      slots
        .filter(s => new Date(s.ends_at).getTime() > now)
        .map(s => ({ ...s, start: new Date(s.starts_at), end: new Date(s.ends_at) }))
        .filter(s => s.start >= first && s.start < weekEnd),
    [slots, first, weekEnd, now]
  )
  const startHour = Math.max(0, Math.min(8, ...inWeek.map(s => s.start.getHours())))
  const endHour = Math.min(
    24,
    Math.max(20, ...inWeek.map(s => Math.ceil(s.end.getHours() + s.end.getMinutes() / 60)))
  )
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const dayFmt = new Intl.DateTimeFormat(BCP47[locale], { weekday: 'short', day: 'numeric' })
  const timeFmt = new Intl.DateTimeFormat(BCP47[locale], { hour: '2-digit', minute: '2-digit' })
  const rangeFmt = new Intl.DateTimeFormat(BCP47[locale], { day: 'numeric', month: 'short' })
  const hasFree = inWeek.some(s => s.status === 'free')

  return (
    <div
      className="ac-week"
      role="group"
      aria-label={`${rangeFmt.format(days[0])} – ${rangeFmt.format(days[6])}`}
    >
      <div className="ac-week-nav">
        <button
          type="button"
          className="ac-btn"
          disabled={offset === 0}
          onClick={() => setOffset(offset - 1)}
        >
          ‹ <span className="ac-sr">{t.prev}</span>
        </button>
        <strong>
          {rangeFmt.format(days[0])} – {rangeFmt.format(days[6])}
          {offset === 0 ? ` · ${t.thisWeek}` : ''}
        </strong>
        <button
          type="button"
          className="ac-btn"
          disabled={offset >= 12}
          onClick={() => setOffset(offset + 1)}
        >
          <span className="ac-sr">{t.next}</span> ›
        </button>
      </div>
      <div
        className="ac-week-grid"
        style={{ ['--ac-hours' as string]: hours.length, ['--ac-hour-px' as string]: HOUR_PX + 'px' }}
      >
        <div className="ac-week-axis" aria-hidden="true">
          <span className="ac-week-corner" />
          {hours.map(h => (
            <span key={h} className="ac-week-hour">
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>
        {days.map(day => (
          <div key={day.toISOString()} className="ac-week-day">
            <span className="ac-week-dayname">{dayFmt.format(day)}</span>
            <div className="ac-week-col">
              {hours.map(h => (
                <span
                  key={h}
                  className="ac-week-line"
                  style={{ top: (h - startHour) * HOUR_PX }}
                  aria-hidden="true"
                />
              ))}
              {inWeek
                .filter(s => s.start.getDate() === day.getDate() && s.start.getMonth() === day.getMonth())
                .map(s => {
                  const top = ((s.start.getHours() * 60 + s.start.getMinutes()) / 60 - startHour) * HOUR_PX
                  const height = Math.max(26, ((s.end.getTime() - s.start.getTime()) / 3600000) * HOUR_PX - 2)
                  const label = timeFmt.format(s.start)
                  const isFree = s.status === 'free'
                  const on = selected.includes(s.id)
                  const full = !on && selected.length >= max
                  if (!isFree || readOnly) {
                    return (
                      <span
                        key={s.id}
                        className={'ac-week-block ' + (isFree ? 'free' : 'busy')}
                        style={{ top, height }}
                        title={`${label} · ${isFree ? t.free : t.busy}`}
                      >
                        {label}
                      </span>
                    )
                  }
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={'ac-week-block free' + (on ? ' on' : '')}
                      style={{ top, height }}
                      aria-pressed={on}
                      aria-label={`${dayFmt.format(day)} ${label} · ${t.free}`}
                      disabled={full}
                      onClick={() => onToggle?.(s)}
                    >
                      {label}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
      {!hasFree && <p className="ac-muted">{t.none}</p>}
      {!readOnly && (
        <p className="ac-muted">
          {t.limit} {max}.
        </p>
      )}
    </div>
  )
}
