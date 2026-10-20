import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Grade } from 'ts-fsrs'
import { db } from '../db/db'
import { buildQueue, queueCounts, type QueueItem } from '../fsrs/queue'
import { SuggestionBox } from './Suggestions'
import { SpeakButton } from './SpeakButton'
import { ExampleSentence } from './ExampleSentence'
import { WordCard } from './WordCard'
import { formCandidates } from '../lib/highlight'
import { buildCloze } from '../lib/cloze'
import { sameWord } from '../lib/answer'
import {
  GRADES,
  GRADE_HINTS,
  GRADE_LABELS,
  formatInterval,
  gradeCard,
  previewIntervals,
} from '../fsrs/scheduler'
import {
  LANG_BCP47,
  LANG_NAMES,
  RTL_LANGS,
  activeTargets,
  type Card,
  type Lang,
  type Settings,
} from '../db/types'
import { genderBadge, morphLines } from '../lib/morphology'
import { speak, stopSpeaking } from '../lib/speak'

interface Props {
  settings: Settings
  onExit: () => void
}

export function Review({ settings, onExit }: Props) {
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [graded, setGraded] = useState<Record<string, Grade>>({})
  const [sessionCount, setSessionCount] = useState(0)
  const [sessionGrades, setSessionGrades] = useState<Record<string, { lang: Lang; grade: Grade }>>({})
  const [typed, setTyped] = useState('')
  const [typedVerdict, setTypedVerdict] = useState<'right' | 'wrong' | null>(null)
  const [topic, setTopic] = useState<string>('all')
  /** Upcoming languages the user chose to review early on this word. */
  const [extra, setExtra] = useState<Lang[]>([])
  /**
   * The full word page, opened from ⓘ on the card. Kept inside Review rather
   * than as a tab switch: switching tabs rebuilds the queue and loses your
   * place. A history entry is pushed so the phone's Back returns to the card.
   */
  const [detail, setDetail] = useState(false)
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (!e.state?.lingo3Detail) setDetail(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  function openDetail() {
    window.history.pushState({ ...(window.history.state ?? {}), lingo3Detail: true }, '')
    setDetail(true)
  }
  function closeDetail() {
    if (window.history.state?.lingo3Detail) window.history.back()
    else setDetail(false)
  }

  useEffect(() => {
    setQueue(null)
    setIndex(0)
    setSessionCount(0)
    setSessionGrades({})
    buildQueue(settings, 60, topic === 'all' ? null : topic).then(setQueue)
  }, [settings, topic])

  /** Every topic in use, from both the old category field and the new tags. */
  const topics = useLiveQuery(async () => {
    const concepts = await db.concepts.toArray()
    const set = new Set<string>()
    for (const c of concepts) {
      if (c.deletedAt) continue
      if (c.category) set.add(c.category)
      for (const t of c.tags ?? []) set.add(t)
    }
    return [...set].sort()
  }, [], [])

  /**
   * Focusing on a topic narrows what you see, never what is due. Showing the
   * global number next to the filtered one is what stops a month of restaurant
   * words quietly starving everything else.
   */
  const counts = useLiveQuery(
    async () => ({
      focused: (await queueCounts(settings, topic === 'all' ? null : topic)).total,
      overall: (await queueCounts(settings)).total,
    }),
    [settings, topic],
  )

  const item = queue?.[index]

  const advance = useCallback(() => {
    setRevealed(false)
    setGraded({})
    setTyped('')
    setTypedVerdict(null)
    setExtra([])
    setIndex((i) => i + 1)
    setSessionCount((c) => c + 1)
  }, [])

  /**
   * Speak the answer once, as soon as it is revealed.
   *
   * Only the first due language: three in a row is a queue you would have to
   * sit through before grading anything. It runs on `revealed` rather than in
   * the reveal handler so that it fires however the answer was revealed —
   * space, the button, or submitting a typed answer — and the index is in the
   * dependency list so moving to the next word cannot replay the last one.
   */
  const speakOnReveal = settings.speakOnReveal ?? false
  const firstDue = item?.dueCards[0]
  const firstHeadword = firstDue
    ? item?.entries.find((e) => e.lang === firstDue.lang)?.headword
    : undefined
  useEffect(() => {
    if (!revealed || !speakOnReveal || !firstDue || !firstHeadword) return
    speak(firstHeadword, firstDue.lang as Lang, { rate: settings.speechRate })
  }, [revealed, speakOnReveal, firstDue, firstHeadword, settings.speechRate, index])

  // Anything mid-sentence stops when the screen goes away, rather than
  // carrying on over whatever comes next.
  useEffect(() => () => stopSpeaking(), [])

  // The language you have chosen to produce rather than merely recognise.
  const typedLang =
    settings.typedLang &&
    item?.dueCards.some((c) => c.lang === settings.typedLang)
      ? settings.typedLang
      : null
  const typedEntry = typedLang
    ? item?.entries.find((e) => e.lang === typedLang)
    : undefined

  /**
   * The typed prompt as a gap in the word's own sentence, when there is one.
   *
   * Not a new card type and not a setting: it is the same typed-recall
   * prompt, asking for the same language, grading the same card. What
   * changes is that the thing you have to produce is the form the sentence
   * needs rather than the dictionary form — which is the harder half, and
   * the half you need when speaking.
   *
   * `null` whenever the sentence has no form of this word in it, and the
   * ordinary prompt is what you get instead.
   */
  const cloze = useMemo(
    () =>
      typedEntry
        ? buildCloze(
            typedEntry.example,
            formCandidates(
              typedEntry.headword,
              typedEntry.lang,
              typedEntry.morphology,
            ),
          )
        : null,
    [typedEntry],
  )
  /** What the typed answer is graded against. */
  const expected = cloze?.answer ?? typedEntry?.headword

  function checkTyped() {
    if (!typedEntry || !expected) return
    setTypedVerdict(sameWord(typed, expected, typedEntry.lang) ? 'right' : 'wrong')
    setRevealed(true)
  }

  const rate = useCallback(
    async (card: Card, grade: Grade) => {
      setGraded((g) => ({ ...g, [card.lang]: grade }))
      if (item) {
        setSessionGrades((current) => ({
          ...current,
          [card.id]: { lang: card.lang as Lang, grade },
        }))
      }
      await gradeCard(card, grade, settings)
    },
    [settings, item],
  )

  // Space reveals, 1-4 grade the first ungraded language. Reviewing is the
  // thing you do most, so it should not require the mouse.
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      if (detail) return
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Space') {
        // While typing an answer, space is a space.
        if (!revealed && typedLang) return
        e.preventDefault()
        if (!revealed) setRevealed(true)
        else if (allGraded) advance()
        return
      }
      if (!revealed) return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) {
        const next = item.dueCards.find((c) => graded[c.lang] === undefined)
        if (next) void rate(next, GRADES[n - 1] as Grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /**
   * Only the due languages gate the Next button. An upcoming language can be
   * graded on purpose via "Review it now", and once it is it joins the gate so
   * a half-finished extra rating is not silently skipped past.
   */
  const allGraded = useMemo(
    () =>
      !!item &&
      item.dueCards.every((c) => graded[c.lang] !== undefined) &&
      extra.every((lang) => graded[lang] !== undefined),
    [item, graded, extra],
  )

  /**
   * Auto-advance, when it is switched on.
   *
   * The delay is not politeness: grading writes the card, and the buttons
   * redraw with the new intervals. Leaving with no pause at all means the
   * answer you just gave is never seen, and a mis-tap is gone before you can
   * notice it. Three quarters of a second is long enough to read a number and
   * short enough that it never feels like waiting.
   *
   * The timer is cleared whenever the word, the grades or the setting change,
   * so grading a second language on the same card restarts it rather than
   * firing an advance meant for the state before.
   */
  const autoAdvance = settings.autoAdvance ?? false
  useEffect(() => {
    if (!autoAdvance || !allGraded || !item) return
    const t = setTimeout(advance, 750)
    return () => clearTimeout(t)
  }, [autoAdvance, allGraded, item, advance])

  const sessionGradeRows = Object.values(sessionGrades)
  const recalledCount = sessionGradeRows.filter((entry) => Number(entry.grade) >= 3).length
  const languageRecap = activeTargets(settings)
    .map((lang) => {
      const rows = sessionGradeRows.filter((entry) => entry.lang === lang)
      return { lang, total: rows.length, recalled: rows.filter((entry) => Number(entry.grade) >= 3).length }
    })
    .filter((row) => row.total > 0)

  if (queue === null) {
    return <div className="panel muted">Building your queue…</div>
  }

  if (!item) {
    return (
      <div className="stack">
        <TopicBar
          topic={topic}
          setTopic={setTopic}
          topics={topics}
          counts={counts}
        />
      <div className="panel done">
        <h2>{sessionCount > 0 ? 'Session finished' : 'Nothing due'}</h2>
        <p className="muted">
          {sessionCount > 0
            ? `You reviewed ${sessionCount} word${sessionCount === 1 ? '' : 's'}.`
            : 'Add some words, or come back when something is due.'}
        </p>
        {sessionGradeRows.length > 0 && (
          <div className="session-recap" aria-live="polite">
            <strong>Recall snapshot</strong>
            <p className="muted small">
              {recalledCount} of {sessionGradeRows.length} language prompts were rated Good or Easy.
            </p>
            <ul className="session-recap-list">
              {languageRecap.map((row) => (
                <li key={row.lang}>
                  {LANG_NAMES[row.lang]}: {row.recalled}/{row.total} recalled
                </li>
              ))}
            </ul>
          </div>
        )}
        <button className="primary" onClick={onExit}>
          Back
        </button>
      </div>
      {/* At the end of the session, not during it: a word the model got wrong
          is freshest right after you have just been tested on it, and this is
          the first moment in the screen where nothing else is being asked of
          you. */}
      <SuggestionBox context="review" compact />
      </div>
    )
  }

  const prompt = item.entries.find((e) => e.lang === settings.nativeLang)
  const remaining = queue.length - index

  // One language is graded at a time, so the four buttons are always on the
  // screen: the first ungraded due language, then any upcoming one you chose
  // to review early.
  const pending = [
    ...item.dueCards,
    ...item.upcomingCards.filter((c) => extra.includes(c.lang as Lang)),
  ]
  const current = pending.find((c) => graded[c.lang] === undefined)
  const done = pending.filter((c) => graded[c.lang] !== undefined)

  const bar = (
    <div className="review-bar">
      <button
        type="button"
        className="link review-back"
        onClick={detail ? closeDetail : onExit}
        aria-label={detail ? 'Back to the test' : 'Back to the menu'}
      >
        ← {detail ? 'Test' : 'Menu'}
      </button>
      <span className="muted small">{remaining} left</span>
      {item.isNew && <span className="badge new">new</span>}
      {!detail && topics.length > 0 && (
        <select
          className="review-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-label="Focus on a topic"
        >
          <option value="all">All topics{counts ? ` · ${counts.overall}` : ''}</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}
    </div>
  )

  if (detail) {
    return (
      <div className="review">
        {bar}
        <WordCard conceptId={item.concept.id} settings={settings} />
      </div>
    )
  }

  const flip = () => {
    if (revealed) return
    if (typedLang) checkTyped()
    else setRevealed(true)
  }

  return (
    <div className="review">
      {bar}

      <div
        className={`prompt ${revealed ? 'revealed' : 'flippable'}`}
        lang={LANG_BCP47[settings.nativeLang]}
        onClick={typedLang ? undefined : flip}
        role={!revealed && !typedLang ? 'button' : undefined}
        tabIndex={!revealed && !typedLang ? 0 : undefined}
      >
        <button
          type="button"
          className="prompt-info"
          onClick={(e) => {
            e.stopPropagation()
            openDetail()
          }}
          aria-label="Open the full word page"
          title="Full word page"
        >
          ⓘ
        </button>
        <div
          className={`prompt-word ${RTL_LANGS.has(settings.nativeLang) ? 'rtl' : ''}`}
        >
          {prompt?.headword ?? item.concept.lemma}
        </div>
        {/*
          The prompt is the one place a meaning belongs: this card is the
          question, in the native language, and the gloss is what disambiguates
          which sense you are being asked for. Every *answer* card below is
          meaning-free — see LanguageAnswer.
        */}
        {prompt?.meaning && <div className="prompt-gloss">{prompt.meaning}</div>}
        <div className="prompt-pos muted">{item.concept.pos}</div>
        {!revealed && !typedLang && (
          <div className="prompt-hint muted small">
            Recall it in {item.dueCards.map((c) => LANG_NAMES[c.lang]).join(', ')}
          </div>
        )}
      </div>

      {!revealed && !typedLang && (
        <button className="primary big reveal-button" onClick={flip}>
          Show answer <kbd>space</kbd>
        </button>
      )}
      {!revealed ? (
        typedLang && (
          <div className="reveal-area">
            <form
              className="typed"
              onSubmit={(e) => {
                e.preventDefault()
                checkTyped()
              }}
            >
              {cloze && (
                <p className="cloze" lang={LANG_BCP47[typedLang]}>
                  {cloze.before}
                  <span className="cloze-gap" aria-label="missing word">
                    ____
                  </span>
                  {cloze.after}
                </p>
              )}
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={
                  cloze
                    ? `Fill the gap in ${LANG_NAMES[typedLang]}`
                    : `Write it in ${LANG_NAMES[typedLang]}`
                }
                lang={LANG_BCP47[typedLang]}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="muted small">
                {cloze ? (
                  <>
                    The form the sentence needs, not the dictionary form — so{' '}
                    <em>dricker</em>, not <em>dricka</em>.
                  </>
                ) : (
                  <>
                    The article counts for Swedish and German — write{' '}
                    <em>en hund</em>, not <em>hund</em>.
                  </>
                )}
              </p>
            </form>
            <button className="primary big" onClick={flip}>
              Check <kbd>enter</kbd>
            </button>
          </div>
        )
      ) : (
        <>
          {typedVerdict && typedEntry && (
            <div className={`typed-verdict ${typedVerdict}`}>
              {typedVerdict === 'right' ? (
                <strong>Correct — you produced it, not just recognised it.</strong>
              ) : (
                <>
                  <strong>You wrote “{typed || '—'}”.</strong> The form to
                  produce is{' '}
                  <em lang={LANG_BCP47[typedEntry.lang]}>{expected}</em>
                  {cloze && expected !== typedEntry.headword && (
                    <> — from <em>{typedEntry.headword}</em></>
                  )}
                  .
                </>
              )}
            </div>
          )}

          <div className="answers">
            {done.map((card) => (
              <GradedLine key={card.lang} card={card} item={item} grade={graded[card.lang]} />
            ))}
            {current && (
              <LanguageAnswer
                key={cardKey(item, current)}
                card={current}
                item={item}
                settings={settings}
                grade={undefined}
                onRate={(g) => void rate(current, g)}
              />
            )}
            {!current && (
              <button className="primary big" onClick={advance}>
                Next <kbd>space</kbd>
              </button>
            )}
            {item.upcomingCards
              .filter((card) => !extra.includes(card.lang as Lang))
              .map((card) => (
                <UpcomingAnswer
                  key={card.lang}
                  card={card}
                  item={item}
                  settings={settings}
                  onReviewNow={() => setExtra((e) => [...e, card.lang as Lang])}
                />
              ))}
          </div>
        </>
      )}
    </div>
  )
}

function cardKey(item: QueueItem, card: Card) {
  return `${item.concept.id}:${card.lang}`
}

/** A language already graded on this word, folded to one line. */
function GradedLine({ card, item, grade }: { card: Card; item: QueueItem; grade: Grade | undefined }) {
  const entry = item.entries.find((e) => e.lang === card.lang)
  return (
    <div className="graded-line">
      <span className="lang-chip">{LANG_NAMES[card.lang]}</span>
      <span className="graded-word" lang={LANG_BCP47[card.lang]}>{entry?.headword ?? '—'}</span>
      {grade !== undefined && (
        <span className={`graded-grade grade-${grade}`}>{GRADE_LABELS[grade]}</span>
      )}
    </div>
  )
}
function LanguageAnswer({
  card,
  item,
  settings,
  grade,
  onRate,
}: {
  card: Card
  item: QueueItem
  settings: Settings
  grade: Grade | undefined
  onRate: (g: Grade) => void
}) {
  const entry = item.entries.find((e) => e.lang === card.lang)
  const intervals = useMemo(
    () => previewIntervals(card, settings),
    [card, settings],
  )
  const lines = entry ? morphLines(card.lang, entry.morphology) : []
  const gender = entry ? genderBadge(card.lang, entry.morphology) : null
  const priority = activeTargets(settings).indexOf(card.lang as Lang) + 1

  return (
    <div className={`answer ${grade !== undefined ? 'rated' : ''}`}>
      <div className="answer-head">
        <span className="lang-chip">
          <span className="prio">{priority}</span>
          {LANG_NAMES[card.lang]}
        </span>
        {gender && <span className={`gender gender-${gender}`}>{gender}</span>}
      </div>

      {/* Only after the answer is showing, which it always is here — the
          whole card is the answer. Hearing the word is part of knowing it,
          and the pronunciation is exactly what a written headword cannot
          give you. */}
      <div className="answer-word-row">
        <div className="answer-word" lang={LANG_BCP47[card.lang]}>
          {entry?.headword ?? '—'}
        </div>
        {entry?.headword && (
          <SpeakButton
            text={entry.headword}
            lang={card.lang as Lang}
            rate={settings.speechRate}
          />
        )}
      </div>

      {/*
        Forms stay. The definite/indefinite/plural of a noun, a verb's tenses,
        a comparative and superlative are not clues to the meaning — they are
        further things you have to produce, and the unit you must produce is
        `ist gegangen`, not `gehen`. What is withheld during a test is the
        meaning alone: that is on the prompt card, in the native language,
        where it is the question rather than the answer.
      */}
      {lines.length > 0 && (
        <div className="forms-row">
          <dl className="forms">
            {lines.map((l) => (
              <div key={l.label} className="form-row">
                <dt>{l.label}</dt>
                <dd lang={LANG_BCP47[card.lang]}>{l.value}</dd>
              </div>
            ))}
          </dl>
          {/* The forms read aloud, values only — the labels are what you
              already know, the sound of the form is what you do not. */}
          <SpeakButton
            text={lines.map((l) => l.value).join(', ')}
            lang={card.lang as Lang}
            label="Listen to the forms"
            rate={settings.speechRate}
          />
        </div>
      )}

      {/*
        The example is shown in the target language only. Its translation into
        the native language sits right next to a word you are being asked to
        recall, which hands you the answer and turns retrieval practice into
        recognition. The gloss is still there in Training and on the word card,
        where reading it is the point.
      */}
      {entry?.example && (
        <ExampleSentence
          text={entry.example}
          lang={card.lang as Lang}
          forms={formCandidates(entry.headword, card.lang, entry.morphology)}
          rate={settings.speechRate}
        />
      )}
      {entry?.notes && <div className="note">{entry.notes}</div>}

      <div className="grades">
        {GRADES.map((g, i) => (
          <button
            key={g}
            className={`grade grade-${g} ${grade === g ? 'chosen' : ''}`}
            title={GRADE_HINTS[g]}
            onClick={() => onRate(g as Grade)}
            disabled={grade !== undefined}
          >
            <span className="grade-label">{GRADE_LABELS[g]}</span>
            <span className="grade-interval">{intervals[g]}</span>
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </div>
    </div>
  )
}


/**
 * A language on this word whose own date has not arrived.
 *
 * It is shown, because seeing the three side by side is most of why the
 * layout stacks them — and because reading a form you are not being graded on
 * is exactly the free exposure that costs nothing. It is not graded, because
 * what you merely look at must not write scheduler state. That is the rule
 * Training already follows, applied here.
 */
function UpcomingAnswer({
  card,
  item,
  settings,
  onReviewNow,
}: {
  card: Card
  item: QueueItem
  settings: Settings
  onReviewNow: () => void
}) {
  const entry = item.entries.find((e) => e.lang === card.lang)
  const gender = entry ? genderBadge(card.lang, entry.morphology) : null
  const priority = activeTargets(settings).indexOf(card.lang as Lang) + 1

  return (
    <div className="answer upcoming">
      <div className="answer-head">
        <span className="lang-chip">
          <span className="prio">{priority}</span>
          {LANG_NAMES[card.lang]}
        </span>
        {gender && <span className={`gender gender-${gender}`}>{gender}</span>}
        <span className="muted small">
          not due — {formatInterval(card.due - Date.now())} to go
        </span>
      </div>

      <div className="answer-word-row">
        <div className="answer-word" lang={LANG_BCP47[card.lang]}>
          {entry?.headword ?? '—'}
        </div>
        {entry?.headword && (
          <SpeakButton text={entry.headword} lang={card.lang as Lang} />
        )}
      </div>
      {entry?.example && (
        <div className="example" lang={LANG_BCP47[card.lang]}>
          {entry.example}
        </div>
      )}

      <button className="link" onClick={onReviewNow}>
        Review it now anyway
      </button>
    </div>
  )
}

function TopicBar({
  topic,
  setTopic,
  topics,
  counts,
}: {
  topic: string
  setTopic: (t: string) => void
  topics: string[]
  counts: { focused: number; overall: number } | undefined
}) {
  if (topics.length === 0) return null
  return (
    <div className="topic-bar">
      <label className="field inline">
        <span className="muted small">Focus</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {counts && (
        <span className="muted small">
          {topic === 'all'
            ? `${counts.overall} due`
            : `${counts.focused} due here · ${counts.overall} due overall`}
        </span>
      )}
    </div>
  )
}


