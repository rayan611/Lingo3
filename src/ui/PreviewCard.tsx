import {
  LANG_NAMES,
  activeTargets,
  parseMorphology,
  type Settings,
  type WordPreviewEntryView,
} from '../db/types'
import type { WordPreview } from '../ai/expand'
import { TagEditor } from './TagEditor'
import { WordStack } from './WordStack'

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

  const lemma = preview.expansion.normalisedLemma?.trim() || preview.lemma
  const detected = preview.expansion.detectedLang

  return (
    <div className="preview-fit">
    <WordStack
      entries={rows}
      settings={settings}
      meta={
        <>
          {/* One small line: what was read, as what — the only place a
              misreading shows before it reaches your cards. */}
          <div className="word-meta-line">
            <strong>{lemma}</strong>
            {detected && <span>Read as {LANG_NAMES[detected]}</span>}
            <span>{preview.expansion.pos}</span>
            <span className="not-saved" title="Checked, not saved yet">● not saved</span>
          </div>
          {lemma.toLocaleLowerCase() !== preview.lemma.trim().toLocaleLowerCase() && (
            <p className="muted small">Tidied from “{preview.lemma}”.</p>
          )}
          <TagEditor
            tags={tags}
            onChange={onTagsChange}
            suggestions={tagSuggestions}
            disabled={busy}
          />
        </>
      }
      footer={
        <button className="primary big" onClick={onAdd} disabled={busy}>
          {busy ? 'Saving…' : 'Add to my words'}
        </button>
      }
    />
    </div>
  )
}
