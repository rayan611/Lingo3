import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  commitPreview,
  ExpansionError,
  normaliseTags,
  oppositePair,
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
import { defaultListId, listCollections } from '../db/collections'
import { IconLater, IconWords } from './icons'
import { AiDown } from './AiDown'
import { WaitingVocabulary } from './WaitingVocabulary'
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
  const [status, setStatus] = useState<{ kind: string; text: string; retry?: () => void } | null>(null)
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
   * Which list the word is filed in. Empty means "the default list" — the one
   * marked Default under My words — and the picker shows that list by name
   * rather than the word "Default", so you can see where the word will go.
   * A list picked here holds until you leave the screen; coming back to Add
   * starts on the default again. Someone who has never made a second list
   * never has to answer this question: the picker is not rendered for them.
   */
  const [targetList, setTargetList] = useState('')
  /** Whether the categories editor under the chip row is open. */
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  /**
   * The lists a typed word may go into.
   *
   * Pack lists are left out on purpose: A1 is a curated hundred words, and a
   * word typed by hand in the middle of it makes the list something other
   * than what its name claims. Your own lists only.
   */
  const myLists = useLiveQuery(
    async () => (await listCollections()).filter((c) => c.kind === 'user'),
    [],
    [],
  )
  const defaultId = defaultListId(settings, myLists)
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
      const pair = !sourceLang && which === 'add' ? oppositePair(term) : null
      if (pair) {
        const hint = `These are opposite adjectives. Use a natural example containing both “${pair[0]}” and “${pair[1]}”.`
        const results = await Promise.all(
          pair.map((part) => previewWord({ lemma: part, settings, hint })),
        )
        const fresh = results.filter((result) => result.status === 'preview')
        if (fresh.length > 0 && fresh.every((result) => result.preview.expansion.pos === 'adjective')) {
          const ids: string[] = []
          let duplicates = 0
          for (const result of results) {
            if (result.status === 'duplicate') {
              ids.push(result.conceptId)
              duplicates++
              continue
            }
            const saved = await commitPreview({
              preview: result.preview,
              category: legacyCategory(normaliseTags(result.preview.expansion.tags)),
              tags: normaliseTags(result.preview.expansion.tags),
              collectionId: targetList || undefined,
              settings,
            })
            ids.push(saved.conceptId)
            if (saved.status === 'duplicate') duplicates++
          }
          setDoneWord(term)
          setLastId(ids[ids.length - 1] ?? null)
          setStatus({
            kind: duplicates === 2 ? 'warn' : 'saved',
            text: duplicates === 2
              ? `Both “${pair[0]}” and “${pair[1]}” were already saved.`
              : `✓ Saved “${pair[0]}” and “${pair[1]}” as two words with shared examples.`,
          })
          setRelated(fresh.flatMap((result) => result.preview.expansion.related ?? []))
          return
        }
      }

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
      if (err instanceof ExpansionError && err.unavailable) {
        setStatus({ kind: 'down', text: '', retry: () => void run(which, sourceLang, term) })
      } else {
        setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
      }
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
        collectionId: targetList || undefined,
        settings,
      })
      setLastId(result.conceptId)
      if (result.status === 'duplicate') {
        setStatus({ kind: 'warn', text: result.message ?? 'Already saved.' })
      } else {
        setStatus({ kind: 'saved', text: `✓ Saved "${toSave.lemma}" to your words.` })
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
   * Back to an empty box, ready for the next word.
   *
   * Everything a word leaves behind goes: the box, the preview, the saved
   * card, its suggestions and the tags that came with it. Before this, the
   * only way to that state was pressing the Add tile at the top of the
   * screen, which is a trip to the navigation to do something that belongs
   * to the form itself.
   *
   * The focus is put back only on a pointer-fine device, for the same reason
   * the mount effect below does: on a phone it would slide the keyboard up
   * over the card you have just cleared.
   */
  function startNewWord() {
    setLemma('')
    setLaterId(null)
    setCollision(null)
    setStatus(null)
    setPreview(null)
    setLastId(null)
    setRelated([])
    setDoneWord(null)
    setDraftTags([])
    setCategoriesOpen(false)
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    ) {
      wordRef.current?.focus()
    }
  }

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
      <form className="panel add-panel" onSubmit={(e) => {
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

        {/* The word box gets the whole width: it is the one field this
            screen exists for. */}
        {/* The round + at the end of the box starts the next word: it clears
            the box, the preview and the card below it. The Categories pill
            under here used to carry a + of its own for "open"; it is a caret
            now, so the only + on the screen means one thing. */}
        <div className="word-input-wrap">
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
          <button
            type="button"
            className="word-input-new"
            onClick={startNewWord}
            disabled={busy || (!lemma.trim() && !showing)}
            aria-label="Start a new word"
            title="Start a new word"
          >
            +
          </button>
        </div>

        {/* One row of three small pills between the box and the two
            buttons: where the word goes, what it is about, and putting it
            down for later. All optional, all answered for you by default.
            The list pill shows the list's name behind a list icon rather
            than the word "List", which is what makes three fit across a
            phone. Save for later is pale blue — the colour of "keep, do
            nothing yet" — so it never reads as one of the two buttons
            under it. The categories editor opens under the row, full
            width, instead of inside it. */}
        <div className="add-aside">
          {myLists.length > 1 && (
            <label className="add-pill list-pick" title="Which list to file this word in">
              <IconWords />
              <select
                value={targetList || defaultId}
                onChange={(e) =>
                  setTargetList(e.target.value === defaultId ? '' : e.target.value)
                }
                disabled={busy}
                aria-label="Which list to file this word in"
              >
                {/* No "(default)" after the name: the closed menu shows the
                    option's full text, and on a phone the suffix pushed the
                    name itself out of sight. The default is what is chosen
                    when you arrive, which says it already. */}
                {myLists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {/* The name is drawn as text and the select lies over the whole
                  pill, invisible: a native select clips its own text early
                  and unevenly, and a span ends in a proper ellipsis. Tapping
                  anywhere on the pill still opens the real menu. */}
              <span className="add-pill-value" aria-hidden="true">
                {myLists.find((c) => c.id === (targetList || defaultId))?.name ?? ''}
              </span>
              <span className="add-pill-caret" aria-hidden="true">▾</span>
            </label>
          )}
          {!showing && (
            <button
              type="button"
              className={`add-pill${categoriesOpen ? ' is-open' : ''}`}
              aria-expanded={categoriesOpen}
              onClick={() => setCategoriesOpen((v) => !v)}
            >
              <span className="add-pill-label">Categories</span>
              {draftTags.length > 0 && (
                <span className="chip-count">{draftTags.length}</span>
              )}
              <span aria-hidden="true" className="add-pill-mark">
                {categoriesOpen ? '▴' : '▾'}
              </span>
            </button>
          )}
          <button
            type="button"
            className="add-pill later-pill"
            disabled={busy || !lemma.trim()}
            title="Keep this word for later without looking it up"
            onClick={() => void park()}
          >
            <IconLater />
            <span>Save for later</span>
          </button>
        </div>
        {!showing && categoriesOpen && (
          <div className="add-categories">
            <TagEditor
              tags={draftTags}
              onChange={setDraftTags}
              suggestions={categorySuggestions}
              disabled={busy}
              label=""
            />
          </div>
        )}

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
              {busy && mode === 'check' ? <><span className="lookup-dots" aria-hidden="true"><i /><i /><i /></span>Checking…</> : 'Check'}
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
              {busy && mode === 'add' ? <><span className="lookup-dots" aria-hidden="true"><i /><i /><i /></span>Adding…</> : 'Check and add'}
            </button>
            <span className="muted small">Check and save direct</span>
          </div>
        </div>

        {busy && mode && <WaitingVocabulary settings={settings} />}

        {busy && mode && (
          <p className="muted small" role="status" aria-live="polite">
            Looking up translations, forms and examples… You can read the result here when it is ready.
          </p>
        )}

        {status?.retry ? (
          <AiDown what="Looking up words" busy={busy} onRetry={status.retry} />
        ) : (
          status && <div className={`status ${status.kind}`} role="status">{status.text}</div>
        )}

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
