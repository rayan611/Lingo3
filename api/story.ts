import { authenticateAiRequest, enforceAiRateLimit } from '../src/server/aiSecurity.js'
import { callGroq, configuredProviders, firstAnswer, modelFor, readGroq } from '../src/server/aiFallback.js'
import { parseStoryInput } from '../src/server/aiInput.js'
import { LANG_PROMPT_NAMES } from '../src/db/langs.js'

/**
 * Vercel serverless function: writes a short text out of words the reader
 * already knows.
 *
 * Separate from /api/expand and with its own rate cap, because the two cost
 * very different amounts and are abused in different ways: expansion is one
 * small structured answer, a story is free prose and a much larger output.
 *
 * The model is given the vocabulary and told to stay inside it. It will not
 * fully obey — they never do on a constrained word list — so the client
 * verifies coverage against the real vocabulary afterwards and shows the
 * actual number. Nothing here is trusted on that point.
 */
const GEMINI_KEY = process.env.GEMINI_API_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
// Gemini first, then Groq, then Claude, each taking over when the one before
// is busy, down or too slow (see src/server/aiFallback.ts). Only providers
// with a key are tried; with one key set, only that one is used.
const PROVIDERS = configuredProviders({
  gemini: GEMINI_KEY,
  groq: GROQ_KEY,
  anthropic: ANTHROPIC_KEY,
})
const MODEL_OVERRIDE = process.env.LINGUA_STORY_MODEL ?? process.env.LINGUA_MODEL

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

export const maxDuration = 60
const UPSTREAM_TIMEOUT_MS = 50_000

/* The story cap is lower than expansion's 80: a story is a much bigger
   answer. It is passed inline to enforceAiRateLimit below. */

const LANG_NAMES = LANG_PROMPT_NAMES as Record<string, string>

const GENRES: Record<string, string> = {
  fun: 'a light, slightly funny everyday scene',
  fact: 'a short piece of true popular science or history',
  social: 'an everyday social situation — a shop, a neighbour, a queue',
  dialogue: 'a short dialogue between two named people, with speaker labels',
  joke: 'a short joke or anecdote with a punchline',
}

const LENGTHS: Record<string, { sentences: string; words: number }> = {
  short: { sentences: '3 to 4 sentences', words: 60 },
  long: { sentences: '8 to 12 sentences', words: 180 },
}

function buildPrompt(opts: {
  lang: string
  nativeLang: string
  words: string[]
  genre: string
  length: string
  unknownShare: number
}) {
  const { lang, nativeLang, words, genre, length, unknownShare } = opts
  const target = LANG_NAMES[lang] ?? lang
  const native = LANG_NAMES[nativeLang] ?? nativeLang
  const len = LENGTHS[length] ?? LENGTHS.short
  const genreText = GENRES[genre] ?? GENRES.fun
  const allowed = Math.max(0, Math.round(words.length * unknownShare))

  return `Write a short text in ${target} for a language learner, using the
vocabulary they already know.

THE VOCABULARY — these are the words they have studied, in the order they
would most benefit from seeing again: the earlier a word appears in this
list, the sooner it is due for review. Build the text out of these, and
favour the ones near the front where the text allows it. Do not force them
in — a sentence bent around a word teaches the bend, not the word.

${words.join(', ')}

RULES

1. Length: ${len.sentences}. Write ${genreText}.

2. Function words are free. Articles, pronouns, prepositions, conjunctions,
   auxiliaries, numbers and the most ordinary verbs of a beginner's
   ${target} may be used whether or not they appear above — a text built only
   from content words is not a text.

3. Beyond those, introduce at most ${allowed} new content words. Fewer is
   better. A text the reader can follow is the goal; a text that shows off
   vocabulary is not.

4. Inflect freely. The vocabulary is given in dictionary form; use whatever
   case, tense, number or gender the sentence needs. That is not introducing a
   new word.

5. Natural ${target} first. If a word above would make the sentence stilted,
   leave it out. Do not force every word in.

Return:
  - "title": three or four words, in ${target}
  - "body": the text itself, in ${target}, nothing else — no translation, no
    notes, no vocabulary list
  - "glossary": every content word in the body that is NOT in the vocabulary
    above, each with a short meaning in ${native}. Leave out function words.
    If there are none, return an empty list.`
}

