import { compositeId, db, lemmaKey, newId } from '../db/db'
import { ensureDefaultCollection } from '../db/collections'
import { makeCard } from '../fsrs/scheduler'
import { LANGS } from '../db/langs'
import { type Card, type Collection, type Concept, type Entry, type Lang } from '../db/types'

/** One row of public.academy_lesson_words as the App receives it. */
export interface LessonWordRow {
  id: string
  lang: string
  word: string
  meaning: string
  example: string
}

/** Fixed id: the list is the same on every device, so sync cannot create two. */
export const LESSON_COLLECTION_ID = '00000000-0000-4000-8000-00000000e550'
const seedIdOf = (row: LessonWordRow) => `lesson:${row.id}`

/**
 * Writes teacher-published lesson words into the student's own vocabulary.
 *
 * Local only, no model call. Duplicates are prevented two ways:
 *   - by `seedId` (`lesson:<row id>`), counting soft-deleted words too, so a word the
 *     student removed is never brought back;
 *   - by headword against everything the student already has, so a word they typed
 *     themselves does not get a second card with its own history.
 * Cards are created for the taught language; they follow the normal review rules.
 */
export async function installLessonWords(rows: LessonWordRow[]): Promise<{ added: number; skipped: number }> {
  const usable = rows.filter(r => (LANGS as string[]).includes(r.lang) && r.word.trim())
  if (!usable.length) return { added: 0, skipped: rows.length }
  await ensureDefaultCollection()
  const now = Date.now()

  const existingList = await db.collections.get(LESSON_COLLECTION_ID)
  if (!existingList) {
    const collection: Collection = {
      id: LESSON_COLLECTION_ID,
      name: 'From my lessons',
      kind: 'library',
      sortOrder: 50,
      active: true,
      inExport: true,
      createdAt: now,
      updatedAt: now
    }
    await db.collections.put(collection)
  }

  const [concepts, entries] = await Promise.all([db.concepts.toArray(), db.entries.toArray()])
  const seenSeeds = new Set(concepts.filter(c => c.seedId).map(c => c.seedId as string))
  const live = new Set(concepts.filter(c => !c.deletedAt).map(c => c.id))
  const seenWords = new Set<string>()
  for (const c of concepts) if (!c.deletedAt) seenWords.add(lemmaKey(c.lemma.trim(), c.sourceLang))
  for (const e of entries) if (live.has(e.conceptId)) seenWords.add(lemmaKey(e.headword.trim(), e.lang))

  const newConcepts: Concept[] = []
  const newEntries: Entry[] = []
  const newCards: Card[] = []
  let skipped = 0
  for (const row of usable) {
    const seedId = seedIdOf(row)
    const lang = row.lang as Lang
    const key = lemmaKey(row.word.trim(), lang)
    if (seenSeeds.has(seedId) || seenWords.has(key)) {
      skipped++
      continue
    }
    seenSeeds.add(seedId)
    seenWords.add(key)
    const conceptId = newId()
    newConcepts.push({
      id: conceptId,
      lemma: row.word.trim(),
      sourceLang: lang,
      pos: 'other' as Concept['pos'],
      category: 'uncategorised',
      tags: ['lesson'],
      collectionId: LESSON_COLLECTION_ID,
      seedId,
      createdAt: now,
      updatedAt: now
    })
    newEntries.push({
      id: compositeId(conceptId, lang),
      conceptId,
      lang,
      headword: row.word.trim(),
      meaning: row.meaning.trim(),
      example: row.example.trim() || undefined,
      updatedAt: now
    })
    newCards.push(makeCard(conceptId, lang))
  }
  if (newConcepts.length) {
    await db.transaction('rw', db.concepts, db.entries, db.cards, async () => {
      await db.concepts.bulkPut(newConcepts)
      await db.entries.bulkPut(newEntries)
      await db.cards.bulkPut(newCards)
    })
  }
  return { added: newConcepts.length, skipped: skipped + (rows.length - usable.length) }
}
