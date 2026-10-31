import { bareWord, serviceHeaders, sharedCachePayload } from '../src/server/sharedVocab'

/**
 * The shape of what /api/expand writes to the shared vocabulary bank. The SQL
 * side (shared_bare_word, cache_ai_expansion) is checked against the database;
 * this keeps the TypeScript half honest and in step with it.
 */
let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${ok ? '' : ` — ${detail}`}`)
  if (!ok) failures++
}

console.log('shared vocabulary payload')
check('strips sv article', bareWord('ett hus', 'sv') === 'hus')
check('strips en infinitive marker', bareWord('to eat', 'en') === 'eat')
check('keeps single word', bareWord('Haus', 'de') === 'Haus')
check('keeps accents', bareWord('das schön', 'de') === 'schön')

const full = {
  pos: 'noun',
  tags: ['everyday'],
  detectedLang: 'sv',
  entries: [
    { lang: 'sv', headword: 'ett hus ', example: 'Huset är stort.', meaning: 'x' },
    { lang: 'fa', headword: 'خانه', example: 'خانه بزرگ است.' },
    { lang: 'de', headword: 'das Haus', example: '' },
  ],
}
const p = sharedCachePayload(full)
check('builds a payload', p !== null)
check('key uses bare lower-case word', p?.cache_key === 'ai:sv:noun:hus', String(p?.cache_key))
check('drops an entry with no example', p?.expansion.entries.length === 2)
check('trims headwords', p?.expansion.entries[0].headword === 'ett hus')
check('does not forward the meaning field', !('meaning' in (p?.expansion.entries[0] ?? {})))
check('refuses when the typed language is missing',
  sharedCachePayload({ ...full, detectedLang: 'it' }) === null)
check('refuses a single-language answer',
  sharedCachePayload({ ...full, entries: [full.entries[0]] }) === null)
check('refuses without detectedLang',
  sharedCachePayload({ ...full, detectedLang: undefined }) === null)
check('refuses an oversized example',
  sharedCachePayload({ ...full, entries: [full.entries[0], { lang: 'fa', headword: 'a', example: 'x'.repeat(501) }] }) === null)

console.log('service key headers')
check('JWT key goes in both headers', serviceHeaders('eyJabc').authorization === 'Bearer eyJabc')
check('sb_ secret key goes in apikey only',
  serviceHeaders('sb_secret_x').apikey === 'sb_secret_x' && !('authorization' in serviceHeaders('sb_secret_x')))

if (failures) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
