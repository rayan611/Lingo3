import { db } from './db'

/** Personal-store changes only. Shared vocabulary and review history are retained. */
export async function changeWordAccess(id: string, action: 'pause' | 'resume' | 'remove') {
  await db.transaction('rw', db.concepts, db.cards, async () => {
    const concept = await db.concepts.get(id)
    if (!concept || concept.deletedAt) throw new Error('This word is no longer in your list.')
    const now = Date.now()
    if (action === 'remove') {
      await db.concepts.put({ ...concept, deletedAt: now, updatedAt: now })
    }
    const cards = await db.cards.where('conceptId').equals(id).toArray()
    await db.cards.bulkPut(cards.map((c) => ({ ...c, suspended: action !== 'resume', updatedAt: now })))
  })
}
