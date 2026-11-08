import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ExpansionSchema, MorphologySchema } from '../src/db/types'
import { wordFormKeys } from '../src/server/sharedVocab'

const doc = JSON.parse(readFileSync(new URL('../data/shared-vocab/batch-010.json', import.meta.url), 'utf8'))
assert.equal(doc.format, 'lingo3-vocab/1')
assert.equal(doc.n, 200)
assert.equal(doc.concepts.length, 200)
const languages = ['de','en','es','fa','fr','it','ru','sv']
const ids = new Set<string>(), heads = new Set<string>()
let forms = 0, entries = 0, aliases = 0
for (const c of doc.concepts) {
  assert(!ids.has(c.id)); ids.add(c.id)
  assert.equal(c.p, 'verb')
  assert.deepEqual(Object.keys(c.e).sort(), languages)
  const expanded = []
  for (const lang of languages) {
    const e = c.e[lang]
    assert(e.h && e.h.length <= 100 && e.x && e.x.length <= 500)
    const key = `${lang}:${e.h.normalize('NFC').toLowerCase()}`
    assert(!heads.has(key), key); heads.add(key)
    const parsed = MorphologySchema.parse({lang,form:e.f})
    assert.equal((parsed.form as {additionalForms?:string}).additionalForms, e.f.additionalForms)
    const keys = wordFormKeys(e.h, lang, e.f)
    assert(keys.length > 0)
    aliases += keys.length
    if (e.f.additionalForms) assert(keys.includes(e.f.additionalForms.split('; ')[0].toLowerCase()))
    expanded.push({lang,headword:e.h,meaning:c.e.fa.h,morphology:e.f,example:e.x})
    forms++;entries++
  }
  ExpansionSchema.parse({pos:'verb',detectedLang:'sv',entries:expanded})
}
assert.equal(entries,1600)
const find = (en:string,lang:string) => doc.concepts.find((c:any)=>c.e.en.h === `to ${en}`).e[lang].f
assert.equal(find('steal','sv').supinum,'stulit')
assert.equal(find('steal','de').partizip2,'gestohlen')
assert.equal(find('steal','en').past,'stole')
assert.equal(find('survive','it').ausiliare,'essere')
assert.equal(find('dare','es').presente,'se atreve')
assert(wordFormKeys('voler','fr',find('steal','fr')).includes('volaient'))
assert(wordFormKeys('stjäla','sv',find('steal','sv')).includes('stulit'))
assert(wordFormKeys('красть','ru',find('steal','ru')).includes('крадёт'))
const guarded = wordFormKeys('sitta','sv',{kind:'verb',presens:'sitter',auxiliary:'haben',separable:true})
assert(!guarded.includes('haben') && !guarded.includes('true') && !guarded.includes('verb'))
console.log(JSON.stringify({concepts:ids.size,entries,morphologyParses:forms,searchableKeys:aliases}))
