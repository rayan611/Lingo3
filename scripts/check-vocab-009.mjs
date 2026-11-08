import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const text = read('data/shared-vocab/batch-009.json')
const doc = JSON.parse(text)
const pairs = JSON.parse(read('data/shared-vocab/batch-009-antonyms.json'))
assert.equal(doc.format, 'lingo3-vocab/1')
assert.equal(doc.n, 100)
assert.equal(doc.concepts.length, 100)
assert.equal(doc.concepts.filter(c => c.p === 'adjective').length, 50)
assert.equal(doc.concepts.filter(c => c.p === 'adverb').length, 50)
const langs = ['de','en','es','fa','it','sv']
assert.deepEqual([...doc.langs].sort(), langs)
const ids = new Set()
const words = new Set()
let entries = 0, forms = 0, opposites = 0
for (const c of doc.concepts) {
  assert(!ids.has(c.id), c.id); ids.add(c.id)
  assert.deepEqual(Object.keys(c.e).sort(), langs)
  assert(c.t.length <= 4 && c.t.every(t => t.length <= 24))
  for (const [lang,e] of Object.entries(c.e)) {
    assert(typeof e.h === 'string' && e.h.trim() && e.h.length <= 100)
    assert(typeof e.x === 'string' && e.x.trim() && e.x.length <= 500)
    const key = [c.p,lang,e.h.normalize('NFC').trim().toLowerCase()].join(':')
    assert(!words.has(key), key); words.add(key); entries++
    if (c.p === 'adjective') {
      assert(typeof e.n === 'string' && e.n.includes(': ')); opposites++
      if (lang !== 'fa') {
        assert.equal(e.f.kind, 'adjective')
        const fields = new Set(['kind','common','masculine','feminine','neuter','plural','definite','comparative','superlative'])
        for (const [k,v] of Object.entries(e.f)) {
          assert(fields.has(k) && typeof v === 'string' && v.trim(), c.id + ':' + k)
        }
        if (lang === 'sv') assert(e.f.common && e.f.plural && e.f.definite)
        if (lang === 'es' || lang === 'it') assert(e.f.masculine && e.f.feminine && e.f.plural)
        forms++
      }
    }
  }
}
assert.equal(pairs.length, 30)
const covered = new Set()
for (const p of pairs) {
  for (const [side, other] of [['left','right'],['right','left']]) {
    const c = doc.concepts.find(c => c.id === p[side])
    if (!c) continue
    covered.add(c.id)
    for (const lang of langs) {
      assert.equal(c.e[lang].h, p[side + 'Words'][lang])
      assert(c.e[lang].n.endsWith(': ' + p[other + 'Words'][lang] + '.'), c.id + ':' + lang)
    }
  }
}
assert.equal(covered.size, 50)
console.log(JSON.stringify({concepts:ids.size,entries,morphologies:forms,oppositeNotes:opposites,antonymPairs:pairs.length,sha256:createHash('sha256').update(text).digest('hex')}))
