import type { ReactNode } from 'react'
import { SpeakButton } from './SpeakButton'
import { markForms } from '../lib/highlight'
import { LANG_BCP47, type Lang } from '../db/types'

/**
 * An example sentence with the word it belongs to marked, and its own speaker.
 *
 * One component for all three screens that show an example — the word card,
 * the check preview and the Test answer — because they disagreed before: two
 * put the speaker inline before the sentence, one put it beside. The speaker
 * sits at the BOTTOM right of the block, quieter and lower than the headword's
 * own speaker directly above it, so the two read as different actions.
 */
export function ExampleSentence({
  text,
  lang,
  forms,
  rate,
  gloss,
}: {
  text: string
  lang: Lang
  /** Every written form of the word, from `formCandidates`. */
  forms: string[]
  rate?: number
  gloss?: ReactNode
}) {
  const segments = markForms(text, forms)

  return (
    <div className="example-row">
      <div className="example" lang={LANG_BCP47[lang]}>
        {segments.map((segment, i) =>
          segment.hit ? (
            <mark key={i}>{segment.text}</mark>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
        {gloss}
      </div>
      <SpeakButton
        text={text}
        lang={lang}
        size="sm"
        label="Listen to the example"
        rate={rate}
      />
    </div>
  )
}
