import { authenticateAiRequest, enforceAiRateLimit } from '../src/server/aiSecurity.js'
import { parseExpandInput, SUPPORTED_LANGS } from '../src/server/aiInput.js'
import { LANG_PROMPT_NAMES } from '../src/db/langs.js'

/**
 * The language list the two response schemas validate against.
 *
 * Spread into a plain array because both schema builders mutate nothing but
 * expect a writable string[]. Derived, so a language added to LANGUAGES
 * cannot be rejected here — which is exactly what used to happen.
 */
const LANG_ENUM: string[] = [...SUPPORTED_LANGS]

/**
 * Vercel serverless function: expands one word into every selected language in
 * a single Claude call.
 *
 * One call per word rather than one per language, for three reasons: it is
 * cheaper, the example sentences come out genuinely parallel (the same
 * situation rendered in each language, which is what makes them worth
 * comparing side by side), and the part of speech is decided once instead of
 * three times with a chance of disagreeing.
 *
 * The API key lives here and never reaches the browser.
 */

// Haiku is the default: this task is short, structured and runs at low volume,
// so the cheapest model is the right starting point. If genders or auxiliary
// verbs start coming back wrong, set LINGUA_MODEL to a stronger model — the
// cost difference at a few dozen words a day is small, and a wrong der/die/das
// gets drilled into you by the scheduler for months.
/**
 * Two providers, chosen by which key is configured. Gemini wins when its key
 * is present, because setting it is a deliberate act; Anthropic is the
 * fallback. Nothing downstream knows or cares which one answered — both are
 * normalised to the same shape before they leave this file, and the database,
 * the scheduler and the review screen see identical entries either way.
 */
const GEMINI_KEY = process.env.GEMINI_API_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const PROVIDER: 'gemini' | 'anthropic' = GEMINI_KEY ? 'gemini' : 'anthropic'

// Google retired gemini-2.5-flash for keys created after its deprecation: a new
// key gets 404 "no longer available to new users", naming its replacement. The
// model string is the one piece of this file with a shelf life, so when the
// expansion starts 404ing, read the message — it says what to put here.
const MODEL =
  process.env.LINGUA_MODEL ??
  (PROVIDER === 'gemini' ? 'gemini-3.8-flash' : 'claude-haiku-5-5')

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

/**
 * Vercel kills a function at 10 seconds by default, and this one spends nearly
 * all its time waiting on a single model call that writes four languages of
 * structured output. That is comfortably more than ten seconds, so every
 * request died as a 504 before the model had finished — the word saved, the
 * expansion never arrived.
 *
 * 60s is the Hobby-plan ceiling. The call does not normally take anywhere near
 * it; the number exists so a slow one finishes instead of being executed.
 */
export const maxDuration = 60

/**
 * Abandon the upstream call a few seconds before Vercel would kill the
 * function, so a slow model returns a readable error through our own JSON
 * shape rather than a gateway page the client cannot parse.
 */
const UPSTREAM_TIMEOUT_MS = 50_000

const LANG_NAMES = LANG_PROMPT_NAMES as Record<string, string>

/**
 * Morphology rules, written per language on purpose. German needs an auxiliary
 * verb and a separable-prefix flag that Swedish has no equivalent for, and the
 * two gender systems are unrelated — a shared schema would quietly drop the
 * fields that matter most to a learner.
 */