const TOOL = {
  name: 'write_text',
  description: 'Return the generated text and its glossary.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      glossary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            word: { type: 'string' },
            meaning: { type: 'string' },
          },
          required: ['word', 'meaning'],
        },
      },
    },
    required: ['title', 'body'],
  },
}

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    body: { type: 'STRING' },
    glossary: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { word: { type: 'STRING' }, meaning: { type: 'STRING' } },
        required: ['word', 'meaning'],
      },
    },
  },
  required: ['title', 'body'],
}

// ---------------------------------------------------------------------------
// Two calling conventions, one function
//
// Vercel can invoke a Node function either with web objects (Request in,
// Response out) or with the older Node pair (req, res) — and this project gets
// the older one. A handler written for the web signature does not fail loudly
// under it; it hangs until the gateway gives up (504, blank page), or throws on
// req.json() and is answered with the platform's own HTML page (500, no JSON
// for the app to read). That cost a day; see the build log.
//
// This block is duplicated in every file under api/ ON PURPOSE. It was briefly
// factored out into api/_http.ts, which broke production immediately:
// package.json is "type": "module", so Node's ESM resolver requires a file
// extension on a relative import. `./_http` resolves under tsx locally and
// throws ERR_MODULE_NOT_FOUND on Vercel at import time — which surfaces as the
// same unreadable HTML 500 the convention bug did. Sixty duplicated lines with
// no import is worth more here than one shared copy that can take the whole
// endpoint down on a resolution rule that does not show up in any local check.
// ---------------------------------------------------------------------------

type NodeResponse = {
  statusCode: number
  setHeader: (k: string, v: string) => void
  end: (body?: string) => void
}

type NodeRequest = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** The body as text, whether the platform parsed it for us or did not. */
function rawBody(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') return body
  if (body instanceof Uint8Array) return new TextDecoder().decode(body)
  return JSON.stringify(body)
}

function toWebRequest(req: NodeRequest, fallbackPath: string): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  // Vercel has already parsed a JSON body into req.body by this point, so it is
  // re-serialised rather than read from the stream, which is consumed.
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(`https://local${req.url ?? fallbackPath}`, {
    method: req.method ?? 'GET',
    headers,
    body: hasBody ? rawBody(req.body) : undefined,
  })
}

/**
 * Wraps a web-style handler so it works under either convention, and so
 * nothing thrown inside reaches the platform's error page — an HTML 500 is
 * unreadable to the app, which can then only report the status number.
 */
function makeHandler(
  respond: (req: Request) => Promise<Response>,
  fallbackPath: string,
) {
  const guarded = async (req: Request): Promise<Response> => {
    try {
      return await respond(req)
    } catch (err) {
      console.error('[story.ts] unhandled request error', err instanceof Error ? err.name : 'unknown')
      return json({ error: 'Unexpected server error. Please try again.' }, 500)
    }
  }

  return async function handler(
    req: Request | NodeRequest,
    res?: NodeResponse,
  ): Promise<Response | void> {
    if (!res || typeof res.setHeader !== 'function') {
      return guarded(req as Request)
    }
    const response = await guarded(toWebRequest(req as NodeRequest, fallbackPath))
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(await response.text())
  }
}

// ---------------------------------------------------------------------------
// Authentication and shared rate limiting live in src/server/aiSecurity.ts.
// Each request is verified against Supabase Auth; per-account hourly counters
// are incremented atomically in Supabase so separate Vercel instances share
// the same limit. No service-role key is used by this endpoint.
// ---------------------------------------------------------------------------

export default makeHandler(respond, '/api/story')

