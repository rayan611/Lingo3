import { authenticateAiRequest, isAdminRequest } from '../src/server/aiSecurity.js'
import { PROVIDER_ORDER, configuredProviders, type Provider } from '../src/server/aiFallback.js'
import { probeProvider } from './translate.js'

/**
 * Vercel serverless function: is each AI actually answering? Admins only.
 *
 * Every provider with a key gets one real job — "Good morning" into Swedish,
 * through the same call and reader /api/translate uses, with no fallback — all
 * at once, each with its own time limit. A provider without a key is listed
 * as such, so the answer covers the whole chain, not only what is switched on.
 *
 * Not counted against the hourly AI limits: it is a few tiny calls, pressed by
 * hand, by the person who pays for them.
 */
export const maxDuration = 30
const PER_PROVIDER_TIMEOUT_MS = 20_000

const KEYS: Record<Provider, string | undefined> = {
  gemini: process.env.GEMINI_API_KEY,
  groq: process.env.GROQ_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
}

type ProviderStatus =
  | { provider: Provider; configured: false }
  | {
      provider: Provider
      configured: true
      /** Where it sits in the fallback order, 1 = asked first. */
      position: number
      model: string
      ok: boolean
      ms: number
      sample?: string
      error?: string
    }

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function respond(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await authenticateAiRequest(req)
  if (!auth.ok) return json({ error: auth.message }, auth.status)
  if (!(await isAdminRequest(req))) return json({ error: 'Admins only.' }, 403)

  const order = configuredProviders(KEYS)
  const providers: ProviderStatus[] = await Promise.all(
    PROVIDER_ORDER.map(async (provider): Promise<ProviderStatus> => {
      if (!KEYS[provider]) return { provider, configured: false }
      const started = Date.now()
      const result = await probeProvider(provider, AbortSignal.timeout(PER_PROVIDER_TIMEOUT_MS))
      const ms = Date.now() - started
      return result.ok
        ? { provider, configured: true, position: order.indexOf(provider) + 1, model: result.model, ok: true, ms, sample: result.text }
        : { provider, configured: true, position: order.indexOf(provider) + 1, model: result.model, ok: false, ms, error: result.error }
    }),
  )
  return json({ checkedAt: new Date().toISOString(), providers }, 200)
}

// ---------------------------------------------------------------------------
// The same two calling conventions as the other api/ functions.
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

function toWebRequest(req: NodeRequest): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  return new Request(`https://local${req.url ?? '/api/ai-status'}`, {
    method: req.method ?? 'GET',
    headers,
  })
}

async function guarded(req: Request): Promise<Response> {
  try {
    return await respond(req)
  } catch (err) {
    console.error('[ai-status.ts] unhandled request error', err instanceof Error ? err.name : 'unknown')
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
  res.end(await response.text())
}
