import { useState } from 'react'
import { supabase } from '../auth/supabase'
import { userTimeZone } from './time'
import type { Locale } from './types'

type Row = { weekday: number; time: string }

const T: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Fix lessons for this student',
    intro:
      'Choose the weekdays and times that repeat each week. You can add several times on the same day. The student sees them as confirmed lessons.',
    from: 'First possible date',
    duration: 'Length',
    minutes: 'min',
    weeks: 'Number of weeks',
    day: 'Day',
    time: 'Time',
    add: 'Add another time',
    remove: 'Remove',
    schedule: 'Schedule lessons',
    zone: 'Times are in your time zone',
    total: 'lessons in total',
    done: 'Lessons scheduled:',
    skipped: 'skipped (time already taken):',
    failed: 'Could not schedule',
    days: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday'
  },
  sv: {
    title: 'Lägg fasta lektioner för eleven',
    intro:
      'Välj veckodagar och tider som upprepas varje vecka. Du kan lägga flera tider samma dag. Eleven ser dem som bekräftade lektioner.',
    from: 'Första möjliga datum',
    duration: 'Längd',
    minutes: 'min',
    weeks: 'Antal veckor',
    day: 'Dag',
    time: 'Tid',
    add: 'Lägg till en tid',
    remove: 'Ta bort',
    schedule: 'Schemalägg lektioner',
    zone: 'Tiderna är i din tidszon',
    total: 'lektioner totalt',
    done: 'Lektioner schemalagda:',
    skipped: 'hoppades över (tiden är upptagen):',
    failed: 'Kunde inte schemalägga',
    days: 'Måndag,Tisdag,Onsdag,Torsdag,Fredag,Lördag,Söndag'
  },
  fa: {
    title: 'تعیین کلاس‌های ثابت برای این شاگرد',
    intro:
      'روزها و ساعت‌هایی را که هر هفته تکرار می‌شوند انتخاب کنید. در یک روز می‌توانید چند ساعت بگذارید. شاگرد آن‌ها را به‌صورت کلاس تأییدشده می‌بیند.',
    from: 'اولین تاریخ ممکن',
    duration: 'مدت',
    minutes: 'دقیقه',
    weeks: 'تعداد هفته‌ها',
    day: 'روز',
    time: 'ساعت',
    add: 'افزودن ساعت دیگر',
    remove: 'حذف',
    schedule: 'ثبت کلاس‌ها',
    zone: 'ساعت‌ها به منطقهٔ زمانی شما',
    total: 'کلاس در مجموع',
    done: 'کلاس ثبت‌شده:',
    skipped: 'ردشده (زمان پر است):',
    failed: 'ثبت نشد',
    days: 'دوشنبه,سه‌شنبه,چهارشنبه,پنجشنبه,جمعه,شنبه,یکشنبه'
  },
  de: {
    title: 'Feste Stunden für diese Person',
    intro:
      'Wählen Sie Wochentage und Zeiten, die sich jede Woche wiederholen. Mehrere Zeiten pro Tag sind möglich. Die Person sieht sie als bestätigte Stunden.',
    from: 'Frühestes Datum',
    duration: 'Dauer',
    minutes: 'Min.',
    weeks: 'Anzahl Wochen',
    day: 'Tag',
    time: 'Zeit',
    add: 'Weitere Zeit hinzufügen',
    remove: 'Entfernen',
    schedule: 'Stunden planen',
    zone: 'Zeiten in Ihrer Zeitzone',
    total: 'Stunden insgesamt',
    done: 'Stunden geplant:',
    skipped: 'übersprungen (Zeit belegt):',
    failed: 'Planung nicht möglich',
    days: 'Montag,Dienstag,Mittwoch,Donnerstag,Freitag,Samstag,Sonntag'
  }
}

const tomorrow = () => {
  const d = new Date(Date.now() + 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Teacher or admin fixes repeating lessons for one student: several weekdays and times per week. */
export function AcademyScheduleStudent({
  spaceId,
  locale,
  onDone
}: {
  spaceId: string
  locale: Locale
  onDone: (message: string) => void
}) {
  const t = T[locale]
  const names = t.days.split(',')
  const [from, setFrom] = useState(tomorrow())
  const [minutes, setMinutes] = useState(60)
  const [weeks, setWeeks] = useState(4)
  const [rows, setRows] = useState<Row[]>([{ weekday: 1, time: '18:00' }])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit() {
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase().rpc('academy_teacher_schedule_student', {
        p_space: spaceId,
        p_from: from,
        p_timezone: userTimeZone(),
        p_minutes: minutes,
        p_slots: rows,
        p_weeks: weeks
      })
      if (error) throw error
      const result = data as { created: number; skipped: string[] }
      const skipped = result.skipped?.length ?? 0
      const text = `${t.done} ${result.created}${skipped ? ` · ${skipped} ${t.skipped} ${result.skipped.map(s => new Date(s).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })).join(', ')}` : ''}`
      setMessage(text)
      onDone(text)
    } catch (e) {
      const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
      setMessage(`${t.failed}: ${m}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ac-card ac-schedule" aria-label={t.title}>
      <h4>{t.title}</h4>
      <p className="ac-muted">{t.intro}</p>
      <div className="ac-schedule-rows">
        {rows.map((row, i) => (
          <div className="ac-schedule-row" key={i}>
            <select
              aria-label={t.day}
              value={row.weekday}
              onChange={e =>
                setRows(list => list.map((r, k) => (k === i ? { ...r, weekday: Number(e.target.value) } : r)))
              }
            >
              {names.map((name, k) => (
                <option key={name} value={k + 1}>
                  {name}
                </option>
              ))}
            </select>
            <input
              aria-label={t.time}
              type="time"
              value={row.time}
              onChange={e =>
                setRows(list => list.map((r, k) => (k === i ? { ...r, time: e.target.value } : r)))
              }
            />
            {rows.length > 1 && (
              <button
                type="button"
                className="ac-btn"
                onClick={() => setRows(list => list.filter((_, k) => k !== i))}
              >
                {t.remove}
              </button>
            )}
          </div>
        ))}
        {rows.length < 14 && (
          <button
            type="button"
            className="ac-btn"
            onClick={() =>
              setRows(list => [...list, { weekday: list[list.length - 1]?.weekday ?? 1, time: '18:00' }])
            }
          >
            + {t.add}
          </button>
        )}
      </div>
      <div className="ac-schedule-options">
        <label>
          {t.from}
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          {t.duration}
          <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
            {[30, 45, 60, 90, 120].map(m => (
              <option key={m} value={m}>
                {m} {t.minutes}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.weeks}
          <input
            type="number"
            min={1}
            max={12}
            value={weeks}
            onChange={e => setWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
          />
        </label>
      </div>
      <p className="ac-muted">
        {t.zone}: {userTimeZone()} · {rows.length * weeks} {t.total}
      </p>
      <button
        type="button"
        className="ac-btn primary"
        disabled={busy || !rows.every(r => r.time)}
        onClick={() => void submit()}
      >
        {t.schedule}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
