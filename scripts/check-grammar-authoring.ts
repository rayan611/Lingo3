import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { db, openForUser } from '../src/db/db'
import { addGrammarSection, addGrammarRule, renameGrammarSection, deleteGrammarSection, deleteGrammarRule, updateGrammarRule, validateGrammarExamples } from '../src/db/grammar'
import { emptyGrammarDraft, grammarDraftKey, readGrammarDraft, writeGrammarDraft } from '../src/ui/grammarDraft'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'sessionStorage', { value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } })
if (!globalThis.CustomEvent) Object.defineProperty(globalThis, 'CustomEvent', { value: class CustomEvent extends Event {} })
await openForUser('grammar-authoring-test')
try {
  const section = await addGrammarSection('sv', 'Nouns')
  await renameGrammarSection(section.id, '  Swedish nouns  ')
  assert.equal((await db.grammarSections.get(section.id))?.title, 'Swedish nouns')
  await assert.rejects(renameGrammarSection(section.id, ' '), /required/)
  const rule = await addGrammarRule('sv', section.id, 'Plural', 'Notes')
  await assert.rejects(deleteGrammarSection(section.id), /Only empty/)
  assert.equal((await db.grammarRules.get(rule.id))?.deletedAt, undefined)
  const incomplete = [{ id: 'ex', sentence: 'Ett hus.', translation: '', translationLang: 'en' as const }]
  assert.throws(() => validateGrammarExamples(incomplete), /Example 1 translation/)
  await assert.rejects(updateGrammarRule(rule.id, { title: 'Changed', examples: incomplete }), /Example 1 translation/)
  assert.equal((await db.grammarRules.get(rule.id))?.title, 'Plural')
  assert.equal(incomplete.length, 1)
  await deleteGrammarRule(rule.id)
  const child = await addGrammarSection('sv', 'Child', section.id)
  await assert.rejects(deleteGrammarSection(section.id), /Only empty/)
  await deleteGrammarSection(child.id)
  await deleteGrammarSection(section.id)
  assert.ok((await db.grammarSections.get(section.id))?.deletedAt)
  assert.ok(await db.grammarRules.get(rule.id), 'Soft deletion retains records')
  await assert.rejects(addGrammarRule('sv', section.id, 'Invalid', 'Notes'), /Invalid grammar section/)

  const key = grammarDraftKey('owner-a', 'sv')
  const draft = { ...emptyGrammarDraft(), title: 'Unfinished', examples: incomplete }
  writeGrammarDraft(key, draft)
  assert.deepEqual(readGrammarDraft(key), draft, 'Language switch/remount retains incomplete examples')
  assert.equal(readGrammarDraft(grammarDraftKey('owner-a', 'de')).title, '')
  assert.equal(readGrammarDraft(grammarDraftKey('owner-b', 'sv')).title, '')
  const reloadKey = grammarDraftKey('owner-a', 'en')
  storage.set(reloadKey, JSON.stringify(draft))
  assert.equal(readGrammarDraft(reloadKey).title, 'Unfinished', 'Tab storage reload restoration')
  storage.set('corrupt', '{broken')
  assert.deepEqual(readGrammarDraft('corrupt'), emptyGrammarDraft())
  console.log('Grammar authoring: validation without data loss, rename, protected empty-only deletion, soft deletion, draft restoration and account/language isolation pass.')
} finally { await db.delete() }
