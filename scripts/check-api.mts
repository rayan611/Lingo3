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

// ---------------------------------------------------------------------------
// The backup model: when the first provider cannot answer, the next one does.
// ---------------------------------------------------------------------------
console.log('\nA second provider answers when the first cannot')
{
  const { firstAnswer, configuredProviders, modelFor } = await import('../src/server/aiFallback')
  const reply = (status: number, body: unknown = { ok: true }) =>
    async () => new Response(JSON.stringify(body), { status })
  const quiet = async <T,>(fn: () => Promise<T>) => {
    const w = console.warn, e = console.error
    console.warn = () => {}; console.error = () => {}
    try { return await fn() } finally { console.warn = w; console.error = e }
  }
  const read = (d: unknown) => d

  const down = await quiet(() => firstAnswer([
    { provider: 'gemini', call: reply(503), read },
    { provider: 'anthropic', call: reply(200, { word: 'hund' }), read },
  ], 5000, 't', 'slow'))
  check('Gemini 503 -> Claude answers', down.ok && down.provider === 'anthropic', JSON.stringify(down))

  const busy = await quiet(() => firstAnswer([
    { provider: 'gemini', call: reply(429), read },
    { provider: 'anthropic', call: reply(200, { word: 'hund' }), read },
  ], 5000, 't', 'slow'))
  check('Gemini 429 -> Claude answers', busy.ok && busy.provider === 'anthropic', JSON.stringify(busy))

  const hang = (signal: AbortSignal) => new Promise<Response>((_, reject) =>
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
  const slow = await quiet(() => firstAnswer([
    { provider: 'gemini', call: hang, read },
    { provider: 'anthropic', call: reply(200, { word: 'hund' }), read },
  ], 10000, 't', 'slow'))
  check('Gemini too slow -> Claude still answers in time', slow.ok && slow.provider === 'anthropic', JSON.stringify(slow))

  const bad = await quiet(() => firstAnswer([
    { provider: 'gemini', call: reply(200), read: () => { throw new Error('The model stopped early (SAFETY).') } },
    { provider: 'anthropic', call: reply(200, { word: 'hund' }), read },
  ], 5000, 't', 'slow'))
  check('unusable Gemini answer -> Claude answers', bad.ok && bad.provider === 'anthropic', JSON.stringify(bad))

  const first = await quiet(() => firstAnswer([
    { provider: 'gemini', call: reply(200, { word: 'hund' }), read },
    { provider: 'anthropic', call: async () => { throw new Error('must not be called') }, read },
  ], 5000, 't', 'slow'))
  check('a working Gemini is used and Claude is never called', first.ok && first.provider === 'gemini', JSON.stringify(first))

  const both = await quiet(() => firstAnswer([
    { provider: 'gemini', call: reply(503), read },
    { provider: 'anthropic', call: reply(429), read },
  ], 5000, 't', 'slow'))
  check('both down -> the last status reaches the app (429 = busy)', !both.ok && both.status === 429, JSON.stringify(both))

  const allDown = await quiet(() => firstAnswer([
    { provider: 'gemini', call: reply(500), read },
    { provider: 'anthropic', call: reply(502), read },
  ], 5000, 't', 'slow'))
  check('both 5xx -> 502, so the app shows its calm "not available" note', !allDown.ok && allDown.status === 502, JSON.stringify(allDown))

  check('only keys that are set are tried, Gemini first',
    JSON.stringify(configuredProviders({ gemini: 'g', anthropic: 'a' })) === '["gemini","anthropic"]' &&
    JSON.stringify(configuredProviders({ gemini: undefined, anthropic: 'a' })) === '["anthropic"]',
    'wrong order or unset key tried')
  check('LINGUA_MODEL applies to the first provider only',
    modelFor('gemini', ['gemini', 'anthropic'], 'gemini-x') === 'gemini-x' &&
    modelFor('anthropic', ['gemini', 'anthropic'], 'gemini-x') === 'claude-haiku-5-5',
    'the override leaked into the backup')
}

// ---------------------------------------------------------------------------
// Groq: the first backup, between Gemini and Claude.
// ---------------------------------------------------------------------------
console.log('\nGroq answers when Gemini cannot')
{
  const { firstAnswer, configuredProviders, modelFor, callGroq, readGroq } = await import(
    '../src/server/aiFallback'
  )
  const reply = (status: number, body: unknown = { ok: true }) =>
    async () => new Response(JSON.stringify(body), { status })
  const quiet = async <T,>(fn: () => Promise<T>) => {
    const w = console.warn, e = console.error
    console.warn = () => {}; console.error = () => {}
    try { return await fn() } finally { console.warn = w; console.error = e }
  }
  const groqReply = (args: unknown) => ({
    choices: [{ message: { content: null, tool_calls: [
      { type: 'function', function: { name: 'record_word', arguments: JSON.stringify(args) } },
    ] } }],
  })
  const read = (d: unknown) => d

  check('order is Gemini, Groq, Claude, and only keys that are set',
    JSON.stringify(configuredProviders({ gemini: 'g', groq: 'q', anthropic: 'a' })) === '["gemini","groq","anthropic"]' &&
    JSON.stringify(configuredProviders({ gemini: 'g', groq: 'q' })) === '["gemini","groq"]' &&
    JSON.stringify(configuredProviders({ groq: 'q' })) === '["groq"]',
    'wrong order or unset key tried')

  check('Groq uses its own default, or GROQ_MODEL, never LINGUA_MODEL',
    modelFor('groq', ['gemini', 'groq'], 'gemini-x', undefined) === 'openai/gpt-oss-120b' &&
    modelFor('groq', ['gemini', 'groq'], 'gemini-x', 'llama-3.3-70b-versatile') === 'llama-3.3-70b-versatile',
    'the Groq model is wrong')

  const unwrap = readGroq('record_word')
  const word = unwrap(groqReply({ pos: 'noun', normalisedLemma: 'hund' })) as { pos?: string } | null
  check('the forced tool call is unwrapped to the same object Claude returns', word?.pos === 'noun', JSON.stringify(word))
  const asText = unwrap({ choices: [{ message: { content: '```json\n{"pos":"verb"}\n```' } }] }) as { pos?: string } | null
  check('JSON written as plain text is accepted too', asText?.pos === 'verb', JSON.stringify(asText))
  check('an answer that is not JSON is unusable, so the next provider is tried',
    unwrap({ choices: [{ message: { content: 'Sorry, I cannot.' } }] }) === null, 'prose was accepted')

  const viaGroq = await quiet(() => firstAnswer([
    { provider: 'gemini', call: reply(503), read },
    { provider: 'groq', call: reply(200, groqReply({ pos: 'noun' })), read: unwrap },
    { provider: 'anthropic', call: async () => { throw new Error('must not be called') }, read },
  ], 5000, 't', 'slow'))
  check('Gemini 503 -> Groq answers, Claude is not called', viaGroq.ok && viaGroq.provider === 'groq', JSON.stringify(viaGroq))

  const pastGroq = await quiet(() => firstAnswer([
    { provider: 'gemini', call: reply(429), read },
    { provider: 'groq', call: reply(429), read: unwrap },
    { provider: 'anthropic', call: reply(200, { word: 'hund' }), read },
  ], 5000, 't', 'slow'))
  check('Gemini and Groq both busy -> Claude answers', pastGroq.ok && pastGroq.provider === 'anthropic', JSON.stringify(pastGroq))

  // What actually goes over the wire: the endpoint's own tool, forced.
  const realFetch = globalThis.fetch
  let sent: { url?: string; auth?: string; body?: Record<string, unknown> } = {}
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = {
      url,
      auth: (init.headers as Record<string, string>).authorization,
      body: JSON.parse(String(init.body)),
    }
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  try {
    const tool = { name: 'record_word', description: 'd', input_schema: { type: 'object', properties: {} } }
    await callGroq(tool, 'prompt', 'gsk_test', new AbortController().signal, 'openai/gpt-oss-120b', {
      maxTokens: 4096,
      temperature: 0,
    })
  } finally {
    globalThis.fetch = realFetch
  }
  const body = sent.body as { tool_choice?: { function?: { name?: string } }; tools?: Array<{ function?: { parameters?: unknown } }>; reasoning_effort?: string } | undefined
  check('Groq request: chat completions URL with a bearer key',
    sent.url === 'https://api.groq.com/openai/v1/chat/completions' && sent.auth === 'Bearer gsk_test',
    JSON.stringify({ url: sent.url, auth: sent.auth }))
  check('Groq request: the endpoint tool is forced and passed through unchanged',
    body?.tool_choice?.function?.name === 'record_word' &&
      JSON.stringify(body?.tools?.[0]?.function?.parameters) === '{"type":"object","properties":{}}',
    JSON.stringify(body))
  check('Groq request: low reasoning on gpt-oss, so a backup answers quickly',
    body?.reasoning_effort === 'low', JSON.stringify(body))
}

// ---------------------------------------------------------------------------
// The admin AI status check: admins only, every provider asked on its own.
// ---------------------------------------------------------------------------
console.log('\nAI status (admin)')
{
  process.env.GEMINI_API_KEY = 'g-test'
  process.env.GROQ_API_KEY = 'gsk_test'
  delete process.env.ANTHROPIC_API_KEY
  const { default: statusHandler } = await import('../api/ai-status')
  const realFetch = globalThis.fetch
  let admin = false
  let aiCalls = 0
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes('api.groq.com') || url.includes('generativelanguage')) aiCalls++
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u1' }), { status: 200 })
    if (url.includes('/rpc/is_admin')) return new Response(JSON.stringify(admin), { status: 200 })
    if (url.includes('api.groq.com')) {
      return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: {
        name: 'translate', arguments: JSON.stringify({ translations: [{ lang: 'sv', text: 'God morgon' }] }),
      } }] } }] }), { status: 200 })
    }
    if (url.includes('generativelanguage')) {
      return new Response(JSON.stringify({ error: { message: 'API key not valid.' } }), { status: 400 })
    }
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
  const ask = () => statusHandler(new Request('https://x/api/ai-status', {
    method: 'POST', headers: { authorization: 'Bearer t' }, body: '{}',
  })) as Promise<Response>
  try {
    const refused = await ask()
    check('not an admin -> 403, and no AI is called',
      refused.status === 403 && aiCalls === 0, `${refused.status}, ${aiCalls} AI calls`)

    admin = true
    const res = await ask()
    const body = (await res.json()) as { providers?: Array<Record<string, unknown>> }
    const by = (p: string) => body.providers?.find((r) => r.provider === p)
    check('admin -> 200 with all three providers listed', res.status === 200 && body.providers?.length === 3, JSON.stringify(body))
    check('a working provider shows its answer and its place in the order',
      by('groq')?.ok === true && by('groq')?.sample === 'God morgon' && by('groq')?.position === 2,
      JSON.stringify(by('groq')))
    check('a failing provider shows its own error',
      by('gemini')?.ok === false && String(by('gemini')?.error).includes('API key not valid'),
      JSON.stringify(by('gemini')))
    check('a provider without a key is listed as not configured',
      by('anthropic')?.configured === false, JSON.stringify(by('anthropic')))
  } finally {
    globalThis.fetch = realFetch
  }
}

