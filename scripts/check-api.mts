import { parseExpandInput, parseStoryInput, SUPPORTED_LANGS } from '../src/server/aiInput.js'
import { LANGS, LANG_PROMPT_NAMES } from '../src/db/langs.js'

/**
 * The expansion endpoint, exercised through both calling conventions.
 *
 * This suite exists because the function worked perfectly when read and was
 * broken in production for a day: Vercel hands it the older Node (req, res)
 * pair, and a handler written for web objects fails silently under it — it
 * hangs until the gateway times out, or throws on req.json() and is answered
 * with an HTML error page the app cannot parse. Neither typecheck nor build
 * can see that; only calling it both ways can.
 */
// Set before the module is loaded: the endpoint reads its configuration at
// import time, and the point of this suite is the configured path.
process.env.VITE_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY ??= 'test-key'

const { default: handler, readGemini, readAnthropic } = await import('../api/expand')

const payload = {
  lemma: 'hund',
  sourceLang: 'sv',
  nativeLang: 'fa',
  langs: ['fa', 'sv', 'de', 'en'],
}

let failures = 0

function check(label: string, ok: boolean, detail: string) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${ok ? '' : ` — ${detail}`}`)
  if (!ok) failures++
}

async function asWeb(method: string, headers: Record<string, string>, body?: unknown) {
  const res = (await handler(
    new Request('https://x/api/expand', {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
  )) as Response
  return { status: res.status, text: await res.text() }
}

async function asNode(method: string, headers: Record<string, string>, body?: unknown) {
  let text = ''
  const res = {
    statusCode: 0,
    setHeader: () => {},
    end: (b?: string) => {
      text = b ?? ''
    },
  }
  await handler({ method, url: '/api/expand', headers, body } as never, res as never)
  return { status: res.statusCode, text }
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

console.log('\nAI request payloads are validated before prompt construction')
const validExpand = parseExpandInput({ lemma: 'hund', sourceLang: 'sv', nativeLang: 'fa', langs: ['fa', 'sv', 'de'] })
check('expand: accepts supported language selections', validExpand.ok, JSON.stringify(validExpand))
check('expand: rejects a non-object body', !parseExpandInput(null).ok, 'null accepted')
check('expand: rejects an unsupported target language', !parseExpandInput({ lemma: 'hund', langs: ['xx'] }).ok, 'unsupported language accepted')
check('expand: rejects duplicate target languages', !parseExpandInput({ lemma: 'hund', langs: ['sv', 'sv'] }).ok, 'duplicate languages accepted')
check('expand: caps hint length', !parseExpandInput({ lemma: 'hund', langs: ['sv'], hint: 'x'.repeat(301) }).ok, 'oversized hint accepted')

const validStory = parseStoryInput({ lang: 'sv', nativeLang: 'fa', words: ['hund', 'katt', 'kaffe', 'morgon', 'stad'], genre: 'fun', length: 'short', unknownShare: 0.2 })
check('story: accepts a valid request', validStory.ok, JSON.stringify(validStory))
check('story: rejects unsupported language', !parseStoryInput({ lang: 'xx', words: ['a','b','c','d','e'] }).ok, 'unsupported language accepted')
check('story: rejects non-text vocabulary values', !parseStoryInput({ lang: 'sv', words: ['a','b','c','d',{}] }).ok, 'non-text word accepted')
check('story: rejects unsupported genre', !parseStoryInput({ lang: 'sv', words: ['a','b','c','d','e'], genre: 'expensive' }).ok, 'unsupported genre accepted')
check('story: rejects non-finite difficulty', !parseStoryInput({ lang: 'sv', words: ['a','b','c','d','e'], unknownShare: Infinity }).ok, 'infinite difficulty accepted')
check('story: clamps difficulty to its documented range', parseStoryInput({ lang: 'sv', words: ['a','b','c','d','e'], unknownShare: 9 }).ok && (parseStoryInput({ lang: 'sv', words: ['a','b','c','d','e'], unknownShare: 9 }) as {ok:true;value:{unknownShare:number}}).value.unknownShare === 0.3, 'difficulty not clamped')

console.log('\nThe expansion endpoint answers under both calling conventions')

for (const [name, call] of [
  ['web', asWeb],
  ['node', asNode],
] as const) {
  const get = await call('GET', {})
  check(`${name}: GET is refused with JSON, not a hang`, get.status === 405 && isJson(get.text), `${get.status} ${get.text.slice(0, 80)}`)

  const post = await call('POST', { 'content-type': 'application/json' }, payload)
  check(
    `${name}: POST answers with JSON the app can read`,
    isJson(post.text) && typeof JSON.parse(post.text).error === 'string',
    `${post.status} ${post.text.slice(0, 80)}`,
  )
  check(`${name}: POST is rejected without a session`, post.status === 401, `got ${post.status}`)

  const empty = await call('POST', { 'content-type': 'application/json' }, { langs: [] })
  check(`${name}: a malformed body is a clean error, not a crash`, isJson(empty.text), empty.text.slice(0, 80))
}

console.log('\nBoth providers normalise to the same shape')

// Gemini cannot express a per-language morphology object in its schema, so it
// returns one as a JSON string. If this unwrapping breaks, every entry silently
// loses its genders and verb forms while still looking fine.
const gemini = readGemini({
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              pos: 'noun',
              entries: [
                {
                  lang: 'de',
                  headword: 'der Hund',
                  meaning: 'dog',
                  morphologyJson: '{"kind":"noun","gender":"der","plural":"Hunde"}',
                },
              ],
            }),
          },
        ],
      },
    },
  ],
}) as { entries: Array<{ morphology?: { gender?: string }; morphologyJson?: string }> }

check(
  'gemini: morphology comes back as an object, not a string',
  gemini.entries[0].morphology?.gender === 'der',
  JSON.stringify(gemini.entries[0]),
)
check(
  'gemini: the string field is removed',
  gemini.entries[0].morphologyJson === undefined,
  'morphologyJson survived',
)

// The same guard as the story reader: a cut-off expansion must say it ran out
// of room rather than hand up a JSON position.
let expandTruncated = ''
try {
  readGemini({
    candidates: [
      { finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"pos":"noun","entr' }] } },
    ],
  })
} catch (err) {
  expandTruncated = err instanceof Error ? err.message : String(err)
}
check(
  'gemini: a truncated expansion reports the budget, not a JSON position',
  expandTruncated.length > 0 && !/JSON|position/i.test(expandTruncated),
  expandTruncated || 'no error thrown',
)

const anthropic = readAnthropic({
  content: [{ type: 'tool_use', name: 'record_word', input: { pos: 'noun', entries: [] } }],
}) as { pos?: string }
check('anthropic: the tool call is unwrapped', anthropic?.pos === 'noun', JSON.stringify(anthropic))

// ---------------------------------------------------------------------------
// The story endpoint, through the same two conventions.
//
// It is a second function on the same platform, so it can fail in exactly the
// way the first one did, so it is exercised the same way. Each api file keeps
// its own copy of the plumbing — see the self-containment check below.
// ---------------------------------------------------------------------------

const { default: storyHandler } = await import('../api/story')

const storyPayload = {
  lang: 'sv',
  nativeLang: 'fa',
  words: ['hund', 'springa', 'kaffe', 'morgon', 'stad', 'arbeta'],
  genre: 'fun',
  length: 'short',
  unknownShare: 0.05,
}

async function storyAsWeb(method: string, headers: Record<string, string>, body?: unknown) {
  const res = (await storyHandler(
    new Request('https://x/api/story', {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
  )) as Response
  return { status: res.status, text: await res.text() }
}

async function storyAsNode(method: string, headers: Record<string, string>, body?: unknown) {
  let text = ''
  const res = {
    statusCode: 0,
    setHeader: () => {},
    end: (b?: string) => {
      text = b ?? ''
    },
  }
  await storyHandler({ method, url: '/api/story', headers, body } as never, res as never)
  return { status: res.statusCode, text }
}

console.log('\nThe story endpoint answers under both calling conventions')

for (const [name, call] of [
  ['web', storyAsWeb],
  ['node', storyAsNode],
] as const) {
  const get = await call('GET', {})
  check(
    `${name}: GET is refused with JSON, not a hang`,
    get.status === 405 && isJson(get.text),
    `${get.status} ${get.text.slice(0, 80)}`,
  )

  const noAuth = await call('POST', { 'content-type': 'application/json' }, storyPayload)
  check(
    `${name}: POST is rejected without a session`,
    noAuth.status === 401 && isJson(noAuth.text),
    `${noAuth.status} ${noAuth.text.slice(0, 80)}`,
  )

  const bad = await call('POST', { 'content-type': 'application/json' }, undefined)
  check(
    `${name}: a malformed body is a clean error, not a crash`,
    bad.status >= 400 && isJson(bad.text),
    `${bad.status} ${bad.text.slice(0, 80)}`,
  )
}

// ---------------------------------------------------------------------------
// A cut-off answer must say it was cut off
//
// A story that stops partway is still a string, so JSON.parse reports where it
// broke and never why. The reason was in the response the whole time, in
// finishReason, and nothing read it — the user saw
// "Unterminated string in JSON at position 203" and no way to act on it. Same
// lesson as the four-layer expansion failure: the answer was in hand and
// displayed nowhere.
// ---------------------------------------------------------------------------

const { readGemini: readStoryGemini } = await import('../api/story')

console.log('\nThe story reader explains why a model stopped')

const whole = readStoryGemini({
  candidates: [
    {
      finishReason: 'STOP',
      content: {
        parts: [{ text: JSON.stringify({ title: 'En vanlig morgon', body: 'Hunden springer.', glossary: [] }) }],
      },
    },
  ],
}) as { title?: string }
check('story: a complete answer is parsed', whole?.title === 'En vanlig morgon', JSON.stringify(whole))

let truncatedError = ''
try {
  readStoryGemini({
    candidates: [
      {
        finishReason: 'MAX_TOKENS',
        content: { parts: [{ text: '{\n "title": "En dag",\n "body": "Hunden spring' }] },
      },
    ],
  })
} catch (err) {
  truncatedError = err instanceof Error ? err.message : String(err)
}
check(
  'story: a truncated answer reports the budget, not a JSON position',
  truncatedError.length > 0 && !/JSON|position/i.test(truncatedError),
  truncatedError || 'no error thrown',
)

// A thinking model can return its reasoning as parts of its own; those are not
// JSON and must not be concatenated into the answer or read in its place.
const withThought = readStoryGemini({
  candidates: [
    {
      finishReason: 'STOP',
      content: {
        parts: [
          { thought: true, text: 'The reader knows hund and springa, so...' },
          { text: JSON.stringify({ title: 'Hunden', body: 'Hunden springer.', glossary: [] }) },
        ],
      },
    },
  ],
}) as { title?: string }
check('story: a thought part is skipped, not parsed', withThought?.title === 'Hunden', JSON.stringify(withThought))

// ---------------------------------------------------------------------------
// Relative imports in api/ must have explicit JavaScript extensions.
//
// A shared helper was once imported as `./_http`, which worked under tsx but
// failed under Node's ESM resolver in Vercel because package.json is type=module.
// The security helper is now shared outside api/, and imports must use `.js` so
// the deployed runtime can resolve them. This check guards against repeating
// the production-only module-resolution failure.
// ---------------------------------------------------------------------------

const { readdirSync, readFileSync } = await import('node:fs')

console.log('\nThe api/ imports are resolvable by Node ESM')

const apiFiles = readdirSync('api').filter((f) => f.endsWith('.ts'))
check('there are api files to check', apiFiles.length > 0, 'api/ looks empty')

for (const file of apiFiles) {
  const source = readFileSync(`api/${file}`, 'utf8')
  // Strip comments first; this file's own explanation mentions './_http'.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const relative = [...code.matchAll(/\bfrom\s+['"](\.[^'"]*)['"]/g)].map(
    (m) => m[1],
  )
  const extensionless = relative.filter((spec) => !/\.[cm]?js$/.test(spec))
  check(
    `${file}: no extensionless relative import`,
    extensionless.length === 0,
    `found ${extensionless.join(', ')} — under "type": "module" Node needs the .js extension, and this only fails once deployed`,
  )
}


console.log('\nAI rate limiting uses the shared Supabase counter')
const { enforceAiRateLimit } = await import('../src/server/aiSecurity')
const originalFetch = globalThis.fetch
try {
  globalThis.fetch = (async () => new Response('true', { status: 200 })) as typeof fetch
  const request = new Request('https://x/api/expand', {
    method: 'POST',
    headers: { authorization: 'Bearer test-session' },
  })
  const allowed = await enforceAiRateLimit(request, 'test-user-allowed', 'expand', 80)
  check('a shared counter response of true allows the request', allowed.allowed, JSON.stringify(allowed))

  globalThis.fetch = (async () => new Response('false', { status: 200 })) as typeof fetch
  const denied = await enforceAiRateLimit(request, 'test-user-denied', 'story', 20)
  check(
    'a shared counter response of false returns 429',
    !denied.allowed && denied.status === 429,
    JSON.stringify(denied),
  )
} finally {
  globalThis.fetch = originalFetch
}


if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`)
  process.exit(1)
}
// ---------------------------------------------------------------------------
// Every language the app offers is one the API will accept.
//
// The failure this guards: the handler kept its own hard-coded list of
// language codes, in three places, next to a comment in LANGUAGES promising
// that adding one entry was enough. Adding Italian to the app left the server
// rejecting every Italian word — in production only, because nothing here
// compared the two lists.
// ---------------------------------------------------------------------------

