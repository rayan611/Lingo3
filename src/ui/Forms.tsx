import type { Lang } from '../db/types'
import { LANG_BCP47 } from '../db/types'
import type { MorphLine } from '../lib/morphology'
import { SpeakButton } from './SpeakButton'

/**
 * A word's forms, grouped onto their display lines — for a verb: infinitive
 * and imperative, then present, past and perfect. One component so the test,
 * the word card and the preview cannot drift apart.
 */
export function Forms({
  lines,
  lang,
  rate,
}: {
  lines: MorphLine[]
  lang: Lang
  rate?: number
}) {
  if (lines.length === 0) return null
  const groups = [1, 2, 3]
    .map((row) => lines.filter((l) => (l.row ?? 1) === row))
    .filter((g) => g.length > 0)
  return (
    <div className="forms-row">
      <div className="forms">
        {groups.map((group, i) => (
          <dl key={i} className="forms-line">
            {group.map((l) => (
              <div key={l.label} className="form-row">
                <dt>{l.label}</dt>
                <dd lang={LANG_BCP47[lang]}>
                  {l.value}
                  {l.suffix}
                </dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
      {/* Values only — the labels are what you already know, the sound of the
          form is what you do not. */}
      <SpeakButton
        text={lines.map((l) => l.value).join(', ')}
        lang={lang}
        label="Listen to the forms"
        rate={rate}
      />
    </div>
  )
}
