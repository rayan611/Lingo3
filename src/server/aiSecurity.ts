/// <reference types="node" />

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const PRODUCTION = process.env.NODE_ENV === 'production'
const memoryWindows = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 503; message: string }
type LimitResult =
  | { allowed: true }
  | { allowed: false; status: 429 | 503; message: string }

export async function authenticateAiRequest(req: Request): Promise<AuthResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return PRODUCTION
      ? { ok: false, status: 503, message: 'AI service is not configured securely.' }
      : { ok: true, userId: 'local-development' }
  }
  const header = req.headers.get('authorization') ?? ''
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : ''
  if (!token) return { ok: false, status: 401, message: 'Sign in before using AI features.' }
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return { ok: false, status: 401, message: 'Your session is invalid or expired. Please sign in again.' }
    const user = (await response.json()) as { id?: string }
    if (!user.id) return { ok: false, status: 401, message: 'Your session is invalid. Please sign in again.' }
    return { ok: true, userId: user.id }
  } catch {
    return { ok: false, status: 503, message: 'Could not verify your session. Please try again shortly.' }
  }
}

export async function enforceAiRateLimit(
  req: Request,
  userId: string,
  endpoint: 'expand' | 'story' | 'translate',
  limit: number,
): Promise<LimitResult> {
  if (SUPABASE_URL && SUPABASE_KEY && req.headers.get('authorization')) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_ai_rate_limit`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          authorization: req.headers.get('authorization') ?? '',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ p_endpoint: endpoint }),
        signal: AbortSignal.timeout(3000),
      })
      if (!response.ok) throw new Error('Rate-limit service unavailable')
      const allowed: unknown = await response.json()
      if (typeof allowed !== 'boolean') throw new Error('Invalid rate-limit response')
      return allowed
        ? { allowed: true }
        : { allowed: false, status: 429, message: endpoint === 'expand'
            ? 'Too many words in one hour. Try again later.'
            : endpoint === 'translate'
              ? 'Too many translations in one hour. Try again later.'
              : 'Too many texts in one hour. Try again later.' }
    } catch {
      if (PRODUCTION) return { allowed: false, status: 503, message: 'The AI safety service is temporarily unavailable.' }
      return memoryLimit(userId, endpoint, limit)
    }
  }
  if (PRODUCTION) return { allowed: false, status: 503, message: 'AI rate limiting is not configured.' }
  return memoryLimit(userId, endpoint, limit)
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
