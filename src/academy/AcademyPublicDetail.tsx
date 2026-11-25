import { useEffect, useState } from 'react'
import type { Course, Teacher } from './Academy'
import { AcademyShare } from './AcademyShare'
import { localizedName } from './preferences'
import { navigateProduct } from '../lib/productNavigation'
import { supabase } from '../auth/supabase'
const copy = {
  en: {
    back: 'Back to directory',
    goal: 'Learning goals',
    before: 'Prerequisites',
    ask: 'Ask the teacher about entry requirements.',
    topics: 'Syllabus',
    teachers: 'Teachers offering this course',
    courses: 'Courses',
    time: 'Session duration',
    price: 'Price',
    quote: 'Enquire',
    book: 'Request a lesson',
    calendar: 'Free / booked calendar',
    none: 'No published times',
    missing: 'This profile is not available.',
    experience: 'Introduction and experience'
  },
  fa: {
    back: 'بازگشت به فهرست',
    goal: 'هدف یادگیری',
    before: 'پیش‌نیاز',
    ask: 'شرایط ورود به دوره را از استاد بپرسید.',
    topics: 'سرفصل',
    teachers: 'استادهای ارائه‌دهندهٔ دوره',
    courses: 'دوره‌ها',
    time: 'مدت جلسه',
    price: 'قیمت',
    quote: 'استعلام',
    book: 'درخواست کلاس',
    calendar: 'تقویم آزاد / رزروشده',
    none: 'زمانی منتشر نشده است',
    missing: 'این معرفی در دسترس نیست.',
    experience: 'معرفی و سابقه'
  },
  sv: {
    back: 'Tillbaka till listan',
    goal: 'Lärandemål',
    before: 'Förkunskaper',
    ask: 'Fråga läraren om förkunskapskraven.',
    topics: 'Kursinnehåll',
    teachers: 'Kursens lärare',
    courses: 'Kurser',
    time: 'Lektionslängd',
    price: 'Pris',
    quote: 'Fråga om pris',
    book: 'Begär en lektion',
    calendar: 'Lediga / bokade tider',
    none: 'Inga publicerade tider',
    missing: 'Profilen är inte tillgänglig.',
    experience: 'Presentation och erfarenhet'
  },
  de: {
    back: 'Zurück zur Liste',
    goal: 'Lernziele',
    before: 'Voraussetzungen',
    ask: 'Fragen Sie die Lehrkraft nach den Voraussetzungen.',
    topics: 'Lehrplan',
    teachers: 'Lehrkräfte für diesen Kurs',
    courses: 'Kurse',
    time: 'Unterrichtsdauer',
    price: 'Preis',
    quote: 'Preis anfragen',
    book: 'Unterricht anfragen',
    calendar: 'Freie / gebuchte Zeiten',
    none: 'Keine veröffentlichten Zeiten',
    missing: 'Dieses Profil ist nicht verfügbar.',
    experience: 'Vorstellung und Erfahrung'
  }
}
export function AcademyPublicDetail({
  locale,
  kind,
  id,
  courses,
  teachers,
  links,
  loading,
  onBook
}: {
  locale: keyof typeof copy
  kind: 'courseDetail' | 'teacherDetail'
  id: string
  courses: Course[]
  teachers: Teacher[]
  links: { teacher_id: string; course_id: string }[]
  loading: boolean
  onBook: (teacherId: string, courseId?: string) => void
}) {
  const t = copy[locale],
    text = (v: Record<string, string>) => v[locale] || v.en || Object.values(v)[0] || ''
  const course = kind === 'courseDetail' ? courses.find(c => c.id === id) : undefined,
    teacher = kind === 'teacherDetail' ? teachers.find(c => c.id === id) : undefined
  const related = course
    ? teachers.filter(x => links.some(l => l.teacher_id === x.id && l.course_id === id))
    : []
  const offered = teacher
    ? courses.filter(x => links.some(l => l.course_id === x.id && l.teacher_id === id))
    : []
  const preferred = new URLSearchParams(window.location.search).get('teacher')
  const [calendar, setCalendar] = useState<
      { id: string; starts_at: string; ends_at: string; status: string }[]
    >([]),
    [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setCalendar([])
    setError('')
    if (teacher)
      void Promise.resolve(supabase().rpc('academy_teacher_calendar', { p_teacher_id: teacher.id }))
        .then(r => {
          if (live) {
            setCalendar(r.data ?? [])
            setError(r.error?.message ?? '')
          }
        })
        .catch(e => {
          if (live) setError(String(e))
        })
    return () => {
      live = false
    }
  }, [teacher?.id])
  const title = course
      ? text(course.title_i18n)
      : teacher
        ? localizedName(teacher, locale)
        : 'Lingo3 Academy',
    description = course ? text(course.description_i18n) : teacher ? text(teacher.intro_i18n) : ''
  useEffect(() => {
    const previous = document.title
    document.title = title + ' | Lingo3 Academy'
    return () => {
      document.title = previous
    }
  }, [title])
  const path = kind === 'courseDetail' ? '/academy/courses/' : '/academy/teachers/'
  return (
    <section className="academy-section academy-detail">
      <button
        type="button"
        onClick={() => {
          const previous = window.history.state?.academyPreviousPath
          if (typeof previous === 'string' && previous.startsWith('/academy')) window.history.back()
          else navigateProduct(path.slice(0, -1))
        }}
      >
        {t.back}
      </button>
      {loading ? (
        <p role="status">…</p>
      ) : !course && !teacher ? (
        <p role="status">{t.missing}</p>
      ) : (
        <>
          <header className={'academy-detail-header ' + (teacher ? 'academy-profile-hero' : '')}>
            <div>
              {teacher &&
                (teacher.photo_url ? (
                  <img
                    className="academy-profile-photo"
                    src={teacher.photo_url}
                    decoding="async"
                    alt={title}
                  />
                ) : (
                  <div className="academy-profile-avatar" aria-hidden="true">
                    {title.slice(0, 1)}
                  </div>
                ))}
              <div>
                <h1>{title}</h1>
                {teacher && description && <p>{description}</p>}
                {course && (
                  <p>
                    {course.subject_code.toUpperCase()} · {course.level_code}
                  </p>
                )}
              </div>
            </div>
            <AcademyShare locale={locale} title={title} description={description} path={path + id} />
          </header>
          {course && (
            <div className="academy-detail-grid">
              <div className="academy-detail-main">
                <section className="academy-card">
                  <h2>{t.goal}</h2>
                  <p>{description}</p>
                  <h3>{t.before}</h3>
                  <p>{t.ask}</p>
                </section>
                <section className="academy-card">
                  <h2>{t.topics}</h2>
                  <ul>
                    {(course.topics_i18n[locale] || course.topics_i18n.en || []).map(x => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </section>
                <section className="academy-card">
                  <h2>{t.teachers}</h2>
                  <div className="academy-detail-list">
                    {related
                      .sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred))
                      .map(x => (
                        <article className="academy-detail-row" key={x.id}>
                          <a
                            href={'/academy/teachers/' + x.id + '?course=' + id}
                            onClick={e => {
                              e.preventDefault()
                              navigateProduct(e.currentTarget.pathname + e.currentTarget.search)
                            }}
                          >
                            {localizedName(x, locale)}
                          </a>
                          <button className="academy-primary" onClick={() => onBook(x.id, id)}>
                            {t.book}
                          </button>
                        </article>
                      ))}
                  </div>
                  {!related.length && <p>{t.quote}</p>}
                </section>
              </div>
              <aside className="academy-card academy-detail-facts">
                <p>
                  <strong>{t.time}:</strong> {course.duration_minutes} min
                </p>
                <p>
                  <strong>{t.price}:</strong> {course.price_sek == null ? t.quote : course.price_sek + ' SEK'}
                </p>
                <div className="academy-tags">
                  {course.delivery_modes.map(m => (
                    <span key={m}>
                      {m === 'small_group_online'
                        ? { fa: 'گروهی', sv: 'Grupp', de: 'Gruppe', en: 'Group' }[locale]
                        : m === 'individual_online'
                          ? { fa: 'خصوصی', sv: 'Enskild', de: 'Einzelunterricht', en: 'Private' }[locale]
                          : m === 'offline_intro'
                            ? {
                                fa: 'معرفی حضوری',
                                sv: 'Introduktion på plats',
                                de: 'Einführung vor Ort',
                                en: 'In-person introduction'
                              }[locale]
                            : m}
                    </span>
                  ))}
                </div>
              </aside>
            </div>
          )}
          {teacher && (
            <div className="academy-detail-grid">
              <div className="academy-detail-main">
                <section className="academy-card">
                  <h2>{t.experience}</h2>
                  <p>{description}</p>
                  {!teacher.intro_i18n[locale] && description && (
                    <small>
                      {
                        {
                          fa: 'معرفی به زبان دیگری ارائه شده است.',
                          en: 'Introduction shown in another language.',
                          sv: 'Presentationen visas på ett annat språk.',
                          de: 'Die Vorstellung wird in einer anderen Sprache angezeigt.'
                        }[locale]
                      }
                    </small>
                  )}
                  <div className="academy-tags">
                    {[...teacher.teaching_languages, ...teacher.levels, ...teacher.specialties].map(
                      (x, i) => (
                        <span key={x + i}>{x}</span>
                      )
                    )}
                  </div>
                </section>
                <section className="academy-card">
                  <h2>{t.courses}</h2>
                  <div className="academy-detail-list">
                    {offered.map(x => (
                      <article className="academy-detail-row" key={x.id}>
                        <a
                          href={'/academy/courses/' + x.id + '?teacher=' + id}
                          onClick={e => {
                            e.preventDefault()
                            navigateProduct(e.currentTarget.pathname + e.currentTarget.search)
                          }}
                        >
                          {text(x.title_i18n)}
                        </a>
                        <button className="academy-primary" onClick={() => onBook(id, x.id)}>
                          {t.book}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
              <aside className="academy-card academy-detail-facts">
                <h2>{t.calendar}</h2>
                {error && <p role="alert">{error}</p>}
                {!calendar.length && !error && <p>{t.none}</p>}
                <ul className="academy-detail-list">
                  {calendar.map(s => (
                    <li key={s.id}>
                      {new Date(s.starts_at).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {s.status === 'free'
                        ? { fa: 'آزاد', sv: 'Ledig', de: 'Frei', en: 'Free' }[locale]
                        : { fa: 'رزروشده', sv: 'Bokad', de: 'Gebucht', en: 'Booked' }[locale]}
                    </li>
                  ))}
                </ul>
              </aside>
              <section className="academy-card academy-profile-contact">
                <h2>{{ fa: 'راه‌های ارتباطی', en: 'Contact', sv: 'Kontakt', de: 'Kontakt' }[locale]}</h2>
                <div className="teacher-contact">
                  {teacher.email && <a href={'mailto:' + teacher.email}>Email</a>}
                  {teacher.phone && (
                    <a href={'tel:' + teacher.phone}>
                      {{ fa: 'تلفن', en: 'Phone', sv: 'Telefon', de: 'Telefon' }[locale]}
                    </a>
                  )}
                  {teacher.phone && /^\+[0-9 ()-]{7,20}$/.test(teacher.phone) && (
                    <a
                      href={'https://wa.me/' + teacher.phone.replace(/\D/g, '')}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  )}
                  {teacher.telegram_url && (
                    <a href={teacher.telegram_url} target="_blank" rel="noopener noreferrer">
                      Telegram
                    </a>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  )
}
