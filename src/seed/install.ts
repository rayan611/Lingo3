import { compositeId, db, lemmaKey, newId } from '../db/db'
import { ensureDefaultCollection } from '../db/collections'
import { makeCard } from '../fsrs/scheduler'
import {
  PACK_COLLECTION_IDS,
  activeTargets,
  collectionOf,
  type Card,
  type Collection,
  type Concept,
  type Entry,
  type Lang,
  type Settings,
} from '../db/types'
import { glossFor, tagsOf, wordIn, type Pack, type SeedRow } from './catalogue'
import { a1Pack } from './packs/a1'
import { a2Pack } from './packs/a2'
import { dailyPack } from './packs/daily'

/** The packs, in the order they are offered. */
export const PACKS: readonly Pack[] = [a1Pack, a2Pack, dailyPack]

export function packById(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id)
}

export interface InstallResult {
  /** Words written. */
  added: number
  /** Rows skipped because the word was already in your vocabulary. */
  skipped: number
  collectionId: string
}

/**
 * Articles stripped before comparing a pack word against what you already
 * have. `en hund` and `hund` are the same word, and a pack that adds the
 * second because you typed the first is the duplicate this exists to prevent.
 *
 * Deliberately a copy of the list in ../ai/expand.ts rather than an import:
 * that one is not exported, and three literals are cheaper than widening an
 * API across modules for them.
 */
const ARTICLES: Partial<Record<Lang, string[]>> = {
  sv: ['en', 'ett'],
  de: ['der', 'die', 'das'],
  en: ['a', 'an', 'the'],
  es: ['el', 'la', 'los', 'las'],
  it: ['il', 'la', 'lo', 'le', 'gli', 'i'],
  fr: ['le', 'la', 'les'],
}

function stripArticle(word: string, lang: Lang): string {
  const parts = word.trim().split(/\s+/)
  if (parts.length < 2) return word.trim()
  if ((ARTICLES[lang] ?? []).includes(parts[0].toLocaleLowerCase())) {
    return parts.slice(1).join(' ')
  }
  return word.trim()
}

/**
 * Enables a pack: writes its words into a list of their own.
 *
 * No network, no model call, nothing queued. The rows already carry every
 * language, so this is a local transaction and it works offline — which is
 * the point of shipping the words rather than generating them.
 *
 * Two kinds of duplicate are checked, once, up front:
 *
 *   - by `seedId`, which is what makes the packs safe to enable in any order.
 *     A word that is in two packs, or a pack enabled twice, is written once.
 *   - by headword, against the words you already added yourself. Someone who
 *     typed `hund` last week should not get a second `hund` from A1 with its
 *     own separate review history.
 *
 * Both are precomputed into sets from one pass over the database, rather than
 * a lookup per row: a hundred rows against a few thousand words is one read
 * either way, and a hundred indexed lookups is not.
 */
export async function installPack(
  pack: Pack,
  settings: Settings,
): Promise<InstallResult> {
  await ensureDefaultCollection()
  const now = Date.now()
  const collectionId = PACK_COLLECTION_IDS[pack.id] ?? newId()

  // The list itself. `put`, not `add`: enabling a pack that was removed
  // earlier should revive its list rather than fail on the id.
  const existingCollection = await db.collections.get(collectionId)
  const collection: Collection = {
    id: collectionId,
    name: pack.name,
    kind: 'library',
    packId: pack.id,
    sortOrder: existingCollection?.sortOrder ?? 100,
    active: existingCollection?.active ?? true,
    inExport: existingCollection?.inExport ?? true,
    createdAt: existingCollection?.createdAt ?? now,
    updatedAt: now,
  }
  await db.collections.put(collection)

  // --- what we already have ------------------------------------------------
  const [concepts, entries] = await Promise.all([
    db.concepts.toArray(),
    db.entries.toArray(),
  ])
  const live = new Set(concepts.filter((c) => !c.deletedAt).map((c) => c.id))
  const seenSeeds = new Set<string>()
  for (const c of concepts) {
    if (!c.deletedAt && c.seedId) seenSeeds.add(c.seedId)
  }
  const seenWords = new Set<string>()
  for (const c of concepts) {
    if (c.deletedAt) continue
    seenWords.add(lemmaKey(stripArticle(c.lemma, c.sourceLang), c.sourceLang))
  }
  for (const e of entries) {
    if (!live.has(e.conceptId)) continue
    seenWords.add(lemmaKey(stripArticle(e.headword, e.lang), e.lang))
  }

  // Entries are written for the native language and every target, including
  // paused ones — the same rule `applyExpansion` follows. Pausing German
  // means "stop asking me", not "stop collecting", so resuming it later must
  // not leave a hole where the pack should be.
  const entryLangs = [settings.nativeLang, ...settings.targetLangs]
  const cardLangs = settings.targetLangs

  const newConcepts: Concept[] = []
  const newEntries: Entry[] = []
  const newCards: Card[] = []
  let skipped = 0

  for (const row of pack.rows) {
    const seedId = row[0]
    if (seenSeeds.has(seedId)) {
      skipped++
      continue
    }
    if (collidesWithExisting(row, entryLangs, seenWords)) {
      skipped++
      continue
    }
    seenSeeds.add(seedId)

    const lemma = wordIn(row, settings.nativeLang) ?? wordIn(row, 'en') ?? seedId
    const conceptId = newId()
    newConcepts.push({
      id: conceptId,
      lemma,
      sourceLang: settings.nativeLang,
      pos: row[1],
      // `category` is the deprecated single field; the real topics are tags.
      category: 'uncategorised',
      tags: tagsOf(row),
      collectionId,
      seedId,
      createdAt: now,
      updatedAt: now,
    })

    for (const lang of new Set(entryLangs)) {
      const headword = wordIn(row, lang)
      if (!headword) continue
      newEntries.push({
        id: compositeId(conceptId, lang),
        conceptId,
        lang,
        headword,
        meaning: glossFor(row, lang, settings.nativeLang),
        // Morphology and example sentences are deliberately absent — see the
        // note at the top of ../seed/catalogue.ts. "redo" on the word fills
        // them in from the model when you want them.
        updatedAt: now,
      })
      // Claim the word so a later row in this same pack, or the next pack
      // enabled in the same session, sees it.
      seenWords.add(lemmaKey(stripArticle(headword, lang), lang))
    }

    for (const lang of cardLangs) {
      if (!wordIn(row, lang)) continue
      newCards.push(makeCard(conceptId, lang))
    }
  }

  // One transaction: a half-installed pack — concepts with no entries, or
  // entries with no cards — is worse than none, and the screen would show it
  // as a list of words with nothing on the other side.
  await db.transaction('rw', db.concepts, db.entries, db.cards, async () => {
    if (newConcepts.length) await db.concepts.bulkPut(newConcepts)
    if (newEntries.length) await db.entries.bulkPut(newEntries)
    if (newCards.length) await db.cards.bulkPut(newCards)
  })

  return { added: newConcepts.length, skipped, collectionId }
}

