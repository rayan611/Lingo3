import { useRef, type ReactNode } from 'react'
import {
  LANG_BCP47,
  LANG_NAMES,
  RTL_LANGS,
  type Lang,
  type Morphology,
  type Settings,
} from '../db/types'
import { genderBadge, morphLines } from '../lib/morphology'
import { formCandidates } from '../lib/highlight'
import { SpeakButton } from './SpeakButton'
import { ExampleSentence } from './ExampleSentence'
import { Forms } from './Forms'

export interface StackEntry {
  lang: Lang
  headword: string
  meaning: string
  form: Morphology['form'] | undefined
  example?: string
  exampleGloss?: string
  notes?: string
}

/**
 * One word in every language, as the preview and the saved word card both
 * show it: a small meta panel, the native-language card on its own, then the
 * languages you study. One component, so "what you check" and "what you get"
 * cannot be laid out differently.
 *
 * `flash` is the Review layout: one card holding the native word and every
 * language, then `between` (Review's Previous / Next bar), then the meta panel
 * last, below the fold. Changing a word's list or type is the rare thing on
 * that screen, so it is the part that costs a scroll. Tapping the native word
 * scrolls straight to it.
 */
export function WordStack({
  entries,
  settings,
  meta,
  footer,
  flash = false,
  between,
}: {
  entries: StackEntry[]
  settings: Settings
  meta: ReactNode
  footer?: ReactNode
  flash?: boolean
  between?: ReactNode
}) {
  const metaRef = useRef<HTMLDivElement>(null)
  const native = entries.find((e) => e.lang === settings.nativeLang)
  const others = entries.filter((e) => e.lang !== settings.nativeLang)

  if (flash) {
    return (
      <>
        <div className="panel word-card flash-card">
          {native && (
            <LangRow
              entry={native}
              settings={settings}
              isNative
              onWordClick={() =>
                metaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            />
          )}
          {others.length > 0 && (
            <div className="lang-stack">
              {others.map((e) => (
                <LangRow key={e.lang} entry={e} settings={settings} />
              ))}
            </div>
          )}
          {footer}
        </div>
        {between}
        <div className="panel word-meta" ref={metaRef}>
          {meta}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="panel word-meta">{meta}</div>
      {native && (
        <div className="panel word-card native-card">
          <LangRow entry={native} settings={settings} isNative />
        </div>
      )}
      {(others.length > 0 || footer) && (
        <div className="panel word-card">
          <div className="lang-stack">
            {others.map((e) => (
              <LangRow key={e.lang} entry={e} settings={settings} />
            ))}
          </div>
          {footer}
        </div>
      )}
    </>
  )
}

function LangRow({
  entry,
  settings,
  isNative = false,
  onWordClick,
}: {
  entry: StackEntry
  settings: Settings
  isNative?: boolean
  /** Makes the headword a button — Review uses it to reach the word's settings. */
  onWordClick?: () => void
}) {
  const gender = genderBadge(entry.lang, entry.form)
  const lines = morphLines(entry.lang, entry.form)
  return (
    <div className={`lang-row${isNative ? ' native' : ''}`}>
      <div className="lang-row-head">
        <span className="lang-chip">{LANG_NAMES[entry.lang]}</span>
        {gender && <span className={`gender gender-${gender}`}>{gender}</span>}
      </div>
      <div className="answer-word-row">
        {onWordClick ? (
          <button
            type="button"
            className={`answer-word word-link ${RTL_LANGS.has(entry.lang) ? 'rtl' : ''}`}
            lang={LANG_BCP47[entry.lang]}
            onClick={onWordClick}
            title="List, type and topics of this word"
          >
            {entry.headword}
          </button>
        ) : (
          <div
            className={`answer-word ${RTL_LANGS.has(entry.lang) ? 'rtl' : ''}`}
            lang={LANG_BCP47[entry.lang]}
          >
            {entry.headword}
          </div>
        )}
        <SpeakButton text={entry.headword} lang={entry.lang} rate={settings.speechRate} />
      </div>
      {entry.meaning && (
        <div className={`answer-meaning ${isNative && RTL_LANGS.has(entry.lang) ? 'rtl' : ''}`}>
          {entry.meaning}
        </div>
      )}
      {entry.example && (
        <ExampleSentence
          text={entry.example}
          lang={entry.lang}
          forms={formCandidates(entry.headword, entry.lang, entry.form)}
          rate={settings.speechRate}
          gloss={
            entry.exampleGloss && !isNative ? (
              <div
                className={`example-gloss ${RTL_LANGS.has(settings.nativeLang) ? 'rtl' : ''}`}
                lang={LANG_BCP47[settings.nativeLang]}
              >
                {entry.exampleGloss}
              </div>
            ) : undefined
          }
        />
      )}
      {/* Forms after the example, so each language's sentence sits right
          under its meaning and the two are read together. */}
      <Forms lines={lines} lang={entry.lang} rate={settings.speechRate} />
      {entry.notes && <div className="note">{entry.notes}</div>}
    </div>
  )
}
