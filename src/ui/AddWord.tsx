import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  commitPreview,
  normaliseTags,
  previewWord,
  processPending,
  type DuplicateInfo,
  type WordPreview,
} from '../ai/expand'
import {
  CATEGORIES,
  LANG_NAMES,
  activeTargets,
  type Category,
  type Lang,
  type RelatedWord,
  type Settings,
} from '../db/types'
import { TagEditor } from './TagEditor'
import { WordCard } from './WordCard'
import { BulkAdd } from './BulkAdd'
import { PreviewCard } from './PreviewCard'
import { RelatedWords } from './RelatedWords'
import { SuggestionBox } from './Suggestions'

/**
 * Categories offered before you have any of your own, grouped the way a
 * learner actually sorts words. The grammatical ones are here because a
 * preposition or an adverb is worth drilling as a set — which is also what
 * the part-of-speech filter in Words is for, from the other direction.
 */
const SUGGESTED_CATEGORIES = [
  'everyday',
  'food',
  'work',
  'travel',
  'home',
  'health',
  'school',
  'nature',
  'feelings',
  'prepositions',
  'time',
  'place',
  'adverbs',
  'word order',
  'tenses',
  'adjectives',
]

/**
 * The old single-valued `category` column, filled from the categories chosen.
 *
 * It still exists on every concept and `matchesTopic` still reads it, so
 * words added before tags arrived keep working. The first chosen category
 * that happens to be one of the old fixed values wins; everything else is
 * `uncategorised`, which is honest — the real categories are in `tags`.
 */
function legacyCategory(tags: string[]): Category {
  const known = tags.find((t) => (CATEGORIES as readonly string[]).includes(t))
  return (known as Category) ?? 'uncategorised'
}

interface Props {
  settings: Settings
}