console.log('\nThe API accepts every language the app offers')

const apiSource = readFileSync('api/expand.ts', 'utf8')
check(
  'the server list is derived from LANGUAGES, not a second copy',
  SUPPORTED_LANGS.length === LANGS.length &&
    LANGS.every((l) => SUPPORTED_LANGS.includes(l)),
  `app ${LANGS.join(',')} vs api ${SUPPORTED_LANGS.join(',')}`,
)
check(
  'and no inline language enum has crept back into api/expand.ts',
  !/\['fa',\s*'en'/.test(apiSource),
  'found a hard-coded language array in api/expand.ts',
)
check(
  'every language has a prompt name, so no prompt says a bare code',
  LANGS.every((l) => Boolean(LANG_PROMPT_NAMES[l])),
  `missing: ${LANGS.filter((l) => !LANG_PROMPT_NAMES[l]).join(',')}`,
)
check(
  'and neither handler keeps its own copy of that table',
  !/fa: 'Persian \(Farsi\)'/.test(apiSource) &&
    !/fa: 'Persian \(Farsi\)'/.test(readFileSync('api/story.ts', 'utf8')),
  'a hard-coded LANG_NAMES is back in api/',
)

for (const lang of LANGS) {
  const parsed = parseExpandInput({
    lemma: 'prova',
    nativeLang: 'en',
    langs: [lang],
  })
  check(`${lang} is accepted by parseExpandInput`, parsed.ok, JSON.stringify(parsed))
}

// The summary used to be an unconditional "passed" with no exit code, so a
// failing endpoint check printed FAIL and the build went green anyway. It is
// the only suite that did this; the other three already exit non-zero.
console.log(
  failures === 0
    ? '\nAll endpoint checks passed.\n'
    : `\n${failures} endpoint check(s) failed.\n`,
)
process.exit(failures === 0 ? 0 : 1)
