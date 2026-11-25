import { useState } from 'react'
import { supabase } from '../auth/supabase'
import { LANGUAGES, LANGS } from '../db/langs'
import { askConfirm } from './AcademyDialogs'
import type { Locale } from './types'

type WordDraft = { lang: string; word: string; meaning: string; example: string }
export type LessonOption = { id: string; label: string }

const T: Record<Locale, Record<string, string>> = {
  en: {
    title: 'After-class form',
    intro:
      'Fill this in after the lesson. The student sees it only when you publish, and the words go straight into their Lingo3 review.',
    session: 'Lesson',
    standalone: 'Not linked to a booked lesson',
    covered: 'What we learned',
    coveredPh: 'e.g. Everyday verbs and word order',
    weak: 'Weak point to work on',
    homework: 'Homework',
    words: 'New words (they appear in the student’s App review)',
    word: 'Word',
    meaning: 'Meaning',
    example: 'Example (optional)',
    add: 'Add word',
    remove: 'Remove',
    publish: 'Publish to student',
    confirm: 'Publish this lesson? The student is notified and the words are added to their review.',
    done: 'Published. Words added:',
    needCovered: 'Write what was covered first.',
    saving: 'Publishing…'
  },
  sv: {
    title: 'Efter lektionen',
    intro:
      'Fyll i efter lektionen. Eleven ser det först när du publicerar, och orden hamnar direkt i elevens Lingo3-repetition.',
    session: 'Lektion',
    standalone: 'Inte kopplad till bokad lektion',
    covered: 'Vad vi lärde oss',
    coveredPh: 't.ex. Vardagsverb och ordföljd',
    weak: 'Svag punkt att öva på',
    homework: 'Läxa',
    words: 'Nya ord (visas i elevens repetition)',
    word: 'Ord',
    meaning: 'Betydelse',
    example: 'Exempel (valfritt)',
    add: 'Lägg till ord',
    remove: 'Ta bort',
    publish: 'Publicera till eleven',
    confirm: 'Publicera lektionen? Eleven får en avisering och orden läggs till i repetitionen.',
    done: 'Publicerat. Tillagda ord:',
    needCovered: 'Skriv först vad ni gick igenom.',
    saving: 'Publicerar…'
  },
  fa: {
    title: 'فرم بعد از کلاس',
    intro:
      'بعد از کلاس این فرم را پر کنید. شاگرد فقط پس از انتشار آن را می‌بیند و کلمه‌ها مستقیم به مرور لینگو۳ او اضافه می‌شوند.',
    session: 'جلسه',
    standalone: 'بدون ارتباط با جلسهٔ رزروشده',
    covered: 'چه چیزی یاد گرفتیم',
    coveredPh: 'مثلاً افعال روزمره و ترتیب کلمات',
    weak: 'نقطهٔ ضعف برای تمرین',
    homework: 'تکلیف',
    words: 'کلمه‌های جدید (در مرور اپ شاگرد ظاهر می‌شوند)',
    word: 'کلمه',
    meaning: 'معنی',
    example: 'مثال (اختیاری)',
    add: 'افزودن کلمه',
    remove: 'حذف',
    publish: 'انتشار برای شاگرد',
    confirm: 'این جلسه منتشر شود؟ شاگرد اطلاع می‌گیرد و کلمه‌ها به مرور او اضافه می‌شوند.',
    done: 'منتشر شد. کلمه‌های اضافه‌شده:',
    needCovered: 'ابتدا بنویسید چه مطالبی تدریس شد.',
    saving: 'در حال انتشار…'
  },
  de: {
    title: 'Nach dem Unterricht',
    intro:
      'Nach der Stunde ausfüllen. Der Lernende sieht es erst nach dem Veröffentlichen, die Wörter landen direkt in seiner Lingo3-Wiederholung.',
    session: 'Stunde',
    standalone: 'Keiner gebuchten Stunde zugeordnet',
    covered: 'Was wir gelernt haben',
    coveredPh: 'z. B. Alltagsverben und Wortstellung',
    weak: 'Schwachpunkt zum Üben',
    homework: 'Hausaufgabe',
    words: 'Neue Wörter (erscheinen in der Wiederholung)',
    word: 'Wort',
    meaning: 'Bedeutung',
    example: 'Beispiel (optional)',
    add: 'Wort hinzufügen',
    remove: 'Entfernen',
    publish: 'Für den Lernenden veröffentlichen',
    confirm: 'Stunde veröffentlichen? Der Lernende wird benachrichtigt und die Wörter werden hinzugefügt.',
    done: 'Veröffentlicht. Hinzugefügte Wörter:',
    needCovered: 'Bitte zuerst den Stoff beschreiben.',
    saving: 'Wird veröffentlicht…'
  }
}

