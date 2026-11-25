import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../auth/supabase'

import type { Locale } from './types'

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
  status?: string
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
    signIn: 'Sign in before requesting a lesson.'
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
    signIn: 'Bitte melde dich an, bevor du eine Stunde anfragst.'
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
    signIn: 'Logga in innan du begär en lektion.'
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
    signIn: 'برای درخواست جلسه ابتدا وارد حساب شو.'
  }
} satisfies Record<Locale, Record<string, string>>

function localized(value: Record<string, string>, locale: Locale) {
  return value[locale] || value.en || Object.values(value)[0] || ''
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

const wiz: Record<Locale, Record<string, string>> = {
  en: {
    s1: 'Course',
    s2: 'Time',
    s3: 'Confirm',
    next: 'Next',
    back: 'Back',
    pickTime: 'Pick a time',
    anotherTime: 'Or suggest another time',
    showAll: 'Show all times',
    summary: 'Your request',
    lessonType: 'Lesson type',
    noCourse: 'This teacher has no published courses yet.',
    trial: 'Trial',
    individual: 'Individual',
    small_group: 'Small group',
    offline_intro: 'Offline introduction',
    timeNote: 'Times are shown in your own time zone.'
  },
  sv: {
    s1: 'Kurs',
    s2: 'Tid',
    s3: 'Bekräfta',
    next: 'Nästa',
    back: 'Tillbaka',
    pickTime: 'Välj en tid',
    anotherTime: 'Eller föreslå en annan tid',
    showAll: 'Visa alla tider',
    summary: 'Din förfrågan',
    lessonType: 'Lektionstyp',
    noCourse: 'Läraren har inga publicerade kurser ännu.',
    trial: 'Prova på',
    individual: 'Enskild',
    small_group: 'Liten grupp',
    offline_intro: 'Introduktion på plats',
    timeNote: 'Tiderna visas i din egen tidszon.'
  },
  fa: {
    s1: 'دوره',
    s2: 'زمان',
    s3: 'تأیید',
    next: 'بعدی',
    back: 'قبلی',
    pickTime: 'یک زمان انتخاب کنید',
    anotherTime: 'یا زمان دیگری پیشنهاد دهید',
    showAll: 'نمایش همهٔ زمان‌ها',
    summary: 'درخواست شما',
    lessonType: 'نوع جلسه',
    noCourse: 'این استاد هنوز دورهٔ منتشرشده‌ای ندارد.',
    trial: 'آزمایشی',
    individual: 'خصوصی',
    small_group: 'گروه کوچک',
    offline_intro: 'معرفی حضوری',
    timeNote: 'زمان‌ها به منطقهٔ زمانی خود شما نمایش داده می‌شوند.'
  },
  de: {
    s1: 'Kurs',
    s2: 'Zeit',
    s3: 'Bestätigen',
    next: 'Weiter',
    back: 'Zurück',
    pickTime: 'Zeit wählen',
    anotherTime: 'Oder andere Zeit vorschlagen',
    showAll: 'Alle Zeiten anzeigen',
    summary: 'Ihre Anfrage',
    lessonType: 'Unterrichtsart',
    noCourse: 'Diese Lehrkraft hat noch keine veröffentlichten Kurse.',
    trial: 'Probestunde',
    individual: 'Einzelunterricht',
    small_group: 'Kleingruppe',
    offline_intro: 'Einführung vor Ort',
    timeNote: 'Zeiten werden in Ihrer eigenen Zeitzone angezeigt.'
  }
}

export function AcademyBookingDialog({
  locale,
  userId,
  teacher,
  courses,
  teacherCourses,
  initialCourseId,
  onClose,
  onSuccess
}: {
  locale: Locale
  userId: string | null
  teacher: Teacher
  courses: Course[]
  teacherCourses: TeacherCourse[]
  initialCourseId?: string
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const t = copy[locale]
  const eligible = useMemo(
    () =>
      teacherCourses
        .filter(link => link.teacher_id === teacher.id)
        .map(link => courses.find(course => course.id === link.course_id))
        .filter((course): course is Course => Boolean(course)),
    [teacher.id, teacherCourses, courses]
  )
  const [courseId, setCourseId] = useState(
    eligible.find(c => c.id === initialCourseId)?.id ?? eligible[0]?.id ?? ''
  )
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotId, setSlotId] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [message, setMessage] = useState('')
  const [sessionType, setSessionType] = useState('trial')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  const [showAllSlots, setShowAllSlots] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase()
      .rpc('academy_teacher_calendar', { p_teacher_id: teacher.id })
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
    const slot = slots.find(item => item.id === slotId)
    if (!slot && !customStart) {
      setError(t.custom)
      return
    }

    if (busy) return
    const date = new Date(slot?.starts_at ?? customStart)
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      setError(
        {
          fa: 'زمان معتبر در آینده انتخاب کن.',
          en: 'Choose a valid future lesson time.',
          sv: 'Välj en giltig framtida tid.',
          de: 'Wählen Sie einen gültigen zukünftigen Termin.'
        }[locale]
      )
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: insertError } = await supabase()
        .from('academy_bookings')
        .insert({
          student_id: userId,
          teacher_id: teacher.id,
          course_id: courseId,
          availability_id: slot?.id ?? null,
          session_type: sessionType,
          preferred_start: date.toISOString(),
          student_message: message.trim() || null,
          status: 'requested'
        })
      if (insertError) throw insertError
      onSuccess(t.sent)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : String((error as { message?: string }).message ?? error)
      )
    } finally {
      setBusy(false)
    }
  }

  const w = wiz[locale]
  const chosenCourse = eligible.find(c => c.id === courseId)
  const chosenSlot = slots.find(s => s.id === slotId)
  const timeLabel = chosenSlot
    ? localDateTime(chosenSlot.starts_at)
    : customStart
      ? localDateTime(new Date(customStart).toISOString())
      : ''
  const canNext = step === 1 ? Boolean(courseId) : step === 2 ? Boolean(slotId || customStart) : true
  const openSlots = slots.filter(s => s.status !== 'busy')
  const shownSlots = showAllSlots ? openSlots : openSlots.slice(0, 9)

  return (
    <div className="academy-modal ac-sheet-backdrop" role="dialog" aria-modal="true" aria-label={t.title}>
      <form className="academy-modal-inner academy-booking-dialog ac-sheet" onSubmit={submit}>
        <button className="modal-close" type="button" onClick={onClose} aria-label={t.close}>
          ×
        </button>
        <h2>{t.title}</h2>
        <p className="muted">{teacher.display_name}</p>
        <ol className="ac-wizard-steps" aria-label="Steps">
          {[w.s1, w.s2, w.s3].map((label, i) => (
            <li
              key={label}
              className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}
              aria-current={step === i + 1 ? 'step' : undefined}
            >
              <span>{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <section hidden={step !== 1} aria-label={w.s1}>
          {eligible.length === 0 && <p className="academy-help">{w.noCourse}</p>}
          <div className="ac-choice-list" role="radiogroup" aria-label={t.course}>
            {eligible.map(course => (
              <button
                type="button"
                role="radio"
                aria-checked={course.id === courseId}
                key={course.id}
                className={'ac-choice' + (course.id === courseId ? ' on' : '')}
                onClick={() => setCourseId(course.id)}
              >
                <strong>{localized(course.title_i18n, locale)}</strong>
                <small>
                  {course.level_code}
                  {typeof (course as { price_sek?: number | null }).price_sek === 'number'
                    ? ` · ${(course as { price_sek?: number | null }).price_sek} SEK`
                    : ''}
                </small>
              </button>
            ))}
          </div>
        </section>

        <section hidden={step !== 2} aria-label={w.s2}>
          <p className="muted">{w.timeNote}</p>
          {openSlots.length === 0 ? (
            <p className="academy-help">{t.noSlots}</p>
          ) : (
            <>
              <h3>{w.pickTime}</h3>
              <div className="ac-slot-grid">
                {shownSlots.map(slot => (
                  <button
                    type="button"
                    key={slot.id}
                    className={'ac-choice ac-slot' + (slot.id === slotId ? ' on' : '')}
                    aria-pressed={slot.id === slotId}
                    onClick={() => {
                      setSlotId(slot.id === slotId ? '' : slot.id)
                      setCustomStart('')
                    }}
                  >
                    {localDateTime(slot.starts_at)}
                  </button>
                ))}
              </div>
              {openSlots.length > shownSlots.length && (
                <button type="button" className="ac-btn" onClick={() => setShowAllSlots(true)}>
                  {w.showAll}
                </button>
              )}
            </>
          )}
          <label className="ac-custom-time">
            {w.anotherTime}
            <input
              aria-label={t.custom}
              title={t.custom}
              type="datetime-local"
              value={customStart}
              disabled={Boolean(slotId)}
              onChange={event => setCustomStart(event.target.value)}
            />
          </label>
          {slotId && (
            <button type="button" className="ac-btn" onClick={() => setSlotId('')}>
              ✕ {timeLabel}
            </button>
          )}
        </section>

        <section hidden={step !== 3} aria-label={w.s3}>
          <div className="ac-summary">
            <strong>{w.summary}</strong>
            <span>{chosenCourse ? localized(chosenCourse.title_i18n, locale) : ''}</span>
            <span>{timeLabel}</span>
          </div>
          <label>
            {w.lessonType}
            <select value={sessionType} onChange={e => setSessionType(e.target.value)}>
              {(['trial', 'individual', 'small_group', 'offline_intro'] as const).map(k => (
                <option key={k} value={k}>
                  {w[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.message}
            <textarea
              placeholder={
                {
                  fa: 'مثلاً می‌خواهم روی مکالمه و تلفظ تمرکز کنم.',
                  en: 'e.g. I would like to focus on conversation and pronunciation.',
                  sv: 'Till exempel: jag vill fokusera på samtal och uttal.',
                  de: 'Zum Beispiel: Ich möchte Konversation und Aussprache üben.'
                }[locale]
              }
              value={message}
              maxLength={3000}
              onChange={event => setMessage(event.target.value)}
            />
          </label>
        </section>

        {error && <div className="academy-notice error">{error}</div>}
        <div className="ac-wizard-actions">
          {step > 1 ? (
            <button type="button" className="ac-btn" onClick={() => setStep(step - 1)}>
              {w.back}
            </button>
          ) : (
            <button type="button" className="ac-btn" onClick={onClose}>
              {t.close}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="ac-btn primary"
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
            >
              {w.next}
            </button>
          ) : (
            <button className="ac-btn primary" type="submit" disabled={busy || !courseId}>
              {busy ? '…' : t.send}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
