import { db, newId } from './db'
import {
  DEFAULT_COLLECTION_ID,
  DEFAULT_COLLECTION_NAME,
  DEFAULT_PLAN,
  PLANS,
  collectionOf,
  type Collection,
  type Plan,
  type PlanName,
  type Settings,
} from './types'

/**
 * Collections — the one list a word is filed in.
 *
 * Everything here is local-first like the rest of the app: these functions
 * write Dexie, and sync carries the rows afterwards. Nothing in this file
 * touches the network, which is what lets you make a list, fill it and study
 * it on a train.
 *
 * The invariant the whole file exists to hold: every concept belongs to
 * exactly one collection, and that collection exists. `collectionOf()` is the
 * read side of it — a word written before collections, or pulled from a
 * device that has not updated yet, resolves to the default list rather than
 * to nothing.
 */

export class CollectionLimitError extends Error {
  constructor(
    message: string,
    /** What the user would have to do about it. Shown under the message. */
    readonly remedy: string,
  ) {
    super(message)
    this.name = 'CollectionLimitError'
  }
}

/** The limits in force for this account. */
export function planOf(settings: Pick<Settings, 'plan'>): Plan {
  return PLANS[(settings.plan ?? DEFAULT_PLAN) as PlanName]
}

/**
 * Creates the default list if it is missing. Call it at boot, next to
 * `ensureSettings`, and never from inside a live query — a write that
 * re-triggers the query that performed it is how the app span on a fresh
 * database once already.
 */
export async function ensureDefaultCollection(): Promise<Collection> {
  const existing = await db.collections.get(DEFAULT_COLLECTION_ID)
  if (existing) return existing
  const now = Date.now()
  const fresh: Collection = {
    id: DEFAULT_COLLECTION_ID,
    name: DEFAULT_COLLECTION_NAME,
    kind: 'user',
    sortOrder: 0,
    active: true,
    inExport: true,
    createdAt: now,
    // `0` rather than now, for the same reason the settings row uses it: a
    // second device creating its own copy of the default must not out-rank
    // the one already on the account, or a renamed list would be renamed
    // back to "My words" by whichever device opened the app last.
    updatedAt: 0,
  }
  await db.collections.put(fresh)
  return fresh
}

/** Every list, newest ordering rules applied: user lists first, then packs. */
export async function listCollections(): Promise<Collection[]> {
  const all = await db.collections.toArray()
  return all
    .filter((c) => !c.deletedAt)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'user' ? -1 : 1
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.createdAt - b.createdAt
    })
}

/** How many live words are in each list, keyed by collection id. */
export async function collectionCounts(): Promise<Map<string, number>> {
  const concepts = await db.concepts.toArray()
  const out = new Map<string, number>()
  for (const c of concepts) {
    if (c.deletedAt) continue
    const id = collectionOf(c)
    out.set(id, (out.get(id) ?? 0) + 1)
  }
  return out
}

/**
 * The lists whose words are being studied.
 *
 * `null` means "no filtering needed" — every list is active — and the queue
 * uses it to skip the filter entirely rather than building a set of every id
 * it has. On the common path, where nothing has been set aside, this costs
 * one read and changes nothing downstream.
 */
export async function activeCollectionIds(): Promise<Set<string> | null> {
  const all = await db.collections.toArray()
  const off = all.filter((c) => !c.deletedAt && !c.active)
  if (off.length === 0) return null
  const on = new Set(all.filter((c) => !c.deletedAt && c.active).map((c) => c.id))
  // The default list is always studied unless it was explicitly switched off,
  // including when it does not exist as a row yet on a fresh install.
  if (!all.some((c) => c.id === DEFAULT_COLLECTION_ID)) {
    on.add(DEFAULT_COLLECTION_ID)
  }
  return on
}

/**
 * Is this word in a list that is being studied?
 *
 * Takes the resolved set rather than reading the database, because the queue
 * calls it once per candidate concept and a read per word would turn building
 * a queue into hundreds of them.
 */
export function inActiveCollection(
  concept: { collectionId?: string },
  active: Set<string> | null,
): boolean {
  if (active === null) return true
  return active.has(collectionOf(concept))
}

/**
 * Makes a list.
 *
 * The limit is counted over `user` lists only: the shipped packs are free, for
 * the reason given next to PLANS — three slots filled by A1, A2 and everyday
 * words would leave a new account nowhere to put its own words.
 */
