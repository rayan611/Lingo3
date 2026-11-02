import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { ExpansionSchema, MorphologySchema } from '../src/db/types'

const batch = JSON.parse(readFileSync('data/shared-vocab/batch-005.json', 'utf8'))
const source = JSON.parse(readFileSync('data/shared-vocab/batch-005-lexin.json', 'utf8'))
const languages = ['fa', 'en', 'sv', 'de', 'es', 'it']
assert.equal(batch.n, 350)
assert.equal(batch.concepts.length, 350)
assert.equal(new Set(batch.concepts.map((c: any) => c.id)).size, 350)
let entries = 0, morphology = 0
for (const c of batch.concepts) {
  assert.equal(c.p, 'noun')
  assert.deepEqual(Object.keys(c.e).sort(), [...languages].sort())
  const src = source.selected.find((s: any) => s.id === c.id)
  assert(src, `Missing Lexin source: ${c.id}`)
  assert.equal(c.e.sv.h, src.gender + ' ' + src.parts[0])
  for (const lang of languages) {
    const e = c.e[lang]
    assert(e.h.trim().length > 0 && e.x.trim().length > 5, `${c.id}:${lang}`)
    assert(!/[|<>]/.test(e.h + e.x), `Unprocessed input: ${c.id}:${lang}`)
    if (lang !== 'fa') {
      MorphologySchema.parse({ lang, form: e.f })
      assert.equal(e.f.kind, c.p)
      if (lang === 'sv') {
        assert(e.f.definiteSingular)
        assert(e.f.indefinitePlural && e.f.definitePlural || e.n)
      } else assert(e.f.plural || e.n)
      if (lang === 'de') assert(e.f.genitiveSingular)
      morphology++
    }
    entries++
  }
  // Exact card output accepted by the app, for every possible native language.
  for (const native of languages) {
    ExpansionSchema.parse({ pos:c.p, detectedLang:'sv', tags:c.t,
      entries:languages.map(lang => ({lang, headword:c.e[lang].h,
        meaning:c.e[native].h, example:c.e[lang].x,
        exampleGloss:c.e[native].x, ...(c.e[lang].f ? {morphology:c.e[lang].f}:{}),
        ...(c.e[lang].n ? {notes:c.e[lang].n}:{})})) })
  }
}
assert.equal(entries, 2100)
assert.equal(morphology, 1750)
console.log(JSON.stringify({concepts:350,entries,morphology,expansionParses:2100,failures:0}))

// Optionally validate actual RPC outputs captured under authenticated RLS.
if (process.argv[2]) {
  const results = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  let passes=0
  for(const row of results) {
    assert(row.answer, `Null lookup: ${row.id}:${row.lang}`)
    const parsed=ExpansionSchema.parse(row.answer)
    assert.equal(parsed.entries.length,6)
    for(const e of parsed.entries) if(e.morphology) MorphologySchema.parse({lang:e.lang,form:e.morphology})
    passes++
  }
  console.log(JSON.stringify({liveLookupParses:passes,failures:0}))
}