const MORPHOLOGY_RULES = `
MORPHOLOGY — required fields, per language. Use exactly these key names.

Swedish (sv):
  noun -> { "kind":"noun", "gender":"en"|"ett", "definiteSingular":"...",
            "indefinitePlural":"...", "definitePlural":"..." }
  verb -> { "kind":"verb", "infinitiv":"...", "presens":"...",
            "preteritum":"...", "supinum":"...", "imperativ":"<e.g. ät>",
            "particle":"..." (only for particle verbs, else omit) }
  anything else -> { "kind":"simple" }

German (de):
  noun -> { "kind":"noun", "gender":"der"|"die"|"das", "plural":"...",
            "genitiveSingular":"..." }
  verb -> { "kind":"verb", "infinitiv":"...", "praesens":"<3rd person sing>",
            "praeteritum":"<3rd person sing>", "partizip2":"...",
            "auxiliary":"haben"|"sein", "separable":true|false,
            "prefix":"..." (only when separable, else omit),
            "imperativ":"<du form, e.g. geh>" }
  anything else -> { "kind":"simple" }

English (en):
  noun -> { "kind":"noun", "plural":"..." }
  verb -> { "kind":"verb", "base":"...", "thirdPerson":"...", "past":"...",
            "pastParticiple":"..." }
  anything else -> { "kind":"simple" }

Spanish (es):
  noun -> { "kind":"noun", "gender":"el"|"la", "plural":"..." }
  verb -> { "kind":"verb", "infinitivo":"...", "presente":"<3rd person sing>",
            "preterito":"<3rd person sing>", "participio":"...",
            "gerundio":"...", "reflexivo":true|false,
            "imperativo":"<tú form>" }
  anything else -> { "kind":"simple" }

Italian (it):
  noun -> { "kind":"noun", "gender":"il"|"la", "plural":"..." }
            Use il or la as the gender marker even where the word itself takes
            l' or lo in front of a vowel or s+consonant: the marker names the
            gender, the article in a sentence is a separate matter.
  verb -> { "kind":"verb", "infinito":"...", "presente":"<3rd person sing>",
            "participio":"<participio passato>",
            "ausiliare":"essere"|"avere", "gerundio":"...",
            "riflessivo":true|false, "imperativo":"<tu form>" }
            Give the infinitive of a reflexive verb with the pronoun attached
            ("alzarsi"), and set riflessivo true.
  anything else -> { "kind":"simple" }

French (fr):
  noun -> { "kind":"noun", "gender":"le"|"la", "plural":"..." }
            Use le or la as the gender marker even where the word takes l'.
  verb -> { "kind":"verb", "infinitif":"...", "present":"<3rd person sing>",
            "participe":"<participe passé>", "auxiliaire":"être"|"avoir",
            "pronominal":true|false, "imperatif":"<tu form>" }
            Give a pronominal verb with its pronoun ("se lever").
  anything else -> { "kind":"simple" }

Russian (ru):
  noun -> { "kind":"noun", "gender":"м"|"ж"|"с", "genitive":"...",
            "dative":"...", "accusative":"...", "instrumental":"...",
            "prepositional":"...", "nominativePlural":"...",
            "animate":true|false }
            All six forms are singular except nominativePlural.
  verb -> { "kind":"verb", "infinitive":"...",
            "aspect":"несовершенный"|"совершенный",
            "aspectPartner":"<the other aspect of the same verb>",
            "presentFirst":"<я form>", "presentThird":"<он/она form>",
            "past":"<masculine singular>", "imperative":"<ты form>" }
            Russian verbs come in aspect pairs. Give ONE entry, for the aspect
            that fits the sense asked for, and put the other half in
            aspectPartner — a learner has to produce both, but it is one word
            to them. For a perfective verb, presentFirst/presentThird are the
            future forms; give them anyway and say so in notes.
  anything else -> { "kind":"simple" }

Persian (fa):
  always -> { "kind":"simple" }

Gender is never optional for a Swedish, German, Spanish, Italian, French or
Russian noun, and neither is the German auxiliary, the Italian ausiliare, the
French auxiliaire or the
Russian aspect. They are the fields a learner most often gets wrong, so
guessing is worse than useless — if you are genuinely unsure of a form, say so
in "notes" rather than inventing one.
`.trim()

