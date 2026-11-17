import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../auth/supabase'

type Locale = 'en' | 'sv' | 'fa' | 'de'

type Course = {
  id: string
  level_code: string
  title_i18n: Record<string, string>
}

type Teacher = {
  id: string
  display_name: string
}

type TeacherCourse = { teacher_id: string; course_id: string }

type Slot = {
  id: string
  teacher_id: string
  starts_at: string
  ends_at: string
  delivery_mode: 'online' | 'offline'
}

const copy = {
  en: {
    title: 'Request a trial lesson',
    course: 'Course',
    slot: 'Available time',
    custom: 'Or suggest another time',
    message: 'Message to teacher',
    send: 'Send request',
    close: 'Close',
    noSlots: 'No published slots yet — you can still suggest a time.',
    choose: 'Choose…',
    customOption: 'I will suggest another time',
    sent: 'Trial request sent.',
    signIn: 'Sign in before requesting a lesson.',
  },
  de: {
    title: 'Probestunde anfragen',
    course: 'Kurs',
    slot: 'Verfügbare Zeit',
    custom: 'Oder eine andere Zeit vorschlagen',
    message: 'Nachricht an die Lehrkraft',
    send: 'Anfrage senden',
    close: 'Schließen',
    noSlots: 'Noch keine veröffentlichten Zeiten — du kannst trotzdem eine Zeit vorschlagen.',
    choose: 'Auswählen…',
    customOption: 'Ich schlage eine andere Zeit vor',
    sent: 'Anfrage für Probestunde gesendet.',
    signIn: 'Bitte melde dich an, bevor du eine Stunde anfragst.',
  },
  sv: {
    title: 'Begär en provlektion',
    course: 'Kurs',
    slot: 'Ledig tid',
    custom: 'Eller föreslå en annan tid',
    message: 'Meddelande till läraren',
    send: 'Skicka förfrågan',
    close: 'Stäng',
    noSlots: 'Inga publicerade tider ännu — du kan fortfarande föreslå en tid.',
    choose: 'Välj…',
    customOption: 'Jag föreslår en annan tid',
    sent: 'Förfrågan skickad.',
    signIn: 'Logga in innan du begär en lektion.',
  },
  fa: {
    title: 'درخواست جلسه آزمایشی',
    course: 'دوره',
    slot: 'زمان‌های آزاد',
    custom: 'یا زمان دیگری پیشنهاد بده',
    message: 'پیام برای مدرس',
    send: 'ارسال درخواست',
    close: 'بستن',
    noSlots: 'هنوز زمان آزادی منتشر نشده؛ می‌توانی زمان پیشنهادی خودت را وارد کنی.',
    choose: 'انتخاب…',
    customOption: 'زمان دیگری پیشنهاد می‌دهم',
    sent: 'درخواست جلسه ارسال شد.',
    signIn: 'برای درخواست جلسه ابتدا وارد حساب شو.',
  },
} satisfies Record<Locale, Record<string, string>>

function localized(value: Record<string, string>, locale: Locale) {
  return value[locale] || value.en || Object.values(value)[0] || ''
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AcademyBookingDialog({
  locale,
  userId,
  teacher,
  courses,
  teacherCourses,
  onClose,
  onSuccess,
}: {
  locale: Locale
  userId: string | null
  teacher: Teacher
  courses: Course[]
  teacherCourses: TeacherCourse[]
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const t = copy[locale]
  const eligible = useMemo(
    () =>
      teacherCourses
        .filter((link) => link.teacher_id === teacher.id)
        .map((link) => courses.find((course) => course.id === link.course_id))
        .filter((course): course is Course => Boolean(course)),
    [teacher.id, teacherCourses, courses],
  )
  const [courseId, setCourseId] = useState(eligible[0]?.id ?? '')
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotId, setSlotId] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase()
      .from('academy_availability')
      .select('id,teacher_id,starts_at,ends_at,delivery_mode')
      .eq('teacher_id', teacher.id)
      .eq('status', 'available')
      .gt('ends_at', new Date().toISOString())
      .order('starts_at')
      .limit(30)
      .then(({ data, error: queryError }) => {
        if (cancelled) return
        if (queryError) setError(queryError.message)
        else setSlots((data ?? []) as Slot[])
      })
    return () => {
      cancelled = true
    }
  }, [teacher.id])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!userId) {
      setError(t.signIn)
      return
    }
    if (!courseId) return
    const slot = slots.find((item) => item.id === slotId)
    if (!slot && !customStart) {
      setError(t.custom)
      return
    }

    setBusy(true)
    setError('')
    const preferredStart = slot?.starts_at ?? new Date(customStart).toISOString()
    const { error: insertError } = await supabase().from('academy_bookings').insert({
      student_id: userId,
      teacher_id: teacher.id,
      course_id: courseId,
      availability_id: slot?.id ?? null,
      session_type: 'trial',
      preferred_start: preferredStart,
      student_message: message.trim() || null,
      status: 'requested',
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onSuccess(t.sent)
  }

  return (
    <div className="academy-modal" role="dialog" aria-modal="true" aria-label={t.title}>
      <form className="academy-modal-inner academy-booking-dialog" onSubmit={submit}>
        <button className="modal-close" type="button" onClick={onClose} aria-label={t.close}>
          ×
        </button>
        <h2>{t.title}</h2>
        <p className="muted">{teacher.display_name}</p>

        <label>
          {t.course}
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
            <option value="">{t.choose}</option>
            {eligible.map((course) => (
              <option value={course.id} key={course.id}>
                {localized(course.title_i18n, locale)} · {course.level_code}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.slot}
          <select
            value={slotId}
            onChange={(event) => {
              setSlotId(event.target.value)
              if (event.target.value) setCustomStart('')
            }}
          >
            <option value="">{t.customOption}</option>
            {slots.map((slot) => (
              <option value={slot.id} key={slot.id}>
                {localDateTime(slot.starts_at)} · {slot.delivery_mode}
              </option>
            ))}
          </select>
        </label>
        {slots.length === 0 && <p className="academy-help">{t.noSlots}</p>}

        <label>
          {t.custom}
          <input
            aria-label="Preferred lesson date and time"
            title="Choose your preferred lesson date and time"
            type="datetime-local"
            value={customStart}
            disabled={Boolean(slotId)}
            onChange={(event) => setCustomStart(event.target.value)}
          />
        </label>

        <label>
          {t.message}
          <textarea placeholder="e.g. I would like to focus on conversation and pronunciation." value={message} maxLength={3000} onChange={(event) => setMessage(event.target.value)} />
        </label>

        {error && <div className="academy-notice error">{error}</div>}
        <div className="academy-card-actions">
          <button className="academy-primary" type="submit" disabled={busy || !courseId}>
            {busy ? '…' : t.send}
          </button>
          <button type="button" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </form>
    </div>
  )
}
