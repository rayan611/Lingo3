import {
  LANG_BCP47,
  LANG_NAMES,
  RTL_LANGS,
  activeTargets,
  parseMorphology,
  type Settings,
  type WordPreviewEntryView,
} from '../db/types'
import type { WordPreview } from '../ai/expand'
import { genderBadge, morphLines } from '../lib/morphology'
import { TagEditor } from './TagEditor'
import { SpeakButton } from './SpeakButton'
import { ExampleSentence } from './ExampleSentence'
import { formCandidates } from '../lib/highlight'

/**
 * What a word would look like if you saved it.
 *
 * Deliberately the same layout as the saved word card: the point of checking
 * before adding is to judge the thing you are about to get, so it should not
 * be rendered differently from the thing you get.
 */
export function PreviewCard({
  preview,
  settings,
  onAdd,
  busy,
  tags,
  onTagsChange,
  tagSuggestions,
}: {
  preview: WordPreview
  settings: Settings
  onAdd: () => void
  busy: boolean
  tags: string[]
  onTagsChange: (next: string[]) => void
  tagSuggestions: string[]
}) {
  // The preview shows what you will see after adding, not everything the
  // model was asked for: a paused language is still generated and still
  // saved, but it is not part of what you are checking.
  const order = [settings.nativeLang, ...activeTargets(settings)]
  const rows: WordPreviewEntryView[] = preview.expansion.entries
    .filter((e) => order.includes(e.lang))
    .sort((a, b) => order.indexOf(a.lang) - order.indexOf(b.lang))
    .map((e) => ({ ...e, form: parseMorphology(e.lang, e.morphology) }))

  return (
    <div className="panel word-card preview-card">
      <div className="word-card-head">
        <h3>{preview.expansion.normalisedLemma?.trim() || preview.lemma}</h3>
        <span className="badge">{preview.expansion.pos}</span>
        <span className="badge subtle">not saved yet</span>
      </div>

      {preview.expansion.normalisedLemma &&
        preview.expansion.normalisedLemma.trim().toLocaleLowerCase() !==
          preview.lemma.toLocaleLowerCase() && (
          <p className="muted small">
            Tidied from “{preview.lemma}”.
          </p>
        )}

      {/* The Add box does not ask which language you typed in, so this line
          is the only place a misreading shows before it reaches your cards —
          and a word read as the wrong language is wrong in every field below
          it, not just this one. */}
      {preview.expansion.detectedLang && (
        <p className="muted small">
          Read as {LANG_NAMES[preview.expansion.detectedLang]}. If that is
          wrong, add a word of context and check again.
        </p>
      )}

      {/* Suggested by the model, changed here if it guessed wrong, and
          editable again later from the word card. */}
      <TagEditor
        tags={tags}
        onChange={onTagsChange}
        suggestions={tagSuggestions}
        disabled={busy}
      />

      <div className="lang-stack">
        {rows.map((entry) => {
          const gender = genderBadge(entry.lang, entry.form)
          const lines = morphLines(entry.lang, entry.form)
          const isNative = entry.lang === settings.nativeLang
          return (
            <div
              key={entry.lang}
              className={`lang-row ${isNative ? 'native' : ''}`}
            >
              <div className="lang-row-head">
                <span className="lang-chip">{LANG_NAMES[entry.lang]}</span>
                {gender && (
                  <span className={`gender gender-${gender}`}>{gender}</span>
                )}
              </div>
              <div className="answer-word-row">
                <div
                  className={`answer-word ${RTL_LANGS.has(entry.lang) ? 'rtl' : ''}`}
                  lang={LANG_BCP47[entry.lang]}
                >
                  {entry.headword}
                </div>
                <SpeakButton
                  text={entry.headword}
                  lang={entry.lang}
                  rate={settings.speechRate}
                />
              </div>
              <div className="answer-meaning">{entry.meaning}</div>

              {lines.length > 0 && (
                <div className="forms-row">
                  <dl className="forms">
                    {lines.map((l) => (
                      <div key={l.label} className="form-row">
                        <dt>{l.label}</dt>
                        <dd lang={LANG_BCP47[entry.lang]}>{l.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {/* The forms read aloud, values only — "hunden, hundar",
                      not "definite, plural". The labels are what you already
                      know; the sound of the form is the part you do not. */}
                  <SpeakButton
                    text={lines.map((l) => l.value).join(', ')}
                    lang={entry.lang}
                    size="sm"
                    label="Listen to the forms"
                    rate={settings.speechRate}
                  />
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
              {entry.notes && <div className="note">{entry.notes}</div>}
            </div>
          )
        })}
      </div>

      {/* The second Add. The first one is at the top of the form; this one is
          here so confirming does not mean scrolling back up past everything
          you just came down to read. */}
      <button className="primary big" onClick={onAdd} disabled={busy}>
        {busy ? 'Saving…' : 'Add to my words'}
      </button>
    </div>
  )
}
