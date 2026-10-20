import type { ReactNode } from 'react'
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
 */
export function WordStack({
  entries,
  settings,
  meta,
  footer,
}: {
  entries: StackEntry[]
  settings: Settings
  meta: ReactNode
  footer?: ReactNode
}) {
  const native = entries.find((e) => e.lang === settings.nativeLang)
  const others = entries.filter((e) => e.lang !== settings.nativeLang)
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
}: {
  entry: StackEntry
  settings: Settings
  isNative?: boolean
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
        <div
          className={`answer-word ${RTL_LANGS.has(entry.lang) ? 'rtl' : ''}`}
          lang={LANG_BCP47[entry.lang]}
        >
          {entry.headword}
        </div>
        <SpeakButton text={entry.headword} lang={entry.lang} rate={settings.speechRate} />
      </div>
      {entry.meaning && (
        <div className={`answer-meaning ${isNative && RTL_LANGS.has(entry.lang) ? 'rtl' : ''}`}>
          {entry.meaning}
        </div>
      )}
      <Forms lines={lines} lang={entry.lang} rate={settings.speechRate} />
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
      {entry.notes && <div className="note">{entry.notes}</div>}
    </div>
  )
}
