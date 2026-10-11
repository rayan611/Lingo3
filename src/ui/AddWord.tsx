import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  commitPreview,
  normaliseTags,
  previewWord,
  processPending,
  type WordPreview,
} from '../ai/expand'
import {
  CATEGORIES,
  LANG_NAMES,
  type Category,
  type Lang,
  type RelatedWord,
  type Settings,
} from '../db/types'
import { WordCard } from './WordCard'
import { BulkAdd } from './BulkAdd'
import { PreviewCard } from './PreviewCard'
import { detectLang } from '../lib/detectLang'
import { RelatedWords } from './RelatedWords'
import { SuggestionBox } from './Suggestions'

interface Props {
  settings: Settings
}

export function AddWord({ settings }: Props) {
  const [lemma, setLemma] = useState('')
  const [hint, setHint] = useState('')
  const [sourceLang, setSourceLang] = useState<Lang>(settings.nativeLang)
  /**
   * The language the typed text looks like. Offered, never applied: a silent
   * wrong guess files a German noun as Swedish and you find out weeks later
   * when the genders make no sense. One tap accepts it.
   */
  const guess = useMemo(() => {
    const g = detectLang(lemma)
    if (!g || g.lang === sourceLang) return null
    // Only languages this user actually has configured.
    const known = [settings.nativeLang, ...settings.targetLangs]
    return known.includes(g.lang) ? g : null
  }, [lemma, sourceLang, settings.nativeLang, settings.targetLangs])
  const [category, setCategory] = useState<Category>('daily')
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

  async function run(which: 'check' | 'add') {
    if (!lemma.trim() || busy) return
    setMode(which)
    setBusy(true)
    setStatus(null)
    setPreview(null)
    setRelated([])
    try {
      // Always expand first and look at it. The only difference quick mode
      // makes is that it does not stop to ask.
      const result = await previewWord({
        lemma,
        sourceLang,
        hint: hint.trim() || undefined,
        settings,
      })

      if (result.status === 'duplicate') {
        setLastId(result.conceptId)
        setStatus({
          kind: 'warn',
          text: `"${result.lemma}" is already in your list — nothing was added, and no model call was spent.`,
        })
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
        category,
        tags,
        settings,
      })
      setLastId(result.conceptId)
      if (result.status === 'duplicate') {
        setStatus({ kind: 'warn', text: result.message ?? 'Already saved.' })
      } else {
        setStatus({ kind: 'ok', text: `Added "${toSave.lemma}".` })
        setLemma('')
        setHint('')
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
        <h2>Add a word</h2>
        <p className="muted small">
          One entry becomes {settings.targetLangs.length} languages, with genders
          and verb forms. Check shows you the result; nothing is saved until you
          press Add.
        </p>

        <input
          className="word-input"
          value={lemma}
          onChange={(e) => setLemma(e.target.value)}
          placeholder="Word, verb, or short phrase"
          autoFocus
          disabled={busy}
        />

        <div className="row">
          <label className="field">
            <span>I typed it in</span>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as Lang)}
            >
              {[settings.nativeLang, ...settings.targetLangs].map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
            {guess && (
              <button
                type="button"
                className="link lang-guess"
                onClick={() => setSourceLang(guess.lang)}
              >
                {guess.confidence === 'certain' ? 'That is' : 'Looks like'}{' '}
                {LANG_NAMES[guess.lang]} — switch
              </button>
            )}
          </label>

          <label className="field">
            <span>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="optional">
            Which sense? <em>optional — only when the word is ambiguous</em>
          </span>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder='e.g. "bank" as in river bank'
            disabled={busy}
          />
        </label>

        {/* Check is the form's own button, so Enter runs the careful one.
            Add is deliberately the second tap: it writes the word with the
            model's suggested topics and no look at what came back. */}
        <div className="add-actions">
          <button type="submit" disabled={busy || !lemma.trim()}>
            {busy && mode === 'check' ? 'Checking…' : 'Check'}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || !lemma.trim()}
            onClick={() => void run('add')}
          >
            {busy && mode === 'add' ? 'Adding…' : 'Add'}
          </button>
        </div>
        <p className="muted small">
          Check shows you what the model made of it, with an Add button under
          it. Add saves it straight away.
        </p>

        {status && <div className={`status ${status.kind}`}>{status.text}</div>}
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
          category={category}
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
