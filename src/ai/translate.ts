import { authConfigured, supabase } from '../auth/supabase'
import { AiUnavailableError, aiDownStatus } from './unavailable'

export interface Translation {
  lang: string
  text: string
}

/**
 * The last results on this device, so the same phrase twice costs nothing.
 * localStorage, not the synced database: a cache is a convenience of this
 * device, and nothing typed into the translator needs to reach the server.
 */
const CACHE_KEY = 'lingo3.translateCache'
const CACHE_MAX = 50

function cacheKey(text: string, from: string, to: string[]) {
  return `${from}>${to.join(',')}:${text.trim().toLocaleLowerCase()}`
}

function readCache(): Record<string, Translation[]> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(key: string, value: Translation[]) {
  try {
    const cache = readCache()
    delete cache[key]
    cache[key] = value
    const keys = Object.keys(cache)
    for (const old of keys.slice(0, Math.max(0, keys.length - CACHE_MAX))) delete cache[old]
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* storage full or blocked: the cache is optional */
  }
}

export async function translate(
  text: string,
  from: string,
  to: string[],
): Promise<Translation[]> {
  const key = cacheKey(text, from, to)
  const hit = readCache()[key]
  if (hit) return hit

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (authConfigured) {
    const { data } = await supabase().auth.getSession()
    const token = data.session?.access_token
    if (token) headers.authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch('/api/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, from, to }),
    })
  } catch {
    throw new AiUnavailableError('You are offline. Translation needs a connection.')
  }
  let body: { translations?: Translation[]; error?: string } = {}
  try {
    body = await res.json()
  } catch {
    /* fall through to the status message */
  }
  if (aiDownStatus(res.status) || (res.ok && !body.translations)) {
    throw new AiUnavailableError(body.error ?? `Translation failed (${res.status}).`)
  }
  if (!res.ok || !body.translations) {
    throw new Error(body.error ?? `Translation failed (${res.status}).`)
  }
  writeCache(key, body.translations)
  return body.translations
}
