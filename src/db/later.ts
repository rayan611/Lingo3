import { db } from './db'

/**
 * The parked-word list, without the screen that shows it.
 *
 * Its own module rather than living beside the component: the checks drive
 * these two functions directly, and a check script that has to import a React
 * file to park a word is one dependency away from failing for reasons that
 * have nothing to do with parking words.
 */

/** Same word twice is one entry — case and surrounding space ignored. */
function key(lemma: string): string {
  return lemma.trim().toLocaleLowerCase()
}

/**
 * Parks a word for later. Returns false when it is already on the list, so
 * the caller can say so rather than silently doing nothing.
 */
export async function parkWord(lemma: string): Promise<boolean> {
  const text = lemma.trim()
  if (!text) return false
  const now = Date.now()
  const existing = await db.later.toArray()
  const match = existing.find((row) => key(row.lemma) === key(text))
  if (match && !match.deletedAt) return false
  // A word you removed and then wrote down again comes back as the row it
  // already was, revived. A second row with the same word would show twice on
  // the list, and the removal has to stay representable — a deleted row is
  // how the other device learns it went away.
  if (match) {
    await db.later.put({ ...match, lemma: text, deletedAt: undefined, updatedAt: now })
    return true
  }
  await db.later.add({
    id: crypto.randomUUID(),
    lemma: text,
    createdAt: now,
    updatedAt: now,
  })
  return true
}

/**
 * Takes a word off the list. Soft, because the list follows the account now:
 * a row that is simply gone locally always loses last-write-wins and would be
 * handed back by the next full resync.
 */
export async function dropLaterWord(id: string): Promise<void> {
  const row = await db.later.get(id)
  if (!row) return
  const now = Date.now()
  await db.later.put({ ...row, deletedAt: now, updatedAt: now })
}
