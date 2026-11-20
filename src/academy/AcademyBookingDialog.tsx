import {AcademyFormHelp} from './AcademyHelp'
import {AcademyField} from './AcademyField'
import {AcademyHelp} from './AcademyHelp'
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
  initialCourseId,
  onClose,
  onSuccess,
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
        .filter((link) => link.teacher_id === teacher.id)
        .map((link) => courses.find((course) => course.id === link.course_id))
        .filter((course): course is Course => Boolean(course)),
    [teacher.id, teacherCourses, courses],
  )
  const [courseSearch,setCourseSearch]=useState('')
  const [courseId, setCourseId] = useState(eligible.find(c=>c.id===initialCourseId)?.id ?? eligible[0]?.id ?? '')
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotSearch,setSlotSearch]=useState('')
  const [slotId, setSlotId] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [message, setMessage] = useState('')
  const [sessionType,setSessionType]=useState('trial')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase().rpc('academy_teacher_calendar',{p_teacher_id:teacher.id})
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

    if(busy)return
    const date=new Date(slot?.starts_at??customStart)
    if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now()){setError(({fa:'زمان معتبر در آینده انتخاب کن.',en:'Choose a valid future lesson time.',sv:'Välj en giltig framtida tid.',de:'Wählen Sie einen gültigen zukünftigen Termin.'})[locale]);return}
    setBusy(true);setError('')
    try{
     const {error:insertError}=await supabase().from('academy_bookings').insert({student_id:userId,teacher_id:teacher.id,course_id:courseId,availability_id:slot?.id??null,session_type:sessionType,preferred_start:date.toISOString(),student_message:message.trim()||null,status:'requested'})
     if(insertError)throw insertError
     onSuccess(t.sent)
    }catch(error){setError(error instanceof Error?error.message:String((error as {message?:string}).message??error))}finally{setBusy(false)}
  }

  return (
    <div className="academy-modal" role="dialog" aria-modal="true" aria-label={t.title}>
      <form className="academy-modal-inner academy-booking-dialog" onSubmit={submit}><AcademyFormHelp locale={locale}/>
        <button className="modal-close" type="button" onClick={onClose} aria-label={t.close}>
          ×
        </button>
        <h2>{t.title}</h2>
        <p className="muted">{teacher.display_name}</p>

{eligible.length>8&&<AcademyField locale={locale}><label>{({fa:'جستجوی دوره',en:'Search courses',sv:'Sök kurser',de:'Kurse suchen'})[locale]}<input type="search" value={courseSearch} onChange={e=>setCourseSearch(e.target.value)}/></label></AcademyField>}
        <div className="academy-field-help">        <label>
          {t.course}
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
            <option value="">{t.choose}</option>
            {eligible.filter(course=>course.id===courseId||[localized(course.title_i18n,locale),course.level_code].join(' ').toLocaleLowerCase().includes(courseSearch.toLocaleLowerCase())).map((course) => (
              <option value={course.id} key={course.id}>
                {localized(course.title_i18n, locale)} · {course.level_code}
              </option>
            ))}
          </select>
        </label><AcademyHelp locale={locale} text={{fa:'دوره‌ای را که می‌خواهید با این استاد بگذرانید انتخاب کنید.',en:'Choose the course you want to study with this teacher.',sv:'Välj kursen du vill läsa med läraren.',de:'Wählen Sie den Kurs bei dieser Lehrkraft.'}}/></div>

{slots.length>8&&<AcademyField locale={locale}><label>{({fa:'جستجوی زمان',en:'Search times',sv:'Sök tider',de:'Zeiten suchen'})[locale]}<input type="search" value={slotSearch} onChange={e=>setSlotSearch(e.target.value)}/></label></AcademyField>}
                <div className="academy-field-help">        <label>
          {t.slot}
          <select
            value={slotId}
            onChange={(event) => {
              setSlotId(event.target.value)
              if (event.target.value) setCustomStart('')
            }}
          >
            <option value="">{t.customOption}</option>
            {slots.filter(slot=>slot.id===slotId||localDateTime(slot.starts_at).toLocaleLowerCase().includes(slotSearch.toLocaleLowerCase())).map((slot) => (
              <option value={slot.id} key={slot.id} disabled={slot.status==='busy'}>
                {localDateTime(slot.starts_at)} · {slot.status==='busy' ? ({en:'Busy',fa:'رزرو شده',sv:'Bokad',de:'Belegt'}[locale]) : slot.delivery_mode}
              </option>
            ))}
          </select>
        </label><AcademyHelp locale={locale} text={{fa:'زمان آزاد استاد را انتخاب کنید؛ در صورت نبودن زمان مناسب، زمان دیگری پیشنهاد دهید.',en:'Choose an available time or suggest another below.',sv:'Välj en ledig tid eller föreslå en annan nedan.',de:'Wählen Sie einen freien Termin oder schlagen Sie unten einen anderen vor.'}}/></div>
        {slots.length === 0 && <p className="academy-help">{t.noSlots}</p>}

        <div className="academy-field-help">        <label>
          {t.custom}
          <input
            aria-label={t.custom}
            title={t.custom}
            type="datetime-local"
            value={customStart}
            disabled={Boolean(slotId)}
            onChange={(event) => setCustomStart(event.target.value)}
          />
        </label><AcademyHelp locale={locale} text={{fa:'تاریخ و ساعت پیشنهادی خود را به وقت دستگاه وارد کنید.',en:'Enter your preferred date and time in your device time zone.',sv:'Ange önskat datum och tid enligt enhetens tidszon.',de:'Geben Sie Datum und Uhrzeit in der Zeitzone Ihres Geräts ein.'}}/></div>

        <AcademyField locale={locale}><label>{{fa:'نوع جلسه',sv:'Lektionstyp',de:'Unterrichtsart',en:'Lesson type'}[locale]}<select value={sessionType} onChange={e=>setSessionType(e.target.value)}><option value="trial">{{fa:'آزمایشی',sv:'Prova på',de:'Probestunde',en:'Trial'}[locale]}</option><option value="individual">{{fa:'خصوصی',sv:'Enskild',de:'Einzelunterricht',en:'Individual'}[locale]}</option><option value="small_group">{{fa:'گروه کوچک',sv:'Liten grupp',de:'Kleingruppe',en:'Small group'}[locale]}</option><option value="offline_intro">{{fa:'معرفی حضوری',sv:'Introduktion på plats',de:'Einführung vor Ort',en:'Offline introduction'}[locale]}</option></select></label></AcademyField>
        <div className="academy-field-help">        <label>
          {t.message}
          <textarea placeholder={({fa:'مثلاً می‌خواهم روی مکالمه و تلفظ تمرکز کنم.',en:'e.g. I would like to focus on conversation and pronunciation.',sv:'Till exempel: jag vill fokusera på samtal och uttal.',de:'Zum Beispiel: Ich möchte Konversation und Aussprache üben.'})[locale]} value={message} maxLength={3000} onChange={(event) => setMessage(event.target.value)} />
        </label><AcademyHelp locale={locale} text={{fa:'در صورت تمایل نیاز یا هدف خود را برای استاد بنویسید.',en:'Optionally tell the teacher about your goals or needs.',sv:'Beskriv gärna dina mål eller behov för läraren.',de:'Beschreiben Sie optional Ihre Ziele oder Wünsche.'}}/></div>

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
