/// <reference types="node" />

/**
 * Server-only guardrails for the paid AI endpoints.
 *
 * Production deliberately fails closed: missing auth configuration or a missing
 * shared limiter must never turn the public website into an anonymous model proxy.
 * Development can still run locally without Supabase/Upstash configured.
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '')
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const PRODUCTION = process.env.NODE_ENV === 'production'

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 503; message: string }

type LimitResult =
  | { allowed: true }
  | { allowed: false; status: 429 | 503; message: string }

const memoryWindows = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000

export async function authenticateAiRequest(req: Request): Promise<AuthResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (PRODUCTION) {
      return {
        ok: false,
        status: 503,
        message: 'AI service is not configured securely. Please try again later.',
      }
    }
    return { ok: true, userId: 'local-development' }
  }

  const header = req.headers.get('authorization') ?? ''
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : ''
  if (!token) {
    return { ok: false, status: 401, message: 'Sign in before using AI features.' }
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      return { ok: false, status: 401, message: 'Your session is invalid or expired. Please sign in again.' }
    }
    const user = (await response.json()) as { id?: string }
    if (!user.id) return { ok: false, status: 401, message: 'Your session is invalid. Please sign in again.' }
    return { ok: true, userId: user.id }
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'Could not verify your session. Please try again shortly.',
    }
  }
}

/**
 * Shared hourly fixed-window limiter. Upstash Redis is atomic across Vercel
 * instances; the in-memory fallback is development-only. Production refuses
 * AI calls without the shared store rather than pretending a local map is global.
 */
export async function enforceAiRateLimit(
  userId: string,
  endpoint: 'expand' | 'story',
  limit: number,
): Promise<LimitResult> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    if (PRODUCTION) {
      return {
        allowed: false,
        status: 503,
        message: 'AI rate limiting is not configured. Please try again later.',
      }
    }
    return memoryLimit(userId, endpoint, limit)
  }

  const script =
    "local n = redis.call('INCR', KEYS[1]); " +
    "if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; " +
    'return n'
  try {
    const response = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${UPSTASH_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        'EVAL',
        script,
        '1',
        `lingo3:ai:${endpoint}:${userId}`,
        '3600',
      ]),
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) throw new Error(`Upstash returned ${response.status}`)
    const body = (await response.json()) as { result?: number; error?: string }
    if (body.error || typeof body.result !== 'number') throw new Error(body.error ?? 'Invalid limiter response')
    return body.result > limit
      ? { allowed: false, status: 429, message: endpoint === 'expand'
          ? 'Too many words in one hour. Try again later.'
          : 'Too many texts in one hour. Try again later.' }
      : { allowed: true }
  } catch {
    if (PRODUCTION) {
      return {
        allowed: false,
        status: 503,
        message: 'The AI safety service is temporarily unavailable. Please try again shortly.',
      }
    }
    return memoryLimit(userId, endpoint, limit)
  }
}

function memoryLimit(userId: string, endpoint: string, limit: number): LimitResult {
  const now = Date.now()
  const key = `${endpoint}:${userId}`
  const hits = (memoryWindows.get(key) ?? []).filter((time) => now - time < WINDOW_MS)
  hits.push(now)
  memoryWindows.set(key, hits)
  if (memoryWindows.size > 5000) {
    for (const [entry, times] of memoryWindows) {
      if (!times.some((time) => now - time < WINDOW_MS)) memoryWindows.delete(entry)
    }
  }
  return hits.length > limit
    ? { allowed: false, status: 429, message: 'Rate limit reached. Please try again later.' }
    : { allowed: true }
}
