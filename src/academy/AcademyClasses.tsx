import { academyStatus } from './statusLabels'
import { AcademyFormHelp } from './AcademyHelp'
import { AcademyField } from './AcademyField'
import { AcademyHelp } from './AcademyHelp'
import { AcademyWeek } from './AcademyWeek'
import { workspaceLabel } from './workspaceLabels'
import { AcademyMakeup } from './AcademyScheduling'
import { AcademyClassFeed } from './AcademyClassFeed'
import { useEffect, useState } from 'react'
import { supabase } from '../auth/supabase'
type ClassRow = {
  id: string
  teacher_id: string
  course_id: string
  title: string
  capacity: number
  status: string
}
type Session = {
  id: string
  class_id: string
  starts_at: string
  ends_at: string
  timezone: string
  status: string
  meeting_url: string | null
  meeting_backup_url: string | null
  summary: string | null
}
type Person = { user_id: string; display_name: string }
type Notice = { id: string; body: string; event: string; read_at: string | null; class_id: string }
type Course = { id: string; title_i18n: Record<string, string> }
export function AcademyClasses({
  locale,
  userId,
  teacherId,
  courses,
  isAdmin = false,
  onOpenSpace,
  onScheduleChanged
}: {
  onOpenSpace?: (id: string) => void
  onScheduleChanged?: () => void
  locale: string
  userId: string
  teacherId?: string
  isAdmin?: boolean
  courses: Course[]
}) {
  const [classes, setClasses] = useState<ClassRow[]>([]),
    [sessions, setSessions] = useState<Session[]>([]),
    [notices, setNotices] = useState<Notice[]>([])
  const [classSearch, setClassSearch] = useState('')
  const [selected, setSelected] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [title, setTitle] = useState(''),
    [course, setCourse] = useState(''),
    [capacity, setCapacity] = useState('1')
  const [query, setQuery] = useState(''),
    [matches, setMatches] = useState<Person[]>([]),
    [members, setMembers] = useState<
      { student_id: string; display_name?: string; learning_space_id?: string; status?: string }[]
    >([])
  const [start, setStart] = useState(''),
    [zone, setZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone),
    [duration, setDuration] = useState('60'),
    [repeat, setRepeat] = useState('once'),
    [count, setCount] = useState('1')
  const [preview, setPreview] = useState(false)
  const [openClasses, setOpenClasses] = useState<
    { id: string; title: string; teacher_name: string; places: number; sessions: { starts_at: string }[] }[]
  >([])
  const [joinRequests, setJoinRequests] = useState<
    {
      id: string
      class_id: string
      student_id: string
      message: string
      status: string
      expires_at: string
    }[]
  >([])
  const [activeSession, setActiveSession] = useState(''),
    [reason, setReason] = useState(''),
    [meeting, setMeeting] = useState(''),
    [backup, setBackup] = useState('')
  const [requests, setRequests] = useState<
    { id: string; session_id: string; student_id: string; reason: string; status: string }[]
  >([])
  const current = classes.find(c => c.id === selected)
  const canManage = Boolean(current && (isAdmin || teacherId === current.teacher_id))
  useEffect(() => {
    let active = true
    setClasses([])
    setSessions([])
    setNotices([])
    Promise.all([
      supabase().from('academy_classes').select('*').order('created_at', { ascending: false }),
      supabase().from('academy_class_sessions').select('*').order('starts_at'),
      supabase()
        .from('academy_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase().from('academy_session_requests').select('*').eq('status', 'pending'),
      supabase().rpc('academy_open_classes'),
      supabase()
        .from('academy_class_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
    ])
      .then(results => {
        if (!active) return
        const failure = results.find(r => r.error)?.error
        if (failure) {
          setError(failure.message)
          return
        }
        setClasses(results[0].data ?? [])
        setSessions(results[1].data ?? [])
        setNotices(results[2].data ?? [])
        setRequests(results[3].data ?? [])
        setOpenClasses(results[4].data ?? [])
        setJoinRequests(results[5].data ?? [])
      })
      .catch(e => {
        if (active) setError(String(e))
      })
    return () => {
      active = false
    }
  }, [userId, revision])
  useEffect(() => {
    let active = true
    setMembers([])
    setMatches([])
    setQuery('')
    setPreview(false)
    if (selected)
      void Promise.resolve(
        canManage
          ? supabase().rpc('academy_class_roster', { p_class: selected })
          : supabase()
              .from('academy_class_members')
              .select('student_id,learning_space_id,status')
              .eq('class_id', selected)
              .eq('status', 'active')
      ).then(({ data, error }) => {
        if (active) {
          if (error) setError(error.message)
          else setMembers(data ?? [])
        }
      })
    return () => {
      active = false
    }
  }, [selected, revision, canManage])
  async function action(name: string, args: Record<string, unknown>) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const { error, data } = await supabase().rpc(name, args)
      if (error) throw error
      setRevision(n => n + 1)
      onScheduleChanged?.()
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  async function search() {
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase().rpc('academy_teacher_find_students', { p_query: query.trim() })
      if (error) throw error
      setMatches(data ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="academy-card" aria-busy={busy}>
      <summary>{workspaceLabel(locale, 'کلاس‌ها و برنامهٔ جلسات', 'Classes and schedule')}</summary>
      {error && <p role="alert">{error}</p>}
      <details>
        <summary>
          {workspaceLabel(locale, 'اعلان‌ها', 'Notifications')} ({notices.filter(n => !n.read_at).length})
        </summary>
        {notices.map(n => (
          <div className="academy-card" key={n.id}>
            <p>{n.body}</p>
            <button
              disabled={busy}
              onClick={() => {
                setSelected(n.class_id)
                void action('academy_read_notification', { p_id: n.id })
              }}
            >
              {workspaceLabel(locale, 'مشاهدهٔ کلاس', 'Open class')}
            </button>
          </div>
        ))}
      </details>
      {!teacherId && (
        <details>
          <summary>
            {workspaceLabel(locale, 'کلاس‌های گروهی قابل ثبت‌نام', 'Available group classes')}
          </summary>
          {openClasses.map(c => (
            <article className="academy-card" key={c.id}>
              <strong>{c.title}</strong>
              <p>
                {c.teacher_name} · {c.places} {workspaceLabel(locale, 'جای خالی', 'places available')}
              </p>
              {c.sessions?.map(session => (
                <p key={session.starts_at}>{new Date(session.starts_at).toLocaleString(locale)}</p>
              ))}
              <button
                disabled={
                  busy ||
                  c.places < 1 ||
                  joinRequests.some(
                    r => r.class_id === c.id && r.status === 'pending' && new Date(r.expires_at) > new Date()
                  )
                }
                onClick={() => void action('academy_request_class', { p_class: c.id, p_message: '' })}
              >
                {workspaceLabel(locale, 'درخواست ثبت‌نام', 'Request enrollment')}
              </button>
            </article>
          ))}
        </details>
      )}
      {joinRequests
        .filter(r => r.status === 'pending' && new Date(r.expires_at) > new Date())
        .map(r => (
          <article className="academy-card" key={r.id}>
            <strong>
              {classes.find(c => c.id === r.class_id)?.title ||
                openClasses.find(c => c.id === r.class_id)?.title}
            </strong>
            <p>{r.message}</p>
            <small>
              {workspaceLabel(locale, 'مهلت پاسخ', 'Response deadline')}{' '}
              {new Date(r.expires_at).toLocaleString(locale)}
            </small>
            {r.student_id === userId ? (
              <button
                disabled={busy}
                onClick={() =>
                  void action('academy_resolve_class_request', { p_request: r.id, p_status: 'withdrawn' })
                }
              >
                {workspaceLabel(locale, 'پس‌گرفتن درخواست', 'Withdraw request')}
              </button>
            ) : (
              <div className="academy-card-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void action('academy_resolve_class_request', { p_request: r.id, p_status: 'accepted' })
                  }
                >
                  {workspaceLabel(locale, 'پذیرش', 'Accept')}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action('academy_resolve_class_request', { p_request: r.id, p_status: 'rejected' })
                  }
                >
                  {workspaceLabel(locale, 'رد', 'Reject')}
                </button>
              </div>
            )}
          </article>
        ))}
      {teacherId && (
        <details>
          <summary>{workspaceLabel(locale, 'ساخت کلاس', 'Create class')}</summary>
          <form
            onSubmit={async e => {
              e.preventDefault()
              const id = await action('academy_create_class', {
                p_teacher: teacherId,
                p_course: course,
                p_title: title,
                p_capacity: Number(capacity)
              })
              if (id) {
                setSelected(id)
                setTitle('')
              }
            }}
          >
            <AcademyFormHelp locale={locale} />
            <div className="academy-field-help">
              <label>
                {workspaceLabel(locale, 'عنوان کلاس', 'Class title')}
                <input
                  required
                  value={title}
                  placeholder={workspaceLabel(
                    locale,
                    'مثلاً گروه سوئدی سه‌شنبه',
                    'e.g. Tuesday Swedish group'
                  )}
                  onChange={e => setTitle(e.target.value)}
                />
              </label>
              <AcademyHelp
                locale={(['fa', 'sv', 'de'].includes(locale) ? locale : 'en') as 'fa' | 'sv' | 'de' | 'en'}
                text={{
                  fa: 'نامی برای تشخیص این کلاس وارد کنید.',
                  en: 'Enter a name that identifies this class.',
                  sv: 'Ange ett namn som identifierar klassen.',
                  de: 'Geben Sie einen Namen zur Identifikation der Klasse ein.'
                }}
              />
            </div>
            <AcademyField locale={locale}>
              <label>
                {workspaceLabel(locale, 'دوره', 'Course')}
                <select required value={course} onChange={e => setCourse(e.target.value)}>
                  <option value="">—</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title_i18n[locale] || c.title_i18n.en}
                    </option>
                  ))}
                </select>
              </label>
            </AcademyField>
            <div className="academy-field-help">
              <label>
                {workspaceLabel(locale, 'ظرفیت', 'Capacity')}
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                />
              </label>
              <AcademyHelp
                locale={(['fa', 'sv', 'de'].includes(locale) ? locale : 'en') as 'fa' | 'sv' | 'de' | 'en'}
                text={{
                  fa: 'حداکثر تعداد دانشجویان کلاس را تعیین کنید.',
                  en: 'Set the maximum number of students in the class.',
                  sv: 'Ange högsta antal elever i klassen.',
                  de: 'Legen Sie die maximale Anzahl der Lernenden fest.'
                }}
              />
            </div>
            <button disabled={busy}>{workspaceLabel(locale, 'ساخت کلاس', 'Create class')}</button>
          </form>
        </details>
      )}
      <AcademyField locale={locale}>
        <label>
          {workspaceLabel(locale, 'جستجوی کلاس', 'Search classes')}
          <input type="search" value={classSearch} onChange={e => setClassSearch(e.target.value)} />
        </label>
      </AcademyField>
      <AcademyField locale={locale}>
        <label>
          {workspaceLabel(locale, 'کلاس', 'Class')}
          <select value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">—</option>
            {classes
              .filter(
                c =>
                  c.id === selected || c.title.toLocaleLowerCase().includes(classSearch.toLocaleLowerCase())
              )
              .map(c => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
        </label>
      </AcademyField>
      {current && (
        <>
          <h4>{current.title}</h4>
          <AcademyWeek
            locale={(['fa', 'sv', 'de'].includes(locale) ? locale : 'en') as 'fa' | 'sv' | 'de' | 'en'}
            events={sessions
              .filter(s => s.class_id === current.id && ['confirmed', 'completed'].includes(s.status))
              .map(s => ({
                id: s.id,
                start: s.starts_at,
                title: current.title,
                status: s.status,
                url: s.status === 'confirmed' ? s.meeting_url : null
              }))}
          />
          <AcademyMakeup
            key={current.id}
            classId={current.id}
            locale={locale}
            canManage={canManage}
            userId={userId}
            sessions={sessions.filter(s => s.class_id === current.id)}
            onChanged={() => {
              setRevision(n => n + 1)
              onScheduleChanged?.()
            }}
          />
          <AcademyClassFeed key={current.id} classId={current.id} locale={locale} canManage={canManage} />
          {canManage && (
            <div className="academy-card-actions">
              {members.map(m => (
                <button
                  key={m.student_id}
                  disabled={!m.learning_space_id}
                  onClick={() => m.learning_space_id && onOpenSpace?.(m.learning_space_id)}
                >
                  {m.display_name || m.student_id} ·{' '}
                  {workspaceLabel(locale, 'پروندهٔ آموزشی', 'Learning Space')}
                </button>
              ))}
            </div>
          )}
          {canManage && (
            <>
              <p>
                {members.length} / {current.capacity}
              </p>
              <AcademyField locale={locale}>
                <label>
                  {workspaceLabel(locale, 'نام یا شناسهٔ حساب دانشجو', 'Student name or account ID')}
                  <input
                    value={query}
                    placeholder={workspaceLabel(locale, 'حداقل سه حرف از نام', 'At least three letters')}
                    onChange={e => setQuery(e.target.value)}
                  />
                </label>
              </AcademyField>
              <button disabled={busy || query.trim().length < 3} onClick={search}>
                {workspaceLabel(locale, 'جستجو', 'Search')}
              </button>
              {matches.map(p => (
                <div className="academy-card" key={p.user_id}>
                  <strong>{p.display_name}</strong>
                  <small dir="ltr"> {p.user_id}</small>
                  <button
                    disabled={busy || members.some(m => m.student_id === p.user_id)}
                    onClick={() =>
                      void action('academy_add_class_member', { p_class: selected, p_student: p.user_id })
                    }
                  >
                    {workspaceLabel(locale, 'افزودن به کلاس', 'Add to class')}
                  </button>
                </div>
              ))}
              <form
                onSubmit={e => {
                  e.preventDefault()
                  setPreview(true)
                }}
              >
                <AcademyFormHelp locale={locale} />
                <div className="academy-field-help">
                  <label>
                    {workspaceLabel(locale, 'اولین جلسه', 'First session')}
                    <input
                      required
                      type="datetime-local"
                      value={start}
                      onChange={e => {
                        setStart(e.target.value)
                        setPreview(false)
                      }}
                    />
                  </label>
                  <AcademyHelp
                    locale={
                      (['fa', 'sv', 'de'].includes(locale) ? locale : 'en') as 'fa' | 'sv' | 'de' | 'en'
                    }
                    text={{
                      fa: 'تاریخ و ساعت اولین جلسه را انتخاب کنید.',
                      en: 'Choose the date and time of the first session.',
                      sv: 'Välj datum och tid för första lektionen.',
                      de: 'Wählen Sie Datum und Uhrzeit der ersten Stunde.'
                    }}
                  />
                </div>
                <div className="academy-field-help">
                  <label>
                    {workspaceLabel(locale, 'منطقهٔ زمانی', 'Time zone')}
                    <input
                      required
                      value={zone}
                      placeholder="Europe/Stockholm"
                      onChange={e => {
                        setZone(e.target.value)
                        setPreview(false)
                      }}
                    />
                  </label>
                  <AcademyHelp
                    locale={
                      (['fa', 'sv', 'de'].includes(locale) ? locale : 'en') as 'fa' | 'sv' | 'de' | 'en'
                    }
                    text={{
                      fa: 'منطقه زمانی کلاس را بررسی کنید؛ نمونه Europe/Stockholm است.',
                      en: 'Check the class time zone, for example Europe/Stockholm.',
                      sv: 'Kontrollera klassens tidszon, till exempel Europe/Stockholm.',
                      de: 'Prüfen Sie die Zeitzone, zum Beispiel Europe/Stockholm.'
                    }}
                  />
                </div>
                <AcademyField locale={locale}>
                  <label>
                    {workspaceLabel(locale, 'مدت به دقیقه', 'Duration in minutes')}
                    <input
                      required
                      type="number"
                      min="15"
                      max="240"
                      value={duration}
                      onChange={e => {
                        setDuration(e.target.value)
                        setPreview(false)
                      }}
                    />
                  </label>
                </AcademyField>
                <div className="academy-field-help">
                  <label>
                    {workspaceLabel(locale, 'تکرار', 'Repeat')}
                    <select
                      value={repeat}
                      onChange={e => {
                        setRepeat(e.target.value)
                        setCount('1')
                        setPreview(false)
                      }}
                    >
                      <option value="once">{workspaceLabel(locale, 'یک‌بار', 'Once')}</option>
                      <option value="daily">{workspaceLabel(locale, 'روزانه', 'Daily')}</option>
                      <option value="weekly">{workspaceLabel(locale, 'هفتگی', 'Weekly')}</option>
                    </select>
                  </label>
                  <AcademyHelp
                    locale={
                      (['fa', 'sv', 'de'].includes(locale) ? locale : 'en') as 'fa' | 'sv' | 'de' | 'en'
                    }
                    text={{
                      fa: 'انتخاب کنید جلسه یک بار، روزانه یا هفتگی برگزار شود.',
                      en: 'Choose a single, daily or weekly schedule.',
                      sv: 'Välj enstaka, dagligt eller veckovis schema.',
                      de: 'Wählen Sie einen einmaligen, täglichen oder wöchentlichen Termin.'
                    }}
                  />
                </div>
                <AcademyField locale={locale}>
                  <label>
                    {workspaceLabel(locale, 'تعداد جلسات', 'Session count')}
                    <input
                      required
                      disabled={repeat === 'once'}
                      type="number"
                      min="1"
                      max="100"
                      value={count}
                      onChange={e => {
                        setCount(e.target.value)
                        setPreview(false)
                      }}
                    />
                  </label>
                </AcademyField>
                <button disabled={busy}>{workspaceLabel(locale, 'پیش‌نمایش', 'Preview')}</button>
              </form>
              {preview && (
                <div>
                  <p>
                    {zone} · {duration} min
                  </p>
                  <ol>
                    {Array.from({ length: Math.min(100, Number(count)) }, (_, i) => {
                      const d = new Date(start + 'Z')
                      d.setUTCDate(
                        d.getUTCDate() + i * (repeat === 'weekly' ? 7 : repeat === 'daily' ? 1 : 0)
                      )
                      return <li key={i}>{d.toISOString().slice(0, 16).replace('T', ' ')}</li>
                    })}
                  </ol>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action('academy_schedule_class', {
                        p_class: selected,
                        p_start: start,
                        p_timezone: zone,
                        p_minutes: Number(duration),
                        p_repeat: repeat,
                        p_count: Number(count)
                      }).then(result => {
                        if (result) setPreview(false)
                      })
                    }
                  >
                    {workspaceLabel(locale, 'ثبت برنامه', 'Save schedule')}
                  </button>
                </div>
              )}
            </>
          )}
          {sessions
            .filter(s => s.class_id === selected)
            .map(s => (
              <article className="academy-card" key={s.id}>
                <time dateTime={s.starts_at}>
                  {new Date(s.starts_at).toLocaleString(locale)} —{' '}
                  {new Date(s.ends_at).toLocaleTimeString(locale)}
                </time>
                <small> {academyStatus(s.status, locale)}</small>
                {s.status === 'confirmed' && s.meeting_url && (
                  <a href={s.meeting_url} target="_blank" rel="noreferrer">
                    {workspaceLabel(locale, 'ورود به کلاس', 'Join meeting')}
                  </a>
                )}
                {s.status === 'confirmed' && s.meeting_backup_url && (
                  <a href={s.meeting_backup_url} target="_blank" rel="noreferrer">
                    {workspaceLabel(locale, 'لینک جایگزین', 'Backup meeting')}
                  </a>
                )}
                {s.summary && <p>{s.summary}</p>}
                <button
                  disabled={busy}
                  onClick={() => {
                    setActiveSession(s.id)
                    setReason('')
                    setMeeting(s.meeting_url || '')
                    setBackup(s.meeting_backup_url || '')
                  }}
                >
                  {workspaceLabel(locale, 'مدیریت جلسه', 'Session actions')}
                </button>
                {activeSession === s.id && (
                  <div>
                    <AcademyField locale={locale}>
                      <label>
                        {workspaceLabel(locale, 'توضیح یا خلاصهٔ جلسه', 'Reason or lesson summary')}
                        <textarea
                          value={reason}
                          placeholder={workspaceLabel(
                            locale,
                            'دلیل درخواست یا موضوع جلسه را بنویسید',
                            'Write the reason or lesson summary'
                          )}
                          onChange={e => setReason(e.target.value)}
                        />
                      </label>
                    </AcademyField>
                    {s.status === 'confirmed' && new Date(s.starts_at) > new Date() && (
                      <button
                        disabled={busy || !reason.trim()}
                        onClick={() =>
                          void action('academy_session_action', {
                            p_session: s.id,
                            p_action: canManage ? 'cancel' : 'request_cancel',
                            p_data: { reason }
                          })
                        }
                      >
                        {canManage
                          ? workspaceLabel(locale, 'لغو جلسه', 'Cancel session')
                          : workspaceLabel(locale, 'درخواست لغو', 'Request cancellation')}
                      </button>
                    )}
                    {canManage && (
                      <>
                        <AcademyField locale={locale}>
                          <label>
                            {workspaceLabel(locale, 'لینک جلسه', 'Meeting link')}
                            <input
                              type="url"
                              placeholder="https://zoom.us/j/..."
                              value={meeting}
                              onChange={e => setMeeting(e.target.value)}
                            />
                          </label>
                        </AcademyField>
                        <AcademyField locale={locale}>
                          <label>
                            {workspaceLabel(locale, 'لینک جایگزین', 'Backup link')}
                            <input
                              type="url"
                              placeholder="https://teams.microsoft.com/..."
                              value={backup}
                              onChange={e => setBackup(e.target.value)}
                            />
                          </label>
                        </AcademyField>
                        <button
                          disabled={busy || s.status !== 'confirmed'}
                          onClick={() =>
                            void action('academy_session_action', {
                              p_session: s.id,
                              p_action: 'meeting',
                              p_data: { url: meeting, backup }
                            })
                          }
                        >
                          {workspaceLabel(locale, 'ذخیرهٔ لینک', 'Save links')}
                        </button>
                        {new Date(s.ends_at) <= new Date() && s.status !== 'cancelled' && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void action('academy_session_action', {
                                  p_session: s.id,
                                  p_action: 'complete',
                                  p_data: { summary: reason }
                                })
                              }
                            >
                              {workspaceLabel(locale, 'ثبت پایان و خلاصه', 'Complete and save summary')}
                            </button>
                            {members.map(m => (
                              <AcademyField locale={locale} key={m.student_id}>
                                <label key={m.student_id}>
                                  {m.display_name || m.student_id}
                                  <select
                                    defaultValue=""
                                    disabled={busy}
                                    onChange={e =>
                                      void action('academy_session_action', {
                                        p_session: s.id,
                                        p_action: 'attendance',
                                        p_data: { student_id: m.student_id, status: e.target.value }
                                      })
                                    }
                                  >
                                    <option value="">—</option>
                                    <option value="present">
                                      {workspaceLabel(locale, 'حاضر', 'Present')}
                                    </option>
                                    <option value="absent">{workspaceLabel(locale, 'غایب', 'Absent')}</option>
                                    <option value="excused">
                                      {workspaceLabel(locale, 'غیبت موجه', 'Excused')}
                                    </option>
                                  </select>
                                </label>
                              </AcademyField>
                            ))}
                          </>
                        )}
                        {requests
                          .filter(r => r.session_id === s.id)
                          .map(r => (
                            <div key={r.id}>
                              <p>{r.reason}</p>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void action('academy_session_action', {
                                    p_session: s.id,
                                    p_action: 'approve_cancel',
                                    p_data: { request_id: r.id }
                                  })
                                }
                              >
                                {workspaceLabel(locale, 'قبول لغو', 'Approve cancellation')}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void action('academy_session_action', {
                                    p_session: s.id,
                                    p_action: 'reject_cancel',
                                    p_data: { request_id: r.id }
                                  })
                                }
                              >
                                {workspaceLabel(locale, 'رد درخواست', 'Reject request')}
                              </button>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
        </>
      )}
    </details>
  )
}
