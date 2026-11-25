import { useState } from 'react'
import {
  PLACEMENT,
  PLACEMENT_LANGS,
  scorePlacement,
  type PlacementLang,
  type PlacementLevel
} from './placementQuestions'
import type { Locale } from './types'

const T: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Check your level',
    intro:
      'Twelve short questions, about three minutes. No sign-up needed. The result is an estimate; your teacher confirms it in the first lesson.',
    language: 'Language',
    start: 'Start the test',
    question: 'Question',
    of: 'of',
    next: 'Next',
    finish: 'See my level',
    result: 'Your estimated level',
    score: 'correct answers',
    again: 'Try again',
    courses: 'See matching courses',
    teachers: 'Find a teacher',
    Swedish: 'Swedish',
    English: 'English'
  },
  sv: {
    title: 'Testa din nivå',
    intro:
      'Tolv korta frågor, ungefär tre minuter. Ingen registrering behövs. Resultatet är en uppskattning som läraren bekräftar vid första lektionen.',
    language: 'Språk',
    start: 'Starta testet',
    question: 'Fråga',
    of: 'av',
    next: 'Nästa',
    finish: 'Visa min nivå',
    result: 'Din uppskattade nivå',
    score: 'rätta svar',
    again: 'Försök igen',
    courses: 'Visa passande kurser',
    teachers: 'Hitta en lärare',
    Swedish: 'Svenska',
    English: 'Engelska'
  },
  fa: {
    title: 'سطح خود را بسنجید',
    intro:
      'دوازده سؤال کوتاه، حدود سه دقیقه. نیازی به ثبت‌نام نیست. نتیجه یک برآورد است و استاد آن را در جلسهٔ اول تأیید می‌کند.',
    language: 'زبان',
    start: 'شروع آزمون',
    question: 'سؤال',
    of: 'از',
    next: 'بعدی',
    finish: 'نمایش سطح من',
    result: 'سطح برآوردشدهٔ شما',
    score: 'پاسخ درست',
    again: 'تلاش دوباره',
    courses: 'دوره‌های مناسب',
    teachers: 'استاد پیدا کن',
    Swedish: 'سوئدی',
    English: 'انگلیسی'
  },
  de: {
    title: 'Testen Sie Ihr Niveau',
    intro:
      'Zwölf kurze Fragen, etwa drei Minuten. Keine Anmeldung nötig. Das Ergebnis ist eine Schätzung; die Lehrkraft bestätigt sie in der ersten Stunde.',
    language: 'Sprache',
    start: 'Test starten',
    question: 'Frage',
    of: 'von',
    next: 'Weiter',
    finish: 'Mein Niveau anzeigen',
    result: 'Ihr geschätztes Niveau',
    score: 'richtige Antworten',
    again: 'Nochmal',
    courses: 'Passende Kurse',
    teachers: 'Lehrkraft finden',
    Swedish: 'Schwedisch',
    English: 'Englisch'
  }
}

/** A short multiple-choice level check that works without an account. */
export function AcademyPlacement({
  locale,
  onResult,
  onCourses,
  onTeachers
}: {
  locale: Locale
  onResult: (lang: PlacementLang, level: PlacementLevel) => void
  onCourses: () => void
  onTeachers: (lang: PlacementLang) => void
}) {
  const t = T[locale]
  const [lang, setLang] = useState<PlacementLang>('sv')
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [done, setDone] = useState<{ level: PlacementLevel; correct: number; total: number } | null>(null)

  const questions = PLACEMENT[lang]
  const current = questions[index]

  function finish(list: (number | null)[]) {
    const result = scorePlacement(lang, list)
    setDone(result)
    try {
      localStorage.setItem(
        'lingo3.placement.' + lang,
        JSON.stringify({ level: result.level, at: Date.now() })
      )
    } catch {
      /* storage may be blocked; the result is still shown */
    }
    onResult(lang, result.level)
  }

  function reset() {
    setStarted(false)
    setIndex(0)
    setAnswers([])
    setDone(null)
  }

  return (
    <section className="ac-card ac-placement" aria-label={t.title}>
      <h3>{t.title}</h3>
      {!started && !done && (
        <>
          <p className="ac-muted">{t.intro}</p>
          <div className="ac-filter-chips" role="radiogroup" aria-label={t.language}>
            {PLACEMENT_LANGS.map(code => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={lang === code}
                className={'ac-chip-btn' + (lang === code ? ' on' : '')}
                onClick={() => setLang(code)}
              >
                {code === 'sv' ? t.Swedish : t.English}
              </button>
            ))}
          </div>
          <button type="button" className="ac-btn primary" onClick={() => setStarted(true)}>
            {t.start}
          </button>
        </>
      )}
      {started && !done && current && (
        <>
          <p className="ac-muted">
            {t.question} {index + 1} {t.of} {questions.length}
          </p>
          <progress max={questions.length} value={index} aria-label={t.question} />
          <p className="ac-question" lang={lang}>
            {current.q}
          </p>
          <div className="ac-choice-list" role="radiogroup" aria-label={current.q}>
            {current.options.map((option, i) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={answers[index] === i}
                lang={lang}
                className={'ac-choice' + (answers[index] === i ? ' on' : '')}
                onClick={() => setAnswers(list => Object.assign([...list], { [index]: i }))}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ac-btn primary"
            disabled={answers[index] == null}
            onClick={() => {
              if (index + 1 < questions.length) setIndex(index + 1)
              else finish(answers)
            }}
          >
            {index + 1 < questions.length ? t.next : t.finish}
          </button>
        </>
      )}
      {done && (
        <>
          <p className="ac-muted">{t.result}</p>
          <p className="ac-level-big">{done.level}</p>
          <p className="ac-muted">
            {done.correct} / {done.total} {t.score}
          </p>
          <div className="ac-teacher-actions">
            <button type="button" className="ac-btn primary" onClick={() => onTeachers(lang)}>
              {t.teachers}
            </button>
            <button type="button" className="ac-btn" onClick={onCourses}>
              {t.courses}
            </button>
            <button type="button" className="ac-btn" onClick={reset}>
              {t.again}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
