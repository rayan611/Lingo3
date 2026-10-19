import { useState } from 'react'
import {
  LANG_BCP47,
  LANG_NATIVE_NAMES,
  RTL_LANGS,
  type Lang,
} from '../db/types'
import { QUICK_START } from './quickstart'

/**
 * The visitor's own language, as far as the browser will say.
 *
 * Only used on the landing page, where there is no account to ask. A guess
 * that is wrong costs nothing — it is one of two buttons, both visible.
 */
export function guessLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.slice(0, 2).toLowerCase()
    if (base && base in QUICK_START) return base as Lang
  }
  return 'en'
}

/**
 * How to use Lingo3 — written once, shown in the two places people look.
 *
 * On the landing page it is what someone reads before they have an account,
 * so it has to make sense with nothing on screen to point at. In Settings it
 * is what someone opens three weeks later having forgotten what the two Add
 * buttons do. Same words both times: a second copy is a second thing to keep
 * true, and the one in Settings is the one that would quietly go stale.
 *
 * Steps are in the order you actually meet them, not in menu order.
 */

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Pick your languages',
    body: 'Settings → Languages. Choose the language you think in, then up to three you are learning. Everything you add from then on is expanded into all of them.',
  },
  {
    title: 'Add a word',
    body: 'Type a word or a short phrase and press Check to see what comes back before anything is saved, or Check and add to save it in one go. You never say which language you typed — it works that out and shows you what it read.',
  },
  {
    title: 'Add a lot at once',
    body: 'Add a list takes a whole list pasted from class, or a CSV exported from Anki, Quizlet or a spreadsheet. Add later parks a word you have no time to look up now; it waits on the Add screen until you do.',
  },
  {
    title: 'Recall test',
    body: 'The words that are due today, one at a time: see the prompt, say the answer in your head, reveal it, then say how it went. Your answer sets when that word comes back — soon if it was hard, much later if it was easy.',
  },
  {
    title: 'Review',
    body: 'The same words with nothing asked of you — word, meaning and example together, to flip through on a bus. Nothing is scheduled or graded here, so it never costs you a due date.',
  },
  {
    title: 'My words, and a story',
    body: 'My words is everything you have, searchable and editable, with categories you can filter by. Read a story writes a short text out of the vocabulary you already have and shows how much of it you really know.',
  },
]

const NOTES: string[] = [
  'Each language is remembered separately. A word that is hard in German and easy in English is two schedules, and only the one actually due is asked for.',
  'Reviewing never needs the network. Add words with no signal and they fill in when you are back online; everything syncs to your account, so a second device starts where you left off.',
  'Tap the speaker on any word or text to hear it. The voices are your device’s own — nothing is recorded or sent anywhere.',
  'Settings → Full backup saves everything, review history included, as a file you keep.',
]

/**
 * The five-line version, in a language the reader already has.
 *
 * `lang` is where it starts — the account's native language in Settings, and
 * English on the landing page, where nobody has told us anything yet. Either
 * way the reader can switch, because the account's native language is a
 * setting about vocabulary, not a promise about which language someone reads
 * instructions in most comfortably.
 */
export function QuickStart({
  lang,
  initial = lang,
}: {
  lang: Lang
  initial?: Lang
}) {
  const [shown, setShown] = useState<Lang>(initial)
  const qs = QUICK_START[shown] ?? QUICK_START.en
  const rtl = RTL_LANGS.has(shown)
  // English plus the reader's own, and nothing else: a seven-button row is a
  // language picker, which this is not — it is an escape hatch for two.
  const choices: Lang[] = shown === 'en' && lang === 'en' ? [] : ['en', lang]

  return (
    <div className="quickstart">
      {choices.length > 0 && (
        <div className="quickstart-langs" role="group" aria-label="Guide language">
          {choices.map((l) => (
            <button
              key={l}
              type="button"
              className={`chip ${shown === l ? 'chip-on' : ''}`}
              aria-pressed={shown === l}
              onClick={() => setShown(l)}
            >
              {LANG_NATIVE_NAMES[l]}
            </button>
          ))}
        </div>
      )}
      <div
        className={`quickstart-body ${rtl ? 'rtl' : ''}`}
        lang={LANG_BCP47[shown]}
        dir={rtl ? 'rtl' : undefined}
      >
        <p className="muted small">{qs.intro}</p>
        <ol className="howto-steps">
          {qs.steps.map((s) => (
            <li key={s.title}>
              <h3 className="howto-step-title">{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export function HowTo({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className="howto">
      <ol className="howto-steps">
        {STEPS.map((s) => (
          <li key={s.title}>
            <H className="howto-step-title">{s.title}</H>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
      <ul className="howto-notes">
        {NOTES.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  )
}
