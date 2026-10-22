import { db } from '../db/db'

/**
 * Take a word out of review: every card is suspended, so it never enters the
 * recall queue or the Review list, but its FSRS state is kept and "resume" in
 * My words brings it straight back.
 */
export async function removeFromReview(conceptId: string) {
  const cards = await db.cards.where('conceptId').equals(conceptId).toArray()
  if (cards.length === 0) return
  const now = Date.now()
  await db.cards.bulkPut(cards.map((c) => ({ ...c, suspended: true, updatedAt: now })))
}

/**
 * Delete a word. Soft delete throughout: removing the card rows locally while
 * they live on the server meant the next full resync quietly put them back,
 * because a row that is absent locally always looks older than the remote one.
 * Suspending them instead takes them out of the queue and replicates.
 */
export async function deleteWord(conceptId: string) {
  const now = Date.now()
  const concept = await db.concepts.get(conceptId)
  if (concept) {
    await db.concepts.put({ ...concept, deletedAt: now, updatedAt: now })
  }
  const cards = await db.cards.where('conceptId').equals(conceptId).toArray()
  if (cards.length) {
    await db.cards.bulkPut(cards.map((c) => ({ ...c, suspended: true, updatedAt: now })))
  }
}