const TOOL = {
  name: 'record_word',
  description: 'Record the expanded word across all requested languages.',
  input_schema: {
    type: 'object' as const,
    properties: {
      pos: {
        type: 'string',
        enum: [
          'noun',
          'verb',
          'adjective',
          'adverb',
          'preposition',
          'phrase',
          'other',
        ],
        description: 'Part of speech of the concept as a whole.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'One to three lowercase topic tags. Where the word is used: everyday, food, restaurant, shopping, travel, work, home, health, school, nature, feelings, numbers. Or what it does, for words drilled as a grammatical set: prepositions, time, place, adverbs, word order, tenses, adjectives — "time" and "place" by what the word expresses, not its part of speech. Invent one only when none fit. This is not the part of speech, which is the field above.',
      },
      normalisedLemma: {
        type: 'string',
        description:
          'The input cleaned up: typo fixed, article stripped, verb put in the infinitive. Omit if the input was already clean.',
      },
      detectedLang: {
        type: 'string',
        enum: LANG_ENUM,
        description:
          'Which of the requested languages the learner actually typed the input in. Always fill this in, even when it seems obvious. If the word is spelled identically in several of them, pick the one the learner is most likely to have meant given which languages they are studying.',
      },
      related: {
        type: 'array',
        description:
          'Up to four other words worth knowing beside this one, in the target languages. Prefer register and usage variants over plain synonyms: hallo/tjena differ by formality, not meaning, and which one to use with a manager is the part a dictionary does not tell you. Omit rather than padding.',
        items: {
          type: 'object',
          properties: {
            lang: { type: 'string', enum: LANG_ENUM },
            word: { type: 'string' },
            meaning: { type: 'string', description: 'A few words at most.' },
            register: {
              type: 'string',
              description:
                'One or two words: casual, formal, written, spoken, dated, regional.',
            },
            note: {
              type: 'string',
              description:
                'When to reach for this one instead. One short sentence.',
            },
          },
          required: ['lang', 'word'],
        },
      },
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            lang: { type: 'string', enum: LANG_ENUM },
            headword: {
              type: 'string',
              description:
                'The word in this language. For German, Swedish and Spanish nouns include the article (der Hund, en hund, el perro). Russian nouns take no article: give the nominative singular.',
            },
            meaning: {
              type: 'string',
              description:
                'A short gloss, under 12 words. Not a dictionary entry.',
            },
            morphology: {
              type: 'object',
              description: 'Per the morphology rules. Always include it.',
            },
            example: {
              type: 'string',
              description:
                'One natural sentence using the word, at roughly A2-B1 level.',
            },
            exampleGloss: {
              type: 'string',
              description:
                'The example rendered in the user native language.',
            },
            notes: {
              type: 'string',
              description:
                'Only when there is something genuinely worth flagging: a false friend, an irregular form, a register warning. Omit otherwise.',
            },
          },
          required: ['lang', 'headword', 'meaning', 'morphology'],
        },
      },
    },
    required: ['pos', 'entries', 'detectedLang'],
  },
}

function buildPrompt(opts: {
  lemma: string
  sourceLang?: string
  nativeLang: string
  langs: string[]
  hint?: string
}) {
  const { lemma, sourceLang, nativeLang, langs, hint } = opts
  const targets = langs.map((l) => `${LANG_NAMES[l] ?? l} (${l})`).join(', ')

  return `You are building a vocabulary entry for a language learner.

The learner's native language is ${LANG_NAMES[nativeLang] ?? nativeLang} (${nativeLang}).
${
  sourceLang
    ? `They entered this word in ${LANG_NAMES[sourceLang] ?? sourceLang} (${sourceLang}):`
    : `They entered this word without saying which language it is in. Work out which \
of the languages below they typed it in and report that in detectedLang. A word \
spelled the same in several of them is normal — pick the most likely one for \
someone studying these languages, and build the entry around that reading:`
}

  ${lemma}
${hint ? `\nThey added this hint about which sense they mean: ${hint}\n` : ''}
Produce one entry for each of these languages: ${targets}.

${MORPHOLOGY_RULES}

EXAMPLE SENTENCES — this is the part that is easy to do badly.
Write each language's example as a natural sentence in that language, all
describing the SAME situation. Do not translate one sentence literally into
the others: a literal translation produces stilted German and unidiomatic
Swedish. The learner reads these stacked on top of each other and compares
them, so they should be recognisably the same scene said the way each
language actually says it.

RELATED WORDS — also return up to four words worth knowing beside this one,
in the target languages. Prefer REGISTER and usage variants over plain
synonyms: "hallo" and "tjena" mean the same thing and differ by formality,
and which one to use with a manager is the part a dictionary does not tell
you. Same for du/ni, jobba/arbeta. Label each with a one-or-two-word register
and a short note on when to reach for it. Return fewer, or none, rather than
padding the list with words that are merely adjacent.

TOPICS — also return one to three lowercase topic tags for this word. Two
kinds are useful, and a word often wants one of each.

Where it is used: everyday, food, restaurant, shopping, travel, work, home,
health, school, nature, feelings, numbers.

What it does grammatically, when the word is one a learner drills as a set
rather than as vocabulary: prepositions, time, place, adverbs, word order,
tenses, adjectives. Tag "time" and "place" by what the word expresses, not by
its part of speech — "igår", "snart" and "i morse" are all time; "hemma",
"utomlands" and "bredvid" are all place. Only reach for these when the word
really belongs to such a set; most nouns do not.

Invent a tag only when none of those fit. More than one tag is normal. These
are not the part of speech, which is its own field.

SENSE — pick ONE sense, the most common everyday one, and use that sense
consistently in every language. A word with several unrelated senses should
become several separate entries, not one entry that blurs them.

Call the record_word tool. Do not write anything outside the tool call.`
}

