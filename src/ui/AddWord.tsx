import { useEffect, useMemo, useRef, useState } from 'react'
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
  type LaterWord,
  type RelatedWord,
  type Settings,
} from '../db/types'
import { TagEditor } from './TagEditor'
import { WordCard } from './WordCard'
import { BulkAdd } from './BulkAdd'
import { PreviewCard } from './PreviewCard'
import { RelatedWords } from './RelatedWords'
import { SuggestionBox } from './Suggestions'
import { LaterList } from './LaterList'
import { dropLaterWord, parkWord } from '../db/later'

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
  /**
   * The parked word currently in the box, if the box was filled from the
   * later list. It is what tells `save` which row to clear, and it survives
   * Check → look at the preview → Add, because that is the ordinary route
   * through the list. Typing in the box by hand clears it: at that point the
   * word being saved is no longer the one that was parked.
   */
  const [laterId, setLaterId] = useState<string | null>(null)
  /** The tags that will be saved — seeded by the model, edited here. */
  const [draftTags, setDraftTags] = useState<string[]>([])
  /**
   * Suggestions from the last expansion. Kept after the word is saved so the
   * list does not vanish at the moment it becomes useful — these are not
   * stored anywhere, they come back with the expansion.
   */
  const [related, setRelated] = useState<RelatedWord[]>([])
  /**
   * The word last checked or added. It stays in the box so you can see what
   * the cards below belong to; the two buttons stay off until the box says
   * something else, so the same word is never looked up twice by accident.
   */
  const [doneWord, setDoneWord] = useState<string | null>(null)
  const unchanged = doneWord !== null && lemma.trim() === doneWord
  /** A word is on screen: the page switches to its "after check" order. */
  const showing = !!preview || !!lastId

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

  async function run(which: 'check' | 'add', sourceLang?: Lang, word?: string) {
    // The word is passed in when the list filled the box: a `setLemma` in the
    // same tick has not reached this closure yet, and reading stale state
    // here would look up whatever was in the box before.
    const term = (word ?? lemma).trim()
    if (!term || busy || (!sourceLang && term === doneWord)) return
    setMode(which)
    setBusy(true)
    setStatus(null)
    setPreview(null)
    setLastId(null)
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
      const result = await previewWord({ lemma: term, sourceLang, settings })

      setDoneWord(term)
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
      }
      // Off the list either way: a duplicate is already in the word bank, so
      // leaving it parked would mean working through it again tomorrow to
      // reach the same answer.
      if (laterId) {
        await dropLaterWord(laterId)
        setLaterId(null)
      }
      setPreview(null)
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  /** Puts the typed word on the later list and empties the box. */
  const wordRef = useRef<HTMLInputElement>(null)

  /**
   * Focus the word box on a desktop only.
   *
   * It used to be `autoFocus`, which fires every time this screen mounts —
   * and with the tiles, that is every press of Home. On a phone that slides
   * the keyboard up over the tiles you just navigated with, for a field you
   * had not asked to type in. A pointer-fine device has no such keyboard, so
   * there the focus stays as a convenience.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    wordRef.current?.focus()
  }, [])

  async function park() {
    const text = lemma.trim()
    if (!text) return
    const parked = await parkWord(text)
    setStatus(
      parked
        ? { kind: 'ok', text: `"${text}" is on the list to add later.` }
        : { kind: 'warn', text: `"${text}" is already on that list.` },
    )
    if (parked) {
      setLemma('')
      setLaterId(null)
      setPreview(null)
    }
  }

  /** Fills the box from a parked row and runs the button that was pressed. */
  function useLater(row: LaterWord, which: 'check' | 'add') {
    setLemma(row.lemma)
    setLaterId(row.id)
    setStatus(null)
    void run(which, undefined, row.lemma)
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
        {/* No heading: the placeholder in the box below says the same thing
            in the one place you are already looking, and the nav tile above
            is lit. A heading that repeats the control under it is a line of
            vertical space for nothing, which on a phone is the whole cost. */}

        {/* The word box gets the whole width. Add later used to sit beside
            it and took a third of the line from the one field this screen
            exists for; it is neither urgent nor frequent, so it has moved
            down to the quiet row with Categories. */}
        <input
          className="word-input"
          value={lemma}
          onChange={(e) => {
            setLemma(e.target.value)
            setLaterId(null)
          }}
          ref={wordRef}
          placeholder="Add your word or phrase here"
          disabled={busy}
        />

        {/* The single-select Category menu that used to sit here could only
            ever be one thing, and a word is routinely several: `beställa` is
            restaurant and work. This is the same editor the word card uses,
            so categories chosen here and changed later cannot drift apart,
            and anything you type becomes a category from then on.

            Shut by default, and the same <details> idiom as bulk-add and
            feedback. Open, it is a topic field plus six suggestion chips —
            about 210px, which on a phone pushed Check and Check-and-add off
            the bottom of the screen. Categories are optional and most words
            are added without one; the two buttons are not optional. The
            summary carries the count, so a chosen category is never hidden
            behind a shut panel. */}
        {/* The two optional things on this screen, side by side on one quiet
            row between the word box and the two buttons: give it a category,
            or put it down for later. Neither is part of adding a word, which
            is why neither sits above. */}
        <div className="add-aside">
          {!showing && <details className="categories">
            <summary>
              Categories
              {draftTags.length > 0 && (
                <span className="chip-count">{draftTags.length}</span>
              )}
            </summary>
            <TagEditor
              tags={draftTags}
              onChange={setDraftTags}
              suggestions={categorySuggestions}
              disabled={busy}
              label=""
            />
          </details>}
          <button
            type="button"
            className="chip park"
            disabled={busy || !lemma.trim()}
            title="Keep this word for later without looking it up"
            onClick={() => void park()}
          >
            Add later
          </button>
        </div>

        {/* Two buttons rather than one button and a checkbox: a checkbox that
            silently changes what the button beside it does is a mode you have
            to remember being in. The line under each says what will happen
            before you press either. */}
        <div className="add-actions">
          <div className="add-action">
            <button
              type="submit"
              className="inspect"
              disabled={busy || !lemma.trim() || unchanged}
            >
              {busy && mode === 'check' ? 'Checking…' : 'Check'}
            </button>
            {/* The two lines are kept to the same length on purpose: unequal
                lines wrapped to different heights and the buttons above them
                read as sitting at different levels. */}
            <span className="muted small">See it first, save nothing</span>
          </div>
          <div className="add-action">
            <button
              type="button"
              className="primary"
              disabled={busy || !lemma.trim() || unchanged}
              onClick={() => void run('add')}
            >
              {busy && mode === 'add' ? 'Adding…' : 'Check and add'}
            </button>
            <span className="muted small">Check and save direct</span>
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
        <div className="panel pending-panel">
          <strong>
            <span className="pending-dot" aria-hidden="true" />
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

      {/* Empty screen: list → later → recent. With a word on screen the
          later list comes first, since a parked word is the likeliest next
          thing to check. */}
      {showing ? (
        <>
          <LaterList busy={busy} onUse={useLater} />
          <BulkAdd settings={settings} />
        </>
      ) : (
        <>
          <BulkAdd settings={settings} />
          <LaterList busy={busy} onUse={useLater} />
        </>
      )}

      {recent.length > 0 && (
        <div className="panel">
          <h3>Recently added</h3>
          <ul className="chip-list">
            {recent.map((c) => (
              <li key={c.id}>
                <button
                  className="chip"
                  onClick={() => {
                    setPreview(null)
                    setRelated([])
                    setLastId(c.id)
                  }}
                >
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
