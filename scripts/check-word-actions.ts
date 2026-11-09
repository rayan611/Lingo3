import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { db, openForUser, ensureSettings } from '../src/db/db'
import { makeCard } from '../src/fsrs/scheduler'
import { changeWordAccess } from '../src/db/wordActions'
import { buildQueue, queueCounts } from '../src/fsrs/queue'

await openForUser('word-actions-test')
const settings = await ensureSettings()
const id = 'removal-fixture'
await db.concepts.put({ id, lemma: 'fixture', sourceLang: 'en', pos: 'noun', createdAt: 1, updatedAt: 1 })
await db.entries.put({ id: `${id}:en`, conceptId: id, lang: 'en', headword: 'fixture', meaning: 'test word', updatedAt: 1 })
for (const lang of settings.activeLangs) await db.cards.put(makeCard(id, lang))
assert.ok((await buildQueue(settings)).some((row) => row.concept.id === id))
const before = await db.cards.toArray()
await changeWordAccess(id, 'pause')
assert.equal((await buildQueue(settings)).length, 0)
assert.equal((await queueCounts(settings)).total, 0)
assert.equal((await db.concepts.get(id))?.deletedAt, undefined)
assert.equal(await db.entries.count(), 1)
await changeWordAccess(id, 'resume')
assert.deepEqual((await db.cards.toArray()).map(({updatedAt, suspended, ...c}) => c), before.map(({updatedAt, suspended, ...c}) => c))
await changeWordAccess(id, 'remove')
assert.ok((await db.concepts.get(id))?.deletedAt)
assert.ok((await db.cards.toArray()).every(c => c.suspended))
assert.equal(await db.entries.count(), 1)
assert.equal((await queueCounts(settings)).total, 0)
await assert.rejects(changeWordAccess(id, 'resume'))
await db.delete()
console.log('Word removal, suspension, restore, retained entries and queue counts pass.')
