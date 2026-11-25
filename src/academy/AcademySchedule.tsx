import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../auth/supabase'
import { AcademyWeek } from './AcademyWeek'
import type { AcademyLocale } from './AcademyHelp'

type Course = { id: string; title_i18n: Record<string, string> }
type Event = { id: string; start: string; title: string; status: string; url?: string | null }
const words = {
  fa: {
    load: 'در حال دریافت برنامه…',
    error: 'دریافت برنامه انجام نشد؛ دوباره تلاش کنید.',
    free: 'زمان آزاد',
    class: 'کلاس گروهی',
    session: 'کلاس خصوصی',
    confirmed: 'تأییدشده',
    completed: 'انجام‌شده',
    progress: 'در حال برگزاری'
  },
  en: {
    load: 'Loading schedule…',
    error: 'Could not load the schedule. Please try again.',
    free: 'Available',
    class: 'Group class',
    session: 'Private lesson',
    confirmed: 'Confirmed',
    completed: 'Completed',
    progress: 'In progress'
  },
  sv: {
    load: 'Laddar schema…',
    error: 'Kunde inte hämta schemat. Försök igen.',
    free: 'Ledig tid',
    class: 'Grupplektion',
    session: 'Privatlektion',
    confirmed: 'Bekräftad',
    completed: 'Genomförd',
    progress: 'Pågår'
  },
  de: {
    load: 'Stundenplan wird geladen…',
    error: 'Stundenplan konnte nicht geladen werden. Bitte erneut versuchen.',
    free: 'Freie Zeit',
    class: 'Gruppenunterricht',
    session: 'Einzelunterricht',
    confirmed: 'Bestätigt',
    completed: 'Abgeschlossen',
    progress: 'Läuft'
  }
}
export function AcademySchedule({
  locale,
  userId,
  teacherId,
  studentTeacherId,
  courses,
  onSelectDay,
  revision = 0
}: {
  locale: AcademyLocale
  userId: string
  teacherId?: string
  studentTeacherId?: string
  courses: Course[]
  onSelectDay?: (day: Date) => void
  revision?: number
}) {
  const t = words[locale],
    [range, setRange] = useState<{ start: string; end: string } | null>(null),
    [events, setEvents] = useState<Event[]>([]),
    [notice, setNotice] = useState(''),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(false)
  const changeRange = useCallback(
    (start: Date, end: Date) => setRange({ start: start.toISOString(), end: end.toISOString() }),
    []
  )
  useEffect(() => {
    if (!range) return
    let alive = true
    setLoading(true)
    setNotice('')
    setEvents([])
    const client = supabase()
    let b = client
      .from('academy_bookings')
      .select('id,course_id,confirmed_start,duration_minutes,status,meeting_url')
      .gte('confirmed_start', range.start)
      .lt('confirmed_start', range.end)
      .in('status', ['confirmed', 'in_progress', 'completed'])
    b = teacherId ? b.eq('teacher_id', teacherId) : b.eq('student_id', userId)
    const classes = client.from('academy_classes').select('id,title')
    let sessions = client
      .from('academy_class_sessions')
      .select('id,class_id,teacher_id,starts_at,ends_at,status,meeting_url')
      .gte('starts_at', range.start)
      .lt('starts_at', range.end)
      .in('status', ['confirmed', 'completed'])
    if (teacherId) sessions = sessions.eq('teacher_id', teacherId)
    const slots = teacherId
      ? client
          .from('academy_availability')
          .select('id,starts_at,ends_at,status')
          .eq('teacher_id', teacherId)
          .eq('status', 'available')
          .gte('starts_at', range.start)
          .lt('starts_at', range.end)
      : studentTeacherId
        ? client.rpc('academy_teacher_calendar', {
            p_teacher_id: studentTeacherId,
            p_from: range.start,
            p_to: range.end
          })
        : Promise.resolve({ data: [], error: null })
    const busy = teacherId
      ? client.rpc('academy_teacher_calendar', {
          p_teacher_id: teacherId,
          p_from: range.start,
          p_to: range.end
        })
      : Promise.resolve({ data: [], error: null })
    Promise.all([b, classes, sessions, slots, busy])
      .then(([book, groups, groupSessions, available, occupied]) => {
        if (!alive) return
        const error = [book, groups, groupSessions, available, occupied].find(r => r.error)
        if (error) {
          setNotice(t.error)
          setLoading(false)
          return
        }
        const courseTitle = (id: string | null) => {
          const c = courses.find(x => x.id === id)
          return c?.title_i18n[locale] || c?.title_i18n.en || t.session
        }
        const classNames = new Map((groups.data ?? []).map((g: any) => [g.id, g.title]))
        const personal = (book.data ?? [])
          .filter((x: any) => x.confirmed_start)
          .map((x: any) => ({
            id: 'booking-' + x.id,
            start: x.confirmed_start,
            title: courseTitle(x.course_id),
            status:
              x.status === 'completed' ? t.completed : x.status === 'in_progress' ? t.progress : t.confirmed,
            url: x.status === 'completed' ? null : x.meeting_url
          }))
        const group = (groupSessions.data ?? []).map((x: any) => ({
          id: 'group-' + x.id,
          start: x.starts_at,
          title: String(classNames.get(x.class_id) || t.class),
          status: x.status === 'completed' ? t.completed : t.confirmed,
          url: x.status === 'completed' ? null : x.meeting_url
        }))
        const conflicts = [
          ...(occupied.data ?? []).filter((o: any) => o.status === 'busy'),
          ...(groupSessions.data ?? []).filter((o: any) => o.status === 'confirmed'),
          ...(book.data ?? [])
            .filter((o: any) => o.status === 'confirmed' || o.status === 'in_progress')
            .map((o: any) => ({
              starts_at: o.confirmed_start,
              ends_at: new Date(
                new Date(o.confirmed_start).getTime() + (o.duration_minutes || 60) * 60000
              ).toISOString()
            }))
        ]
        const times = (available.data ?? [])
          .filter((a: any) => a.status === 'available' || a.status === 'free')
          .filter(
            (a: any) =>
              !teacherId ||
              !conflicts.some(
                (o: any) =>
                  o.starts_at &&
                  o.ends_at &&
                  new Date(o.starts_at) < new Date(a.ends_at) &&
                  new Date(o.ends_at) > new Date(a.starts_at)
              )
          )
          .map((a: any) => ({ id: 'slot-' + a.id, start: a.starts_at, title: t.free, status: t.free }))
        setEvents([...personal, ...group, ...times])
        setLoading(false)
      })
      .catch(() => {
        if (alive) {
          setNotice(t.error)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [range?.start, range?.end, userId, teacherId, studentTeacherId, locale, retry, courses, revision])
  const horizonNotice = Boolean(
    !teacherId && studentTeacherId && range && new Date(range.start).getTime() > Date.now() + 120 * 86400000
  )
  return (
    <div>
      {horizonNotice && (
        <p className="academy-help" role="note">
          {
            {
              fa: 'زمان‌های آزاد استاد تا ۱۲۰ روز آینده نمایش داده می‌شوند؛ جلسه‌های ثبت‌شده همچنان نمایش داده می‌شوند.',
              en: 'Teacher availability is shown up to 120 days ahead; scheduled lessons still appear.',
              sv: 'Lärarens lediga tider visas högst 120 dagar framåt; bokade lektioner visas fortfarande.',
              de: 'Freie Zeiten werden bis 120 Tage im Voraus angezeigt; gebuchte Stunden bleiben sichtbar.'
            }[locale]
          }
        </p>
      )}
      <AcademyWeek
        locale={locale}
        events={events}
        onSelectDay={onSelectDay}
        onRangeChange={changeRange}
        pending={loading}
        unavailable={Boolean(notice)}
      />
      {loading && <p role="status">{t.load}</p>}
      {notice && (
        <p role="alert">
          {notice}{' '}
          <button type="button" onClick={() => setRetry(x => x + 1)}>
            {{ fa: 'تلاش دوباره', en: 'Retry', sv: 'Försök igen', de: 'Erneut versuchen' }[locale]}
          </button>
        </p>
      )}
    </div>
  )
}
