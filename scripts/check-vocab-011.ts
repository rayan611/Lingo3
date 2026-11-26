import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ExpansionSchema, MorphologySchema } from '../src/db/types'
import { wordFormKeys } from '../src/server/sharedVocab'

// Validates the batch exactly as the app would read it: every language present, one non-empty example each,
// morphology parses with the app's own schema, no duplicate id or headword inside the batch.
const path = process.env.BATCH_FILE ?? new URL('../data/shared-vocab/batch-011.json', import.meta.url).pathname
const doc = JSON.parse(readFileSync(path, 'utf8'))
assert.equal(doc.format, 'lingo3-vocab/1')
assert.equal(doc.n, doc.concepts.length)
const languages = ['de', 'en', 'es', 'fa', 'fr', 'it', 'ru', 'sv']
const ids = new Set<string>(), heads = new Map<string, string>()
let entries = 0, bad = 0
for (const c of doc.concepts) {
  assert(!ids.has(c.id), 'duplicate id ' + c.id); ids.add(c.id)
  assert(['noun', 'verb', 'adjective', 'adverb'].includes(c.p), c.id)
  assert.deepEqual(Object.keys(c.e).sort(), languages, c.id + ' needs all eight languages')
  const expanded: { lang: string; headword: string; meaning: string; morphology?: unknown; example: string }[] = []
  for (const lang of languages) {
    const e = c.e[lang]
    assert(e.h && e.h.length <= 100, `${c.id} ${lang}: headword`)
    assert(e.x && e.x.trim().length > 3 && e.x.length <= 500, `${c.id} ${lang}: example`)
    const key = `${lang}:${c.p}:${e.h.normalize('NFC').toLowerCase()}`
    assert(!heads.has(key), `duplicate headword in batch: ${key} (${heads.get(key)} / ${c.id})`)
    heads.set(key, c.id)
    if (e.f) {
      try {
        MorphologySchema.parse({ lang, form: e.f })
        assert(wordFormKeys(e.h, lang, e.f).length > 0)
      } catch (err) {
        bad++
        console.error('bad morphology', c.id, lang, String(err).slice(0, 200))
      }
    }
    expanded.push({ lang, headword: e.h, meaning: c.e.fa.h, morphology: e.f, example: e.x })
    entries++
  }
  try {
    ExpansionSchema.parse({ pos: c.p, detectedLang: 'sv', entries: expanded })
  } catch (err) {
    bad++
    console.error('bad expansion', c.id, String(err).slice(0, 300))
  }
}
assert.equal(bad, 0, `${bad} problems`)
console.log(`Batch 011: ${doc.concepts.length} concepts / ${entries} entries in 8 languages, morphology and expansion schemas pass, no duplicate ids or headwords.`)