/**
 * 80/hour is far above real use — a heavy session is thirty words — and far
 * below anything that costs real money.
 */


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
      console.error('[expand.ts] unhandled request error', err instanceof Error ? err.name : 'unknown')
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

export default makeHandler(respond, '/api/expand')

async function respond(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authenticateAiRequest(req)
  if (!auth.ok) return json({ error: auth.message }, auth.status)

  const apiKey = PROVIDER === 'gemini' ? GEMINI_KEY : ANTHROPIC_KEY
  if (!apiKey) {
    return json(
      {
        error:
          'No model key is configured on the server. Set GEMINI_API_KEY or ANTHROPIC_API_KEY.',
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
  const parsed = parseExpandInput(rawBody)
  if (!parsed.ok) return json({ error: parsed.error }, 400)

  // Counted only once the request is known to be valid, so a malformed one
  // (or a client bug) does not spend the person's hourly allowance.
  const rate = await enforceAiRateLimit(req, auth.userId, 'expand', 80)
  if (!rate.allowed) return json({ error: rate.message }, rate.status)

  const { lemma, sourceLang, nativeLang, langs, hint } = parsed.value
  const prompt = buildPrompt({ lemma, sourceLang, nativeLang, langs, hint })

  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), UPSTREAM_TIMEOUT_MS)

  let upstream: Response
  try {
    upstream =
      PROVIDER === 'gemini'
        ? await callGemini(prompt, apiKey, abort.signal)
        : await callAnthropic(prompt, apiKey, abort.signal)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return json(
        { error: 'The model took too long to answer. Try "Expand now" again.' },
        504,
      )
    }
    console.error('[expand.ts] model request failed', err instanceof Error ? err.name : 'unknown')
    return json({ error: 'Could not reach the language model. Please try again.' }, 502)
  } finally {
    clearTimeout(timer)
  }

  if (!upstream.ok) {
    // Do not return raw provider responses to the browser: they can expose
    // internal diagnostics. Keep the user-facing error actionable and bounded.
    console.warn('[expand.ts] model provider returned status', upstream.status)
    return json(
      {
        error: upstream.status === 429
          ? 'The language model is busy. Please try again shortly.'
          : 'The language model could not complete the request. Please try again.',
      },
      upstream.status === 429 ? 429 : 502,
    )
  }

  let expansion: unknown
  try {
    expansion =
      PROVIDER === 'gemini'
        ? readGemini(await upstream.json())
        : readAnthropic(await upstream.json())
  } catch (err) {
    // The message, not the error object: readGemini turns the reasons a model
    // stops into sentences, and those are what the queue stores and shows.
    const why = err instanceof Error ? err.message : String(err)
    return json({ error: why }, 502)
  }

  if (!expansion) {
    return json({ error: 'Model did not return a usable result.' }, 502)
  }

  return json(expansion, 200)
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

function callAnthropic(prompt: string, key: string, signal: AbortSignal) {
  return fetch(ANTHROPIC_URL, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0,
      tools: [TOOL],
      // Forcing the tool is what makes the output parseable every time
      // instead of most of the time.
      tool_choice: { type: 'tool', name: 'record_word' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
}

export function readAnthropic(data: unknown): unknown {
  const content = (data as { content?: Array<{ type: string; name?: string; input?: unknown }> })
    .content
  const block = content?.find((c) => c.type === 'tool_use' && c.name === 'record_word')
  return block?.input ?? null
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

/**
 * Gemini's structured output uses an OpenAPI subset, and that subset has no
 * way to say "an object whose shape depends on the language" — every OBJECT
 * must declare its properties up front. Morphology is exactly that: a Swedish
 * noun and a German verb share no fields.
 *
 * So morphology is requested as a JSON *string* and parsed here, before the
 * answer leaves this file. The app still receives a real object and validates
 * it against the per-language schema it already has, which is where a malformed
 * one gets dropped. Asking for a flattened one-size-fits-all object instead
 * would have thrown away der/die/das and haben/sein, which are the fields most
 * worth having.
 */
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    pos: {
      type: 'STRING',
      enum: ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'phrase', 'other'],
    },
    normalisedLemma: { type: 'STRING' },
    detectedLang: { type: 'STRING', enum: LANG_ENUM },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    related: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          lang: { type: 'STRING', enum: LANG_ENUM },
          word: { type: 'STRING' },
          meaning: { type: 'STRING' },
          register: { type: 'STRING' },
          note: { type: 'STRING' },
        },
        required: ['lang', 'word'],
      },
    },
    entries: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          lang: { type: 'STRING', enum: LANG_ENUM },
          headword: { type: 'STRING' },
          meaning: { type: 'STRING' },
          morphologyJson: {
            type: 'STRING',
            description:
              'The morphology object for this language, serialised as a JSON string, exactly per the morphology rules.',
          },
          example: { type: 'STRING' },
          exampleGloss: { type: 'STRING' },
          notes: { type: 'STRING' },
        },
        required: ['lang', 'headword', 'meaning', 'morphologyJson'],
      },
    },
  },
  required: ['pos', 'entries', 'detectedLang'],
}

