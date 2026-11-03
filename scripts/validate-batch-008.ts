import {readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {ExpansionSchema,MorphologySchema} from '../src/db/types'
const path=process.argv[2]??'data/shared-vocab/batch-008.json'
const doc=JSON.parse(readFileSync(path,'utf8'))
const langs=['fa','en','sv','de','es','it']
assert.equal(doc.format,'lingo3-vocab/1')
assert.equal(doc.n,doc.concepts.length)
assert.equal(new Set(doc.concepts.map((x:any)=>x.id)).size,doc.n)
const failures:any[]=[];let morphology=0,expansions=0
for(const c of doc.concepts){try{
 assert.equal(c.p,'noun');assert.deepEqual(Object.keys(c.e).sort(),[...langs].sort())
 for(const l of langs){const e=c.e[l];assert(e.h.trim().length>1&&e.h.length<=100&&e.x.trim().length>10)
  if(l!=='fa'){MorphologySchema.parse({lang:l,form:e.f});assert(e.f.kind==='noun');morphology++}
  if(l==='de')assert(e.f.genitiveSingular)
  if(l!=='fa'&&l!=='sv')assert(e.f.plural||e.n)
  if(l==='sv')assert(e.f.definiteSingular&&(e.f.indefinitePlural&&e.f.definitePlural||e.n))
 }
 for(const native of langs){ExpansionSchema.parse({pos:c.p,detectedLang:'sv',tags:c.t,entries:langs.map(lang=>({lang,headword:c.e[lang].h,meaning:c.e[native].h,example:c.e[lang].x,exampleGloss:c.e[native].x,...(c.e[lang].f?{morphology:c.e[lang].f}:{}),...(c.e[lang].n?{notes:c.e[lang].n}:{})}))});expansions++}
}catch(error){failures.push({id:c.id,error:String(error)})}}
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(failures,null,2))
console.log(JSON.stringify({concepts:doc.n,morphologyParses:morphology,expansionParses:expansions,failures:failures.length}))
if(failures.length){if(!process.argv[3])console.error(failures.slice(0,10));process.exitCode=1}
if(!process.argv[3])assert.equal(doc.n,2000,'Final package must contain exactly 2,000 concepts')
