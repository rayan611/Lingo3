// Read-only HTTP acceptance. Supply a local file containing public anon key/url.
// No passwords, service-role keys or signed-in user tokens are needed.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { ExpansionSchema } from '../src/db/types'
const {key,url} = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const cases = [
  ['sv','stulit'],['en','stole'],['de','gestohlen'],['es','robaste'],
  ['it','rubavano'],['fr','volaient'],['ru','крадёт'],['fa','می‌دزدد'],
]
const results = []
for (const [lang,word] of cases) {
  const start=performance.now()
  const response=await fetch(url+'/rest/v1/rpc/lookup_shared_expansion',{
    method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},
    body:JSON.stringify({search_term:word,search_lang:lang,native_lang:'fa',target_langs:['en','sv','de','es','it','fr','ru']}),
    signal:AbortSignal.timeout(10000),
  })
  assert.equal(response.status,200)
  const data=ExpansionSchema.parse(await response.json())
  assert.equal(data.entries.find(e=>e.lang==='en')?.headword,'to steal')
  results.push({lang,word,ms:Math.round(performance.now()-start),entries:data.entries.length})
}
console.log(JSON.stringify(results))
