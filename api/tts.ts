import { authenticateAiRequest, enforceAiRateLimit } from '../src/server/aiSecurity.js'
import { LANGS, type Lang } from '../src/db/langs.js'

/**
 * Vercel serverless function: a spoken word or sentence, as MP3.
 *
 * Only the fallback. Speaking goes through the device's own voices first
 * (src/lib/speak.ts); this is asked only when the device has no voice for
 * the language — common for Swedish on Android phones whose speech engine
 * never downloaded it, and on desktop Chrome on Linux. Without it the
 * speaker was simply hidden for that language.
 *
 * The audio is Google Translate's voice: no key, every language the app
 * has. Signed-in callers only, so this is not an open relay, and short
 * texts only: a word, an example sentence, a form.
 */
export const maxDuration = 15
const UPSTREAM_TIMEOUT_MS = 10_000
export const TTS_MAX_CHARS = 200
/** Must match the 'tts' limit in consume_ai_rate_limit(). */
const TTS_HOURLY_LIMIT = 300

/** Google's language codes are the bare ones. */
const GOOGLE_LANG: Record<Lang, string> = {
  fa: 'fa',
  en: 'en-GB',
  sv: 'sv',
  de: 'de',
  es: 'es',
  ru: 'ru',
  it: 'it',
  fr: 'fr',
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export function parseTtsInput(
  raw: unknown,
): { ok: true; text: string; lang: Lang } | { ok: false; error: string } {
  const input = raw as { text?: unknown; lang?: unknown } | null
  if (!input || typeof input !== 'object') return { ok: false, error: 'Invalid request.' }
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (!text) return { ok: false, error: 'Nothing to say.' }
  if (text.length > TTS_MAX_CHARS) return { ok: false, error: 'Too long to speak.' }
  if (!LANGS.includes(input.lang as Lang)) return { ok: false, error: 'Unknown language.' }
  return { ok: true, text, lang: input.lang as Lang }
}

async function respond(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await authenticateAiRequest(req)
  if (!auth.ok) return json({ error: auth.message }, auth.status)

  // Its own hourly bucket in consume_ai_rate_limit(), so one account cannot
  // loop this relay and get the server's address blocked for everyone.
  const rate = await enforceAiRateLimit(req, auth.userId, 'tts', TTS_HOURLY_LIMIT)
  if (!rate.allowed) return json({ error: rate.message }, rate.status)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }
  const input = parseTtsInput(raw)
  if (!input.ok) return json({ error: input.error }, 400)

  const url =
    'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob' +
    `&tl=${encodeURIComponent(GOOGLE_LANG[input.lang])}` +
    `&q=${encodeURIComponent(input.text)}`
  let upstream: Response
  try {
    upstream = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://translate.google.com/' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return json({ error: 'The voice service did not answer.' }, 503)
  }
  const type = upstream.headers.get('content-type') ?? ''
  if (!upstream.ok || !type.startsWith('audio/')) {
    console.error('[tts.ts] upstream', upstream.status, type)
    return json({ error: 'No voice for this text.' }, 502)
  }
  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      'content-type': type,
      // The same words come round again and again in review.
      'cache-control': 'private, max-age=604800',
    },
  })
}

// ---------------------------------------------------------------------------
// The same two calling conventions as the other api/ functions.
// ---------------------------------------------------------------------------

type NodeResponse = {
  statusCode: number
  setHeader: (k: string, v: string) => void
  end: (body?: string | Uint8Array) => void
}

type NodeRequest = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

function toWebRequest(req: NodeRequest): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  const method = req.method ?? 'GET'
  const body =
    method === 'GET' || method === 'HEAD' || req.body === undefined
      ? undefined
      : typeof req.body === 'string'
        ? req.body
        : req.body instanceof Uint8Array
          ? new TextDecoder().decode(req.body)
          : JSON.stringify(req.body)
  return new Request(`https://local${req.url ?? '/api/tts'}`, { method, headers, body })
}

async function guarded(req: Request): Promise<Response> {
  try {
    return await respond(req)
  } catch (err) {
    console.error('[tts.ts] unhandled request error', err instanceof Error ? err.name : 'unknown')
    return json({ error: 'Unexpected server error. Please try again.' }, 500)
  }
}

export default async function handler(
  req: Request | NodeRequest,
  res?: NodeResponse,
): Promise<Response | void> {
  if (!res || typeof res.setHeader !== 'function') return guarded(req as Request)
  const response = await guarded(toWebRequest(req as NodeRequest))
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(new Uint8Array(await response.arrayBuffer()))
}
