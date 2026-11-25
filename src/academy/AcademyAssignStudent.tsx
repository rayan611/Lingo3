import { useState } from 'react'
import { supabase } from '../auth/supabase'
import type { Locale } from './types'

type UserRow = { user_id: string; email: string | null; display_name: string | null }
type CourseOpt = { id: string; label: string }
type TeacherOpt = { id: string; label: string; courseIds: string[] }

const T: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Assign a student to a course and teacher',
    intro:
      'Find the student, choose the course and the teacher. This creates the enrollment and the classroom; the teacher can then fix lessons or the student can suggest times.',
    search: 'Search name or e-mail',
    find: 'Find',
    course: 'Course',
    teacher: 'Teacher',
    choose: 'Choose…',
    assign: 'Assign',
    done: 'Assigned. The classroom is ready.',
    none: 'No users found.',
    noTeacher: 'No active teacher offers this course.'
  },
  sv: {
    title: 'Tilldela en elev en kurs och lärare',
    intro:
      'Hitta eleven, välj kurs och lärare. Då skapas anmälan och klassrummet; läraren kan sedan lägga fasta lektioner eller så kan eleven föreslå tider.',
    search: 'Sök namn eller e-post',
    find: 'Sök',
    course: 'Kurs',
    teacher: 'Lärare',
    choose: 'Välj…',
    assign: 'Tilldela',
    done: 'Tilldelad. Klassrummet är klart.',
    none: 'Inga användare hittades.',
    noTeacher: 'Ingen aktiv lärare erbjuder kursen.'
  },
  fa: {
    title: 'اختصاص شاگرد به دوره و استاد',
    intro:
      'شاگرد را پیدا کنید و دوره و استاد را انتخاب کنید. ثبت‌نام و کلاس ساخته می‌شود؛ بعد استاد می‌تواند کلاس‌های ثابت بگذارد یا شاگرد زمان پیشنهاد دهد.',
    search: 'جستجوی نام یا ایمیل',
    find: 'جستجو',
    course: 'دوره',
    teacher: 'استاد',
    choose: 'انتخاب…',
    assign: 'اختصاص',
    done: 'اختصاص داده شد. کلاس آماده است.',
    none: 'کاربری پیدا نشد.',
    noTeacher: 'هیچ استاد فعالی این دوره را ندارد.'
  },
  de: {
    title: 'Lernende einem Kurs und einer Lehrkraft zuweisen',
    intro:
      'Person suchen, Kurs und Lehrkraft wählen. Das legt Anmeldung und Klassenraum an; danach kann die Lehrkraft feste Stunden planen oder die Person Zeiten vorschlagen.',
    search: 'Name oder E-Mail suchen',
    find: 'Suchen',
    course: 'Kurs',
    teacher: 'Lehrkraft',
    choose: 'Wählen…',
    assign: 'Zuweisen',
    done: 'Zugewiesen. Der Klassenraum ist bereit.',
    none: 'Keine Nutzer gefunden.',
    noTeacher: 'Keine aktive Lehrkraft für diesen Kurs.'
  }
}

/** Admin: put a student straight into a course with a chosen teacher. */
export function AcademyAssignStudent({
  locale,
  courses,
  teachers,
  onDone
}: {
  locale: Locale
  courses: CourseOpt[]
  teachers: TeacherOpt[]
  onDone: () => void
}) {
  const t = T[locale]
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<UserRow[] | null>(null)
  const [student, setStudent] = useState<UserRow | null>(null)
  const [course, setCourse] = useState('')
  const [teacher, setTeacher] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const teacherOptions = teachers.filter(x => x.courseIds.includes(course))

  async function search() {
    setMessage('')
    const { data, error } = await supabase().rpc('academy_admin_search_users', {
      p_query: query.trim(),
      p_limit: 8
    })
    if (error) setMessage(error.message)
    else setMatches((data ?? []) as UserRow[])
  }
  async function assign() {
    if (!student || !course || !teacher) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase().rpc('academy_admin_assign_student', {
      p_student: student.user_id,
      p_course: course,
      p_teacher: teacher
    })
    setBusy(false)
    if (error) setMessage(error.message)
    else {
      setMessage(t.done)
      onDone()
    }
  }

  return (
    <section className="ac-card ac-assign" aria-label={t.title}>
      <h3>{t.title}</h3>
      <p className="ac-muted">{t.intro}</p>
      <div className="ac-assign-search">
        <input
          type="search"
          aria-label={t.search}
          placeholder={t.search}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="ac-btn"
          disabled={query.trim().length < 2}
          onClick={() => void search()}
        >
          {t.find}
        </button>
      </div>
      {matches && matches.length === 0 && <p className="ac-muted">{t.none}</p>}
      {matches && matches.length > 0 && !student && (
        <div className="ac-choice-list">
          {matches.map(u => (
            <button key={u.user_id} type="button" className="ac-choice" onClick={() => setStudent(u)}>
              <strong>{u.display_name || u.email}</strong>
              <small>{u.email}</small>
            </button>
          ))}
        </div>
      )}
      {student && (
        <>
          <p>
            <strong>{student.display_name || student.email}</strong>{' '}
            <button type="button" className="small-link" onClick={() => setStudent(null)}>
              ×
            </button>
          </p>
          <label>
            {t.course}
            <select
              value={course}
              onChange={e => {
                setCourse(e.target.value)
                setTeacher('')
              }}
            >
              <option value="">{t.choose}</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {course && teacherOptions.length === 0 && <p className="ac-muted">{t.noTeacher}</p>}
          {course && teacherOptions.length > 0 && (
            <label>
              {t.teacher}
              <select value={teacher} onChange={e => setTeacher(e.target.value)}>
                <option value="">{t.choose}</option>
                {teacherOptions.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="ac-btn primary"
            disabled={busy || !course || !teacher}
            onClick={() => void assign()}
          >
            {t.assign}
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
