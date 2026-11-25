import { useEffect, useState } from 'react'
import { supabase } from '../auth/supabase'
import type { Locale } from './types'

type Counts = {
  requests: number | null
  draftTeachers: number | null
  teachers: number | null
  courses: number | null
  students: number | null
  lessonsWeek: number | null
  noShows: number | null
  cancelled: number | null
}

const T: Record<Locale, Record<keyof Counts | 'title' | 'open', string>> = {
  en: {
    title: 'Overview',
    open: 'Open',
    requests: 'Trial requests waiting',
    draftTeachers: 'Teachers waiting for approval',
    teachers: 'Active teachers',
    courses: 'Published courses',
    students: 'Active enrollments',
    lessonsWeek: 'Lessons in the next 7 days',
    noShows: 'No-shows, last 30 days',
    cancelled: 'Cancellations, last 30 days'
  },
  sv: {
    title: 'Översikt',
    open: 'Öppna',
    requests: 'Provlektioner som väntar',
    draftTeachers: 'Lärare som väntar på godkännande',
    teachers: 'Aktiva lärare',
    courses: 'Publicerade kurser',
    students: 'Aktiva anmälningar',
    lessonsWeek: 'Lektioner närmaste 7 dagarna',
    noShows: 'Uteblivna, senaste 30 dagarna',
    cancelled: 'Avbokningar, senaste 30 dagarna'
  },
  fa: {
    title: 'نمای کلی',
    open: 'باز کردن',
    requests: 'درخواست‌های کلاس آزمایشی در انتظار',
    draftTeachers: 'مدرس‌های در انتظار تأیید',
    teachers: 'مدرس‌های فعال',
    courses: 'دوره‌های منتشرشده',
    students: 'ثبت‌نام‌های فعال',
    lessonsWeek: 'کلاس‌های ۷ روز آینده',
    noShows: 'غیبت، ۳۰ روز گذشته',
    cancelled: 'لغو، ۳۰ روز گذشته'
  },
  de: {
    title: 'Übersicht',
    open: 'Öffnen',
    requests: 'Wartende Probestunden-Anfragen',
    draftTeachers: 'Lehrkräfte warten auf Freigabe',
    teachers: 'Aktive Lehrkräfte',
    courses: 'Veröffentlichte Kurse',
    students: 'Aktive Anmeldungen',
    lessonsWeek: 'Stunden in den nächsten 7 Tagen',
    noShows: 'Nicht erschienen, letzte 30 Tage',
    cancelled: 'Absagen, letzte 30 Tage'
  }
}

function ReviewsSwitch({ locale }: { locale: Locale }) {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    supabase()
      .rpc('academy_reviews_on')
      .then(({ data }) => setOn(data === true))
  }, [])
  const text = {
    en: [
      'Reviews',
      'On: students can review a teacher after a completed lesson.',
      'Off: reviews are not shown and cannot be written.',
      'Turn on',
      'Turn off'
    ],
    sv: [
      'Omdömen',
      'På: elever kan ge omdöme efter en genomförd lektion.',
      'Av: omdömen visas inte och kan inte skrivas.',
      'Slå på',
      'Slå av'
    ],
    fa: [
      'نظرها',
      'روشن: شاگردان پس از یک کلاس انجام‌شده می‌توانند نظر بدهند.',
      'خاموش: نظرها نمایش داده نمی‌شوند و نوشته نمی‌شوند.',
      'روشن کردن',
      'خاموش کردن'
    ],
    de: [
      'Bewertungen',
      'An: Lernende können nach einer abgeschlossenen Stunde bewerten.',
      'Aus: Bewertungen werden nicht angezeigt.',
      'Einschalten',
      'Ausschalten'
    ]
  }[locale]
  if (on === null) return null
  return (
    <div className="ac-card academy-reviews-switch">
      <strong>{text[0]}</strong>
      <span className="ac-muted">{on ? text[1] : text[2]}</span>
      <button
        type="button"
        className="ac-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const { error } = await supabase()
            .from('academy_features')
            .update({ reviews_enabled: !on })
            .eq('id', true)
          if (!error) setOn(!on)
          setBusy(false)
        }}
      >
        {on ? text[4] : text[3]}
      </button>
    </div>
  )
}

/** Admin landing numbers. Each tile opens the tool that handles it. */
export function AcademyAdminOverview({
  locale,
  onOpen
}: {
  locale: Locale
  onOpen: (panel: 'enrollments' | 'courses' | 'teachers') => void
}) {
  const t = T[locale]
  const [c, setC] = useState<Counts | null>(null)
  useEffect(() => {
    let active = true
    const head = (table: string, build: (q: any) => any) =>
      build(supabase().from(table).select('id', { count: 'exact', head: true })).then(
        (r: { count: number | null }) => r.count ?? null
      )
    ;(async () => {
      const now = new Date().toISOString()
      const week = new Date(Date.now() + 7 * 86400000).toISOString()
      try {
        const back = new Date(Date.now() - 30 * 86400000).toISOString()
        const [requests, draftTeachers, teachers, courses, students, lessonsWeek, noShows, cancelled] =
          await Promise.all([
            head('academy_bookings', q => q.eq('status', 'requested')),
            head('academy_teachers', q => q.eq('status', 'draft')),
            head('academy_teachers', q => q.eq('status', 'active')),
            head('academy_courses', q => q.eq('status', 'active')),
            head('academy_enrollments', q => q.eq('status', 'active').is('removed_at', null)),
            head('academy_bookings', q =>
              q.eq('status', 'confirmed').gte('confirmed_start', now).lte('confirmed_start', week)
            ),
            head('academy_bookings', q => q.eq('status', 'no_show').gte('updated_at', back)),
            head('academy_bookings', q =>
              q
                .in('status', ['cancelled_student', 'cancelled_teacher', 'cancelled_admin'])
                .gte('updated_at', back)
            )
          ])
        if (active)
          setC({ requests, draftTeachers, teachers, courses, students, lessonsWeek, noShows, cancelled })
      } catch {
        /* tiles stay empty */
      }
    })()
    return () => {
      active = false
    }
  }, [])
  const tiles: { key: keyof Counts; to: 'enrollments' | 'courses' | 'teachers' }[] = [
    { key: 'requests', to: 'enrollments' },
    { key: 'draftTeachers', to: 'teachers' },
    { key: 'teachers', to: 'teachers' },
    { key: 'courses', to: 'courses' },
    { key: 'students', to: 'enrollments' },
    { key: 'lessonsWeek', to: 'enrollments' },
    { key: 'noShows', to: 'enrollments' },
    { key: 'cancelled', to: 'enrollments' }
  ]
  return (
    <section className="academy-admin-overview" aria-label={t.title}>
      <h3>{t.title}</h3>
      <ReviewsSwitch locale={locale} />
      <div className="academy-admin-tiles">
        {tiles.map(({ key, to }) => (
          <button
            key={key}
            type="button"
            className="ac-card academy-admin-tile"
            onClick={() => onOpen(to)}
            title={t.open}
          >
            <strong>{c ? (c[key] ?? '–') : '…'}</strong>
            <span>{t[key]}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