export function AddWord({ settings }: Props) {
  const [lemma, setLemma] = useState('')
  /**
   * The word this one collided with, when it did.
   *
   * Now that the Add box works the language out for itself, the lookup has to
   * search every language — so `gift` typed as English can land on `gift`
   * filed as Swedish. Rather than refusing, say which word was found and let
   * the answer be "no, mine is the English one"; that answer is also the
   * missing language, and re-checking with it both narrows the lookup and
   * tells the model which reading to build.
   */
  const [collision, setCollision] = useState<DuplicateInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: string; text: string } | null>(null)
  const [lastId, setLastId] = useState<string | null>(null)
  const [preview, setPreview] = useState<WordPreview | null>(null)
  /**
   * Which button was pressed, while it is working.
   *
   * Check and Add are two buttons rather than one button and a checkbox: a
   * checkbox that silently changes what the button next to it does is a mode
   * you have to remember being in. Two buttons say what will happen before
   * you press either. The flow underneath is identical — expand, then write —
   * so this is one branch at the end, not a second path through the code.
   */
  const [mode, setMode] = useState<'check' | 'add' | null>(null)
  /** The tags that will be saved — seeded by the model, edited here. */
  const [draftTags, setDraftTags] = useState<string[]>([])
  /**
   * Suggestions from the last expansion. Kept after the word is saved so the
   * list does not vanish at the moment it becomes useful — these are not
   * stored anywhere, they come back with the expansion.
   */
  const [related, setRelated] = useState<RelatedWord[]>([])

  /** Topics already in use, offered as one-tap suggestions. */
  const tagSuggestions = useLiveQuery(
    async () => {
      const concepts = await db.concepts.toArray()
      const counts = new Map<string, number>()
      for (const c of concepts) {
        if (c.deletedAt) continue
        for (const t of c.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t)
    },
    [],
    [],
  )

  /**
   * Categories offered as one-tap chips: the ones you already use, commonest
   * first, then the built-in vocabulary to fall back on while the list is
   * still short. Anything typed into the editor joins the first group from
   * then on, which is what makes "add a new category" work without a
   * separate screen to manage them.
   */
  const categorySuggestions = useMemo(() => {
    const seen = new Set(tagSuggestions)
    return [...tagSuggestions, ...SUGGESTED_CATEGORIES.filter((c) => !seen.has(c))]
  }, [tagSuggestions])


  const pending = useLiveQuery(
    () => db.pending.orderBy('createdAt').toArray(),
    [],
    [],
  )
  const pendingCount = pending.length
  // The reason the last expansion failed. It was always recorded; it just had
  // nowhere to be seen, which meant a broken endpoint looked like a broken app.
  const lastError = pending[pending.length - 1]?.lastError
  const recent = useLiveQuery(
    () => db.concepts.orderBy('createdAt').reverse().limit(6).toArray(),
    [],
    [],
  )

  async function run(which: 'check' | 'add', sourceLang?: Lang) {
    if (!lemma.trim() || busy) return
    setMode(which)
    setBusy(true)
    setStatus(null)
    setPreview(null)
    setCollision(null)
    setRelated([])
    try {
      // Always expand first and look at it. The only difference quick add
      // makes is that it does not stop to ask.
      //
      // No source language and no sense hint: the model reads both off the
      // word itself, and what it decided is on the preview card before
      // anything is saved. `sourceLang` is set only by answering the
      // collision dialog — "no, mine is the English one" — and it both
      // narrows the duplicate lookup and tells the model which reading to
      // build.
      const result = await previewWord({ lemma, sourceLang, settings })

      if (result.status === 'duplicate') {
        setLastId(result.conceptId)
        setCollision(result)
        return
      }

      setRelated(result.preview.expansion.related ?? [])
      const suggested = normaliseTags(result.preview.expansion.tags)
      if (which === 'add') {
        await save(result.preview, suggested)
      } else {
        setDraftTags(suggested)
        setPreview(result.preview)
      }
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
      setMode(null)
    }
  }

  /** Writes a preview. No model call — the expansion is already on screen. */
  async function save(toSave: WordPreview, tags: string[]) {
    setBusy(true)
    try {
      const result = await commitPreview({
        preview: toSave,
        category: legacyCategory(tags),
        tags,
        settings,
      })
      setLastId(result.conceptId)
      if (result.status === 'duplicate') {
        setStatus({ kind: 'warn', text: result.message ?? 'Already saved.' })
      } else {
        setStatus({ kind: 'ok', text: `Added "${toSave.lemma}".` })
        setLemma('')
      }
      setPreview(null)
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  async function retryPending() {
    setBusy(true)
    const { done, failed } = await processPending(settings)
    setStatus({
      kind: failed > 0 ? 'warn' : 'ok',
      text: `Expanded ${done}${failed > 0 ? `, ${failed} still waiting` : ''}.`,
    })
    setBusy(false)
  }

  return (
    <div className="stack">
      <form className="panel" onSubmit={(e) => {
          e.preventDefault()
          void run('check')
        }}>
        {/* No paragraph of explanation above the input. It said three things:
            that the language is worked out for you, which the preview says
            anyway when it reports what it read the word as; how many languages
            one entry becomes, which the preview then shows you; and that
            nothing is saved until you press Add, which is what the line under
            each button says. All of it was true on your first visit and in the
            way every time after. */}
        <h2>Add a word</h2>

        <input
          className="word-input"
          value={lemma}
          onChange={(e) => setLemma(e.target.value)}
          placeholder="Word, verb, or short phrase"
          autoFocus
          disabled={busy}
        />

        {/* The single-select Category menu that used to sit here could only
            ever be one thing, and a word is routinely several: `beställa` is
            restaurant and work. This is the same editor the word card uses,
            so categories chosen here and changed later cannot drift apart,
            and anything you type becomes a category from then on. */}
        <TagEditor
          tags={draftTags}
          onChange={setDraftTags}
          suggestions={categorySuggestions}
          disabled={busy}
          label="Categories — pick any, or type a new one"
        />

        {/* Two buttons rather than one button and a checkbox: a checkbox that
            silently changes what the button beside it does is a mode you have
            to remember being in. The line under each says what will happen
            before you press either. */}
        <div className="add-actions">
          <div className="add-action">
            <button type="submit" disabled={busy || !lemma.trim()}>
              {busy && mode === 'check' ? 'Checking…' : 'Check'}
            </button>
            <span className="muted small">See what the model made of it first</span>
          </div>
          <div className="add-action">
            <button
              type="button"
              className="primary"
              disabled={busy || !lemma.trim()}
              onClick={() => void run('add')}
            >
              {busy && mode === 'add' ? 'Adding…' : 'Check and add'}
            </button>
            <span className="muted small">
              Straight into your word bank — for when you know the word
            </span>
          </div>
        </div>

        {status && <div className={`status ${status.kind}`}>{status.text}</div>}

        {collision && (
          <div className="status warn collision">
            <p>
              You already have <strong>{collision.lemma}</strong> —{' '}
              {LANG_NAMES[collision.lang]}
              {collision.meaning ? `, “${collision.meaning}”` : ''}.
            </p>
            <p className="muted small">
              Nothing was added, and no model call was spent. If that is a
              different word that happens to be spelled the same, say which
              language you meant and it will be looked up again.
            </p>
            <div className="row">
              <button type="button" onClick={() => setCollision(null)}>
                Yes, that is the one
              </button>
              {[settings.nativeLang, ...activeTargets(settings)]
                .filter((l) => l !== collision.lang)
                .map((l) => (
                  <button
                    key={l}
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void run('check', l)}
                  >
                    No, mine is {LANG_NAMES[l]}
                  </button>
                ))}
            </div>
          </div>
        )}
      </form>

      {pendingCount > 0 && (
        <div className="panel warn-panel">
          <strong>
            {pendingCount} word{pendingCount === 1 ? '' : 's'} waiting
          </strong>
          <p className="muted small">
            Saved on this device, but not expanded into the other languages
            yet. Words added offline fill in by themselves; anything else is
            the expansion service failing, and the reason is below.
          </p>
          {lastError && <pre className="pending-detail">{lastError}</pre>}
          <div className="row">
            <button onClick={() => void retryPending()} disabled={busy}>
              Expand now
            </button>
            {lastError && (
              <button
                className="link"
                onClick={() => void navigator.clipboard?.writeText(lastError)}
              >
                Copy error
              </button>
            )}
          </div>
        </div>
      )}

      {preview && (
        <PreviewCard
          preview={preview}
          settings={settings}
          busy={busy}
          tags={draftTags}
          onTagsChange={setDraftTags}
          tagSuggestions={tagSuggestions}
          onAdd={() => void save(preview, draftTags)}
        />
      )}

      <BulkAdd settings={settings} />

      {lastId && <WordCard conceptId={lastId} settings={settings} />}

      {/* After the card, not before it. These are suggestions about a word you
          have just added; put them above it and they compete with the thing
          you came here to see. */}
      {related.length > 0 && (
        <RelatedWords
          related={related}
          settings={settings}
          category={legacyCategory(draftTags)}
        />
      )}

      {recent.length > 0 && (
        <div className="panel">
          <h3>Recently added</h3>
          <ul className="chip-list">
            {recent.map((c) => (
              <li key={c.id}>
                <button className="chip" onClick={() => setLastId(c.id)}>
                  {c.lemma}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The foot of the Add screen. A word that came back wrong is reported
          from where it was added, and the context field records that. */}
      <SuggestionBox context="add" compact />
    </div>
  )
}
