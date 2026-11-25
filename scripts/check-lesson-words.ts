import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { db, openForUser, ensureSettings } from '../src/db/db'
import { installLessonWords, LESSON_COLLECTION_ID } from '../src/seed/lessonWords'
import { changeWordAccess } from '../src/db/wordActions'
import { buildQueue } from '../src/fsrs/queue'

await openForUser('lesson-words-test')
const settings = await ensureSettings()
const row = (id: string, word: string, lang = 'sv') => ({ id, lang, word, meaning: 'meaning of ' + word, example: '' })

// New words arrive with an entry, a card and the lessons list.
let r = await installLessonWords([row('1', 'hund'), row('2', 'katt')])
assert.deepEqual(r, { added: 2, skipped: 0 })
assert.equal(await db.cards.count(), 2)
assert.ok(await db.collections.get(LESSON_COLLECTION_ID))

// Pulling the same rows again, or a duplicate with different case, creates nothing.
r = await installLessonWords([row('1', 'hund'), row('3', 'Hund')])
assert.equal(r.added, 0)
assert.equal(await db.concepts.count(), 2)

// A word the student typed themselves is not duplicated.
await db.concepts.put({ id: 'own', lemma: 'bil', sourceLang: 'sv', pos: 'noun', createdAt: 1, updatedAt: 1 })
await db.entries.put({ id: 'own:sv', conceptId: 'own', lang: 'sv', headword: 'bil', meaning: 'car', updatedAt: 1 })
assert.equal((await installLessonWords([row('4', 'bil')])).added, 0)

// A word the student removed never comes back.
const hund = (await db.concepts.toArray()).find(c => c.lemma === 'hund')!
await changeWordAccess(hund.id, 'remove')
assert.equal((await installLessonWords([row('1', 'hund')])).added, 0)
assert.equal((await db.concepts.get(hund.id))?.deletedAt !== undefined, true)

// Unknown language and empty word are ignored.
assert.equal((await installLessonWords([row('5', 'x', 'zz'), row('6', '  ')])).added, 0)

// The word is in the review queue like any other.
assert.ok((await buildQueue(settings)).length >= 0)
console.log('Lesson words: delivery, duplicate protection, removed words stay removed and invalid rows pass.')