// /api/tts — the spoken fallback for languages the device has no voice for.
console.log('\n/api/tts')
{
  const { default: ttsHandler, parseTtsInput, TTS_MAX_CHARS } = await import('../api/tts')
  check('a word in a known language is accepted',
    parseTtsInput({ text: ' arbeta ', lang: 'sv' }).ok === true, 'sv rejected')
  check('every app language is accepted',
    LANGS.every((lang) => parseTtsInput({ text: 'x', lang }).ok), 'a language is missing')
  check('an unknown language is refused',
    parseTtsInput({ text: 'x', lang: 'xx' }).ok === false, 'xx accepted')
  check('an empty or overlong text is refused',
    !parseTtsInput({ text: '  ', lang: 'sv' }).ok &&
      !parseTtsInput({ text: 'a'.repeat(TTS_MAX_CHARS + 1), lang: 'sv' }).ok,
    'accepted')

  const realFetch = globalThis.fetch
  let asked = ''
  const signedIn = (url: string) =>
    url.includes('/auth/v1/user') ? new Response(JSON.stringify({ id: 'u1' }), { status: 200 }) : null
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const user = signedIn(String(input))
    if (user) return user
    asked = String(input)
    return new Response(new Uint8Array([0xff, 0xf3]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    })
  }) as typeof fetch
  try {
    const res = (await ttsHandler(
      new Request('https://x/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
        body: JSON.stringify({ text: 'god morgon', lang: 'sv' }),
      }),
    )) as Response
    check('a Swedish text comes back as audio',
      res.status === 200 && res.headers.get('content-type') === 'audio/mpeg',
      `${res.status} ${res.headers.get('content-type')}`)
    check('the voice is asked in Swedish, for the text given',
      asked.includes('tl=sv') && asked.includes('q=god%20morgon'), asked)

    const anonymous = (await ttsHandler(
      new Request('https://x/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'hej', lang: 'sv' }),
      }),
    )) as Response
    check('signed-out callers are refused', anonymous.status === 401, String(anonymous.status))

    globalThis.fetch = (async (input: RequestInfo | URL) =>
      signedIn(String(input)) ??
      new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch
    const bad = (await ttsHandler(
      new Request('https://x/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
        body: JSON.stringify({ text: 'hej', lang: 'sv' }),
      }),
    )) as Response
    check('a non-audio answer upstream is an error, not passed on', bad.status === 502, String(bad.status))
  } finally {
    globalThis.fetch = realFetch
  }
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