function callGemini(prompt: string, key: string, signal: AbortSignal) {
  // The tool-call instruction is Anthropic-specific; Gemini is told to fill
  // the schema instead, and morphology goes in as a JSON string.
  const adapted = prompt
    .replace(
      'Call the record_word tool. Do not write anything outside the tool call.',
      [
        'Answer with JSON matching the required schema and nothing else.',
        'Put each language\'s morphology object into "morphologyJson" as a',
        'JSON string — the same keys the rules above specify, serialised.',
      ].join(' '),
    )

  return fetch(`${GEMINI_URL(MODEL)}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: adapted }] }],
      generationConfig: {
        temperature: 0,
        // Everything the model generates counts here, thinking included. Three
        // languages of morphology is already a long answer; /api/story was
        // silently truncated by exactly this and reported it as a JSON parse
        // error. Headroom is cheap, a half-written entry is not.
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_SCHEMA,
      },
    }),
  })
}

/** Everything other than a clean stop, in the words the client should show. */
const STOP_REASONS: Record<string, string> = {
  MAX_TOKENS: 'The model ran out of room before finishing this word.',
  SAFETY: 'The model declined to expand this word.',
  RECITATION: 'The model stopped itself to avoid quoting a source.',
  PROHIBITED_CONTENT: 'The model declined to expand this word.',
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

  // Before parsing, deliberately: a cut-off answer is still a string, so
  // JSON.parse reports where it broke and never why. The reason is in the
  // response and is the only part worth putting in front of anyone.
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
  const parsed = JSON.parse(text) as {
    entries?: Array<{ morphologyJson?: string; morphology?: unknown }>
  }

  // Back into the shape the app validates: morphology as an object.
  for (const entry of parsed.entries ?? []) {
    if (typeof entry.morphologyJson === 'string') {
      try {
        entry.morphology = JSON.parse(entry.morphologyJson)
      } catch {
        // A morphology that will not parse costs that word its tables, not the
        // whole entry — the headword, meaning and example are still good.
      }
      delete entry.morphologyJson
    }
  }
  return parsed
}