async function respond(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await authenticateAiRequest(req)
  if (!auth.ok) return json({ error: auth.message }, auth.status)

  if (PROVIDERS.length === 0) {
    return json(
      {
        error:
          'No model key is configured on the server. Set GEMINI_API_KEY, GROQ_API_KEY or ANTHROPIC_API_KEY.',
      },
      500,
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  const parsed = parseStoryInput(rawBody)
  if (!parsed.ok) return json({ error: parsed.error }, 400)

  // Counted only once the request is known to be valid, so a malformed one
  // (or a client bug) does not spend the person's hourly allowance.
  const rate = await enforceAiRateLimit(req, auth.userId, 'story', 20)
  if (!rate.allowed) return json({ error: rate.message }, rate.status)

  const { lang, nativeLang, words, genre, length, unknownShare } = parsed.value
  const prompt = buildPrompt({ lang, nativeLang, words, genre, length, unknownShare })

  const result = await firstAnswer(
    PROVIDERS.map((provider) => ({
      provider,
      call: (signal: AbortSignal) => {
        const model = modelFor(provider, PROVIDERS, MODEL_OVERRIDE)
        if (provider === 'gemini') return callGemini(prompt, GEMINI_KEY!, signal, model)
        if (provider === 'groq') {
          return callGroq(TOOL, prompt, GROQ_KEY!, signal, model, {
            maxTokens: 4096,
            temperature: 0.8,
          })
        }
        return callAnthropic(prompt, ANTHROPIC_KEY!, signal, model)
      },
      read:
        provider === 'gemini'
          ? readGemini
          : provider === 'groq'
            ? readGroq(TOOL.name)
            : readAnthropic,
    })),
    UPSTREAM_TIMEOUT_MS,
    'story.ts',
    'The model took too long. Try again.',
  )
  if (!result.ok) return json({ error: result.error }, result.status)
  return json(result.value, 200)
}

function callAnthropic(prompt: string, key: string, signal: AbortSignal, model: string) {
  return fetch(ANTHROPIC_URL, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      // Not zero, unlike expansion: the same six words should not produce the
      // same story every morning.
      temperature: 0.8,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'write_text' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
}

export function readAnthropic(data: unknown): unknown {
  const content = (
    data as { content?: Array<{ type: string; name?: string; input?: unknown }> }
  ).content
  const block = content?.find((c) => c.type === 'tool_use' && c.name === 'write_text')
  return block?.input ?? null
}

/**
 * `maxOutputTokens` is the ceiling on everything the model generates, and on a
 * thinking model that includes the thinking. At 2048 a story was reliably cut
 * off mid-sentence: the reasoning spent the budget, generation stopped partway
 * through the JSON, and the client reported `Unterminated string in JSON`
 * — a parse error standing in for "the model ran out of room".
 *
 * Two changes, both needed. A bigger ceiling, and `thinkingLevel: 'low'`:
 * Google's own advice is to lower the thinking level rather than squeeze the
 * token ceiling, because the ceiling is a hard cut and does not make the model
 * reason more briefly. A few sentences built from a given word list is not a
 * task that wants deep reasoning anyway.
 */
const MAX_OUTPUT_TOKENS = 8192
const THINKING_LEVEL = 'low'

function geminiBody(prompt: string, withThinking: boolean) {
  return JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SCHEMA,
      ...(withThinking ? { thinkingLevel: THINKING_LEVEL } : {}),
    },
  })
}

async function callGemini(prompt: string, key: string, signal: AbortSignal, model: string) {
  const url = `${GEMINI_URL(model)}?key=${encodeURIComponent(key)}`
  const send = (withThinking: boolean) =>
    fetch(url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: geminiBody(prompt, withThinking),
    })

  const res = await send(true)
  if (res.status !== 400) return res

  // `thinkingLevel` is model-specific: the levels differ between families and
  // older models do not take the field at all. LINGUA_STORY_MODEL can point at
  // any of them, so a 400 that names the field is answered by sending the same
  // request without it rather than by leaving the feature dead.
  const detail = await res.text()
  if (!/thinking/i.test(detail)) {
    return new Response(detail, { status: 400, headers: res.headers })
  }
  return send(false)
}

/** Everything other than a clean stop, in the words the client should show. */
const STOP_REASONS: Record<string, string> = {
  MAX_TOKENS:
    'The model ran out of room before finishing the text. Try the shorter length.',
  SAFETY: 'The model declined to write this text.',
  RECITATION: 'The model stopped itself to avoid quoting a source.',
  PROHIBITED_CONTENT: 'The model declined to write this text.',
}

export function readGemini(data: unknown): unknown {
  const candidate = (
    data as {
      candidates?: Array<{
        finishReason?: string
        content?: { parts?: Array<{ text?: string; thought?: boolean }> }
      }>
    }
  ).candidates?.[0]

  // Checked before parsing, and deliberately: a truncated answer is still a
  // string, so JSON.parse reports where it broke rather than why. The reason
  // is right here in the response and is the only part worth showing.
  const reason = candidate?.finishReason
  if (reason && reason !== 'STOP') {
    throw new Error(STOP_REASONS[reason] ?? `The model stopped early (${reason}).`)
  }

  // A thinking model can return its reasoning as parts of its own. Those carry
  // thought: true and are not JSON; the answer is what is left.
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')

  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('The model returned something that was not a complete text.')
  }
}
