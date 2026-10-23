import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { LANG_NAMES, activeTargets, collectionOf, type Settings } from '../db/types'
import { listCollections, moveWord } from '../db/collections'
import { normaliseTags } from '../ai/expand'
import { TagEditor } from './TagEditor'
import { WordStack } from './WordStack'
import { PARTS_OF_SPEECH, type PartOfSpeech } from '../db/types'

/**
 * The full entry for one word, with every language stacked in priority order.
 * This is the comparison view — seeing hund / Hund / dog together is the point,
 * and it is also where you catch a bad expansion before it reaches your cards.
 */
export function WordCard({
  conceptId,
  settings,
  flash = false,
  between,
}: {
  conceptId: string
  settings: Settings
  /** Review's flashcard layout — see `WordStack`. */
  flash?: boolean
  between?: ReactNode
}) {
  /** Topics already in use elsewhere, offered as one-tap additions. */
  const suggestions = useLiveQuery(
    async () => {
      const all = await db.concepts.toArray()
      const counts = new Map<string, number>()
      for (const c of all) {
        if (c.deletedAt) continue
        for (const t of c.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    },
    [],
    [],
  )

  /** Every list, for the "which list" menu. Moved here from each row of My
      words, where it pushed the row's buttons out of line. */
  const collections = useLiveQuery(() => listCollections(), [], [])

  const data = useLiveQuery(async () => {
    const concept = await db.concepts.get(conceptId)
    if (!concept) return null
    const entries = await db.entries.where('conceptId').equals(conceptId).toArray()
    return { concept, entries }
  }, [conceptId])

  if (!data) return null
  const { concept, entries } = data

  /** Edits here write through immediately; `updatedAt` is what carries them
      to the other device on the next sync. */
  async function patch(fields: Partial<typeof concept>) {
    const current = await db.concepts.get(conceptId)
    if (!current) return
    await db.concepts.put({ ...current, ...fields, updatedAt: Date.now() })
  }
  // Paused languages are collected but not shown — see `activeTargets`.
  const order = [settings.nativeLang, ...activeTargets(settings)]
  const sorted = entries
    .filter((e) => order.includes(e.lang))
    .sort((a, b) => order.indexOf(a.lang) - order.indexOf(b.lang))

  const meta = (
    <>
      <div className="word-meta-line">
        <strong>{concept.lemma}</strong>
        <span>Read as {LANG_NAMES[concept.sourceLang]}</span>
        {/* Part of speech is the model's, but it is wrong often enough on
            phrases that it has to be correctable. */}
        <select
          className="pos-select"
          value={concept.pos}
          onChange={(e) => void patch({ pos: e.target.value as PartOfSpeech })}
          aria-label="Part of speech"
        >
          {PARTS_OF_SPEECH.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {/* Moving a word is a filing change and nothing else: no card is
            touched, so a word that moves from "A1" to "Words at work" keeps
            every interval it has earned. */}
        {collections.length > 1 && (
          <label className="word-list-pick">
            <span>List</span>
            <select
              value={collectionOf(concept)}
              onChange={(e) => void moveWord(concept.id, e.target.value)}
              aria-label={`Which list "${concept.lemma}" is in`}
            >
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <TagEditor
        tags={concept.tags ?? []}
        suggestions={suggestions}
        onChange={(next) => void patch({ tags: normaliseTags(next) })}
      />
      {sorted.length === 0 && <p className="muted small">Not expanded yet.</p>}
    </>
  )

  return (
    <WordStack
      entries={sorted.map((e) => ({ ...e, form: e.morphology }))}
      settings={settings}
      meta={meta}
      flash={flash}
      between={between}
    />
  )
}