/** Best-effort email to the student; the lesson is already published whatever happens here. */
async function notifyStudent(space: string, locale: Locale) {
  try {
    const { data } = await supabase().auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/academy-notify', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ space, locale })
    })
  } catch {
    /* email is optional */
  }
}

const blank = (lang: string): WordDraft => ({ lang, word: '', meaning: '', example: '' })

export function AcademyLessonForm({
  locale,
  spaceId,
  sessions,
  defaultLang,
  onPublished,
  onError
}: {
  locale: Locale
  spaceId: string
  sessions: LessonOption[]
  defaultLang: string
  onPublished: (message: string) => void
  onError: (message: string) => void
}) {
  const t = T[locale]
  const startLang = (LANGS as string[]).includes(defaultLang) ? defaultLang : 'sv'
  const [booking, setBooking] = useState('')
  const [covered, setCovered] = useState('')
  const [weak, setWeak] = useState('')
  const [homework, setHomework] = useState('')
  const [words, setWords] = useState<WordDraft[]>([blank(startLang)])
  const [busy, setBusy] = useState(false)

  const setWord = (i: number, patch: Partial<WordDraft>) =>
    setWords(rows => rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  async function publish() {
    if (!covered.trim()) {
      onError(t.needCovered)
      return
    }
    if (!(await askConfirm(t.confirm))) return
    setBusy(true)
    try {
      const { data, error } = await supabase().rpc('academy_publish_lesson', {
        p_space: spaceId,
        p_booking: booking || null,
        p_covered: covered,
        p_weak: weak,
        p_homework: homework,
        p_words: words.filter(w => w.word.trim())
      })
      if (error) throw error
      void notifyStudent(spaceId, locale)
      setCovered('')
      setWeak('')
      setHomework('')
      setBooking('')
      setWords([blank(words[0]?.lang ?? startLang)])
      onPublished(`${t.done} ${(data as { words_added?: number } | null)?.words_added ?? 0}`)
    } catch (e) {
      onError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ac-card academy-lesson-form" aria-label={t.title}>
      <h4>{t.title}</h4>
      <p className="ac-muted">{t.intro}</p>
      <label>
        {t.session}
        <select value={booking} onChange={e => setBooking(e.target.value)}>
          <option value="">{t.standalone}</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.covered}
        <textarea
          value={covered}
          placeholder={t.coveredPh}
          maxLength={4000}
          onChange={e => setCovered(e.target.value)}
        />
      </label>
      <label>
        {t.weak}
        <textarea value={weak} maxLength={2000} onChange={e => setWeak(e.target.value)} />
      </label>
      <label>
        {t.homework}
        <textarea value={homework} maxLength={2000} onChange={e => setHomework(e.target.value)} />
      </label>
      <fieldset className="academy-lesson-words">
        <legend>{t.words}</legend>
        {words.map((w, i) => (
          <div className="academy-lesson-word" key={i}>
            <select aria-label="Language" value={w.lang} onChange={e => setWord(i, { lang: e.target.value })}>
              {LANGS.map(code => (
                <option key={code} value={code}>
                  {LANGUAGES[code].native}
                </option>
              ))}
            </select>
            <input
              aria-label={t.word}
              placeholder={t.word}
              maxLength={80}
              value={w.word}
              onChange={e => setWord(i, { word: e.target.value })}
            />
            <input
              aria-label={t.meaning}
              placeholder={t.meaning}
              maxLength={200}
              value={w.meaning}
              onChange={e => setWord(i, { meaning: e.target.value })}
            />
            <input
              aria-label={t.example}
              placeholder={t.example}
              maxLength={300}
              value={w.example}
              onChange={e => setWord(i, { example: e.target.value })}
            />
            {words.length > 1 && (
              <button
                type="button"
                className="ac-btn"
                onClick={() => setWords(rows => rows.filter((_, k) => k !== i))}
              >
                {t.remove}
              </button>
            )}
          </div>
        ))}
        {words.length < 40 && (
          <button
            type="button"
            className="ac-btn"
            onClick={() => setWords(rows => [...rows, blank(rows[rows.length - 1]?.lang ?? startLang)])}
          >
            + {t.add}
          </button>
        )}
      </fieldset>
      <button type="button" className="ac-btn primary" disabled={busy} onClick={() => void publish()}>
        {busy ? t.saving : t.publish}
      </button>
    </section>
  )
}
