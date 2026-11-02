import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { ExpansionSchema, MorphologySchema } from '../src/db/types'

const batch = JSON.parse(readFileSync('data/shared-vocab/batch-006.json', 'utf8'))
const source = JSON.parse(readFileSync('data/shared-vocab/batch-006-lexin.json', 'utf8'))
const languages = ['fa', 'en', 'sv', 'de', 'es', 'it']
assert.equal(batch.n, 1000)
assert.equal(batch.concepts.length, 1000)
assert.equal(new Set(batch.concepts.map((c: any) => c.id)).size, 1000)
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
assert.equal(entries, 6000)
assert.equal(morphology, 5000)
const bySwedish = (word: string) => batch.concepts.find((c: any) => c.e.sv.h.replace(/^(en|ett) /, '') === word)
assert.equal(bySwedish('förskola').e.sv.f.indefinitePlural, 'förskolor')
assert.equal(bySwedish('kristall').e.sv.f.definitePlural, 'kristallerna')
assert.equal(bySwedish('geni').e.sv.f.definitePlural, 'genierna')
assert.equal(bySwedish('pronomen').e.sv.f.definitePlural, 'pronomenen')
assert.equal(bySwedish('intrig').e.it.f.gender, 'il')
assert.equal(bySwedish('psykolog').e.it.f.plural, 'psicologi')
assert.equal(bySwedish('psykolog').e.de.f.genitiveSingular, 'Psychologen')
assert.equal(bySwedish('protokoll').e.es.f.gender, 'la')
assert.equal(bySwedish('protokoll').e.es.h, 'el acta')
assert.equal(bySwedish('genus').e.de.f.genitiveSingular, 'Genus')
for(const c of batch.concepts) {
  assert(!/[a-zA-Z]/.test(c.e.fa.h), `Unexpected Latin label in Persian headword: ${c.id}`)
  for(const lang of languages) {
    for(const v of Object.values(c.e[lang].f ?? {})) {
      assert(!['el.', 'eller', '-', '='].includes(String(v)), `Unprocessed morphology alternative: ${c.id}:${lang}`)
    }
  }
}
console.log(JSON.stringify({concepts:1000,entries,morphology,expansionParses:6000,failures:0}))

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
