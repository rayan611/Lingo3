/// <reference types="node" />

/**
 * A backup model. Each api/ endpoint lists the providers it has keys for,
 * Gemini first; when one cannot answer — busy (429), down (5xx), too slow,
 * unreachable, or an answer that does not read — the next one gets the same
 * prompt. With one key configured this behaves exactly as before.
 */

export type Provider = 'gemini' | 'anthropic'

export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-3.8-flash',
  anthropic: 'claude-haiku-5-5',
}

/** The providers that have a key, in the order they are tried. */
export function configuredProviders(keys: Record<Provider, string | undefined>): Provider[] {
  return (['gemini', 'anthropic'] as const).filter((p) => !!keys[p])
}

/**
 * The model for a provider. An override (LINGUA_MODEL and friends) names a
 * model of the first provider, so it only applies there; the backup always
 * uses its own default.
 */
export function modelFor(provider: Provider, providers: Provider[], override?: string) {
  return provider === providers[0] && override ? override : DEFAULT_MODELS[provider]
}

export type Attempt = {
  provider: Provider
  call: (signal: AbortSignal) => Promise<Response>
  read: (data: unknown) => unknown
}

export type Outcome =
  | { ok: true; value: unknown; provider: Provider }
  | { ok: false; status: number; error: string }

/**
 * Tries each attempt in turn within one time budget. When a backup exists the
 * first provider gets 60% of the budget, so a hung request still leaves the
 * backup enough time to answer before the function itself is cut off.
 */
export async function firstAnswer(
  attempts: Attempt[],
  budgetMs: number,
  tag: string,
  timeoutMessage: string,
): Promise<Outcome> {
  const deadline = Date.now() + budgetMs
  let last: Outcome = { ok: false, status: 502, error: 'Could not reach the language model. Please try again.' }

  for (let i = 0; i < attempts.length; i++) {
    const { provider, call, read } = attempts[i]
    const remaining = deadline - Date.now()
    if (remaining < 2000) break
    const hasBackup = i < attempts.length - 1
    const slice = hasBackup ? Math.min(remaining, Math.round(budgetMs * 0.6)) : remaining

    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), slice)
    try {
      const upstream = await call(abort.signal)
      if (!upstream.ok) {
        console.warn(`[${tag}] ${provider} returned status`, upstream.status)
        last = {
          ok: false,
          status: upstream.status === 429 ? 429 : 502,
          error: upstream.status === 429
            ? 'The language model is busy. Please try again shortly.'
            : 'The language model could not complete the request. Please try again.',
        }
        continue
      }
      const value = read(await upstream.json())
      if (!value) {
        last = { ok: false, status: 502, error: 'Model did not return a usable result.' }
        continue
      }
      if (i > 0) console.warn(`[${tag}] answered by backup ${provider}`)
      return { ok: true, value, provider }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`[${tag}] ${provider} timed out`)
        last = { ok: false, status: 504, error: timeoutMessage }
      } else if (err instanceof Error && err.name !== 'TypeError' && err.name !== 'SyntaxError' && err.message) {
        // A read error: readGemini/readAnthropic turn the reasons a model
        // stops into sentences, and those are worth showing if nothing answers.
        console.warn(`[${tag}] ${provider} answer unusable`)
        last = { ok: false, status: 502, error: err.message }
      } else {
        console.error(`[${tag}] ${provider} request failed`, err instanceof Error ? err.name : 'unknown')
        last = { ok: false, status: 502, error: 'Could not reach the language model. Please try again.' }
      }
    } finally {
      clearTimeout(timer)
    }
  }
  return last
}