export async function createCollection(
  name: string,
  settings: Pick<Settings, 'plan'>,
): Promise<Collection> {
  const clean = name.trim().slice(0, 60)
  if (!clean) throw new Error('Give the list a name first.')

  const all = await listCollections()
  if (all.some((c) => c.kind === 'user' && c.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
    throw new Error(`You already have a list called "${clean}".`)
  }

  const limit = planOf(settings).collections
  const used = all.filter((c) => c.kind === 'user').length
  if (used >= limit) {
    throw new CollectionLimitError(
      `That would be list ${used + 1}, and this account has room for ${limit}.`,
      'Rename or empty one you are no longer using, or lift the limits in Settings.',
    )
  }

  const now = Date.now()
  const collection: Collection = {
    id: newId(),
    name: clean,
    kind: 'user',
    sortOrder: all.length,
    active: true,
    inExport: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.collections.add(collection)
  return collection
}

/** Changes one field and stamps it, so the change reaches the other device. */
async function patch(id: string, patch: Partial<Collection>): Promise<void> {
  const current = await db.collections.get(id)
  if (!current) return
  await db.collections.put({ ...current, ...patch, updatedAt: Date.now() })
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, 60)
  if (!clean) throw new Error('A list needs a name.')
  await patch(id, { name: clean })
}

/**
 * Takes a whole list in or out of the review queue.
 *
 * Deliberately a flag on the list rather than suspending its cards. Suspending
 * writes every card in the list and sends every one of them through the next
 * sync, and then "unpause" has to know which cards were already suspended for
 * their own reasons before it un-suspends them — which it cannot, because that
 * information was overwritten. One boolean cannot get that wrong.
 */
export async function setCollectionActive(id: string, active: boolean): Promise<void> {
  await patch(id, { active })
}

export async function setCollectionInExport(id: string, inExport: boolean): Promise<void> {
  await patch(id, { inExport })
}

/**
 * Removes a list and keeps its words, by moving them to the default list.
 *
 * Deleting the words too was the other option and it is the wrong default: a
 * list is a filing decision and the words in it are months of review history.
 * Anyone who truly wants them gone can delete them from My words, where the
 * confirmation names what is being lost.
 */
export async function deleteCollection(id: string): Promise<number> {
  if (id === DEFAULT_COLLECTION_ID) {
    throw new Error('The default list cannot be removed.')
  }
  const now = Date.now()
  await ensureDefaultCollection()
  const moved = await db.concepts.where('collectionId').equals(id).toArray()
  if (moved.length) {
    await db.concepts.bulkPut(
      moved.map((c) => ({ ...c, collectionId: DEFAULT_COLLECTION_ID, updatedAt: now })),
    )
  }
  await patch(id, { deletedAt: now })
  return moved.length
}

/** Moves one word to another list. */
export async function moveWord(conceptId: string, collectionId: string): Promise<void> {
  const concept = await db.concepts.get(conceptId)
  if (!concept) return
  if (collectionOf(concept) === collectionId) return
  await db.concepts.put({ ...concept, collectionId, updatedAt: Date.now() })
}

/**
 * How much room is left in a list, and whether `wanted` more words will fit.
 *
 * Returned rather than thrown so a bulk add can trim to what fits and say so,
 * instead of refusing the whole paste because the last three words of it were
 * over the line.
 */
export async function roomIn(
  collectionId: string,
  settings: Pick<Settings, 'plan'>,
  wanted = 1,
): Promise<{ used: number; limit: number; free: number; fits: number }> {
  const limit = planOf(settings).wordsPerCollection
  const used = await db.concepts
    .where('collectionId')
    .equals(collectionId)
    .filter((c) => !c.deletedAt)
    .count()
  const free = Math.max(0, limit - used)
  return { used, limit, free, fits: Math.min(wanted, free) }
}

/**
 * The list a new word goes into when nobody said.
 *
 * The first `user` list that still has room, default first. A pack list is
 * never chosen: those hold a curated set and a word typed by hand does not
 * belong in the middle of A1.
 */
export async function defaultTargetCollection(
  settings: Pick<Settings, 'plan'>,
): Promise<string> {
  await ensureDefaultCollection()
  const all = await listCollections()
  const mine = all.filter((c) => c.kind === 'user')
  const ordered = [
    ...mine.filter((c) => c.id === DEFAULT_COLLECTION_ID),
    ...mine.filter((c) => c.id !== DEFAULT_COLLECTION_ID),
  ]
  for (const c of ordered) {
    const { free } = await roomIn(c.id, settings)
    if (free > 0) return c.id
  }
  // Every list full. Return the default anyway and let the caller's own room
  // check produce the message — "which list" and "is there room" are two
  // questions and answering the first with an exception confuses them.
  return DEFAULT_COLLECTION_ID
}
