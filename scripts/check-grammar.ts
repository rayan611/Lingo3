import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { Lingo3DB, db, openForUser, adoptLocalData } from '../src/db/db'
import { reconcileGrammar, grammarPayload, type GrammarItem, type GrammarRow, type GrammarTable, type GrammarTransport } from '../src/sync/grammarSync'
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
if (!globalThis.CustomEvent) Object.defineProperty(globalThis, 'CustomEvent', { value: class CustomEvent extends Event {} })
const a = new Lingo3DB('grammar-test-a'), b = new Lingo3DB('grammar-test-b')
const remote = new Map<string, GrammarRow>()
let beforeWrite: (() => Promise<void>) | undefined
const transport: GrammarTransport = {
  async read(name) { return structuredClone([...remote.entries()].filter(([key]) => key.startsWith(name)).map(([, row]) => row)) },
  async write(name, item, version) {
    if (beforeWrite) { const run = beforeWrite; beforeWrite = undefined; await run() }
    const key = name + item.id, old = remote.get(key)
    if ((old?.version ?? 0) !== version) return { applied: false, row: structuredClone(old!) }
    const row: GrammarRow = { id: item.id, user_id: 'test-owner', version: Number(version) + 1, payload: grammarPayload(item) }
    remote.set(key, row)
    return { applied: true, row: structuredClone(row) }
  },
}
const section: GrammarItem = { id: crypto.randomUUID(), lang: 'sv', title: 'Nouns', sortOrder: 1, createdAt: 1, updatedAt: 1 }
const rule: GrammarItem = { id: crypto.randomUUID(), lang: 'sv', sectionId: section.id, title: 'Plural', explanation: 'Original', examples: [], tags: [], createdAt: 1, updatedAt: 1 }
try {
  await a.grammarSections.put(section)
  await a.grammarRules.put(rule)
  assert.equal(await reconcileGrammar(a, transport), 0)
  await reconcileGrammar(b, transport)
  assert.equal((await b.grammarRules.get(rule.id))?.explanation, 'Original')
  await a.grammarRules.update(rule.id, { explanation: 'Laptop edit', updatedAt: 2 })
  await b.grammarRules.update(rule.id, { explanation: 'Phone edit', updatedAt: 2 })
  await reconcileGrammar(a, transport)
  assert.equal(await reconcileGrammar(b, transport), 1)
  assert.equal((await b.grammarRules.get(rule.id))?.explanation, 'Laptop edit')
  assert.ok((await b.grammarRules.toArray()).some(item => item.explanation === 'Phone edit' && item.id !== rule.id))
  await reconcileGrammar(b, transport)
  await reconcileGrammar(a, transport)
  assert.equal(await a.grammarRules.count(), 2)
  // Delete propagates even with an earlier device clock.
  await a.grammarRules.update(rule.id, { deletedAt: 1, updatedAt: 1 })
  await reconcileGrammar(a, transport)
  await reconcileGrammar(b, transport)
  assert.equal((await b.grammarRules.get(rule.id))?.deletedAt, 1)
  // An offline edit racing with a remote deletion becomes a visible copy.
  const copy = (await b.grammarRules.toArray()).find(item => item.id !== rule.id)!
  await a.grammarRules.update(copy.id, { deletedAt: 3, updatedAt: 3 })
  await b.grammarRules.update(copy.id, { explanation: 'Preserve after deletion', updatedAt: 4 })
  await reconcileGrammar(a, transport)
  assert.equal(await reconcileGrammar(b, transport), 1)
  assert.ok((await b.grammarRules.toArray()).some(item => !item.deletedAt && item.explanation === 'Preserve after deletion'))
  // Network errors cannot discard local edits.
  const failing: GrammarTransport = { ...transport, read: async () => { throw new Error('offline') } }
  await assert.rejects(reconcileGrammar(b, failing), /offline/)
  // Changes made while an upload is in flight remain dirty and upload next time.
  const live = (await b.grammarRules.toArray()).find(item => !item.deletedAt)!
  beforeWrite = async () => { await b.grammarRules.update(live.id, { explanation: 'Typed during upload' }) }
  await reconcileGrammar(b, transport)
  assert.equal((await b.grammarRules.get(live.id))?.explanation, 'Typed during upload')
  await reconcileGrammar(b, transport)
  assert.equal((remote.get('grammar_rules' + live.id)?.payload as typeof live).explanation, 'Typed during upload')
  // Account cancellation happens before any local data can be changed.
  const before = await b.grammarRules.toArray()
  await assert.rejects(reconcileGrammar(b, transport, () => { throw new Error('account changed') }), /account changed/)
  assert.deepEqual(await b.grammarRules.toArray(), before)
  assert.equal('cloudVersion' in grammarPayload((await b.grammarRules.get(live.id))!), false)
  await openForUser(null)
  await db.grammarSections.put(section)
  await db.grammarRules.put(rule)
  await openForUser('grammar-owner-a')
  await adoptLocalData()
  assert.equal(await db.grammarSections.count(), 1)
  assert.equal(await db.grammarRules.count(), 1)
  await openForUser('grammar-owner-b')
  assert.equal(await db.grammarSections.count(), 0)
  assert.equal(await db.grammarRules.count(), 0)
  await db.delete()
  await openForUser('grammar-owner-a')
  await db.delete()
  await openForUser(null)
  assert.equal(await db.grammarSections.count(), 0)
  await db.delete()
  console.log('Grammar checks passed: anonymous adoption and account isolation, two-device create/edit/delete, clock skew, conflict copies, offline retry, in-flight edit, account cancellation, metadata stripping.')
} finally { await a.delete(); await b.delete() }