/** Does any language's headword for this row already exist in the store? */
function collidesWithExisting(
  row: SeedRow,
  langs: Lang[],
  seenWords: Set<string>,
): boolean {
  for (const lang of langs) {
    const headword = wordIn(row, lang)
    if (!headword) continue
    if (seenWords.has(lemmaKey(stripArticle(headword, lang), lang))) return true
  }
  return false
}

/**
 * Removes a pack and the words it brought.
 *
 * This one really does delete, unlike removing a list you made yourself,
 * which keeps the words. The difference is whose they are: a pack word you
 * never chose and have not edited is the app's, and leaving a hundred of them
 * loose in My words after you asked for the pack to go is not tidying up, it
 * is refusing to.
 *
 * Soft, like every delete here, so it replicates. A pack word you *have*
 * reviewed keeps its history in the review log either way.
 */
export async function removePack(packId: string): Promise<number> {
  const collectionId = PACK_COLLECTION_IDS[packId]
  if (!collectionId) return 0
  const now = Date.now()
  const concepts = await db.concepts
    .where('collectionId')
    .equals(collectionId)
    .toArray()
  const ids = concepts.map((c) => c.id)

  await db.transaction('rw', db.concepts, db.cards, db.collections, async () => {
    if (concepts.length) {
      await db.concepts.bulkPut(
        concepts.map((c) => ({ ...c, deletedAt: now, updatedAt: now })),
      )
    }
    if (ids.length) {
      const cards = await db.cards.where('conceptId').anyOf(ids).toArray()
      if (cards.length) {
        // Suspended rather than deleted, for the reason the delete button in
        // My words gives: a row removed locally that still exists on the
        // server comes back on the next full resync.
        await db.cards.bulkPut(
          cards.map((c) => ({ ...c, suspended: true, updatedAt: now })),
        )
      }
    }
    const collection = await db.collections.get(collectionId)
    if (collection) {
      await db.collections.put({ ...collection, deletedAt: now, updatedAt: now })
    }
  })

  return concepts.length
}

/**
 * How much of each pack is already in your vocabulary.
 *
 * Counted by `seedId` across every list, not by what is in the pack's own
 * list — a word moved out of A1 into "Words at work" is still a word you
 * have, and offering to add it again would be the app forgetting what it
 * gave you.
 */
export async function packStatus(): Promise<
  Map<string, { installed: number; total: number; listExists: boolean }>
> {
  const [concepts, collections] = await Promise.all([
    db.concepts.toArray(),
    db.collections.toArray(),
  ])
  const have = new Set(
    concepts.filter((c) => !c.deletedAt && c.seedId).map((c) => c.seedId as string),
  )
  const out = new Map<string, { installed: number; total: number; listExists: boolean }>()
  for (const pack of PACKS) {
    const id = PACK_COLLECTION_IDS[pack.id]
    out.set(pack.id, {
      installed: pack.rows.filter((r) => have.has(r[0])).length,
      total: pack.rows.length,
      listExists: collections.some((c) => c.id === id && !c.deletedAt),
    })
  }
  return out
}

/**
 * The languages a pack can currently fill, for the line under its name.
 *
 * Every row carries all eight, so this is really a statement about the
 * learner's settings rather than about the pack — but "adds 100 words in
 * Swedish and German" is the sentence someone needs before pressing the
 * button, and "the pack supports eight languages" is not.
 */
export function packLanguages(settings: Settings): Lang[] {
  return activeTargets(settings)
}

/** Words in a given list, for the counts on the word-lists screen. */
export async function wordsInCollection(collectionId: string): Promise<Concept[]> {
  const all = await db.concepts.toArray()
  return all.filter((c) => !c.deletedAt && collectionOf(c) === collectionId)
}
