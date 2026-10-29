/// <reference types="node" />

/**
 * Backup models. Each api/ endpoint lists the providers it has keys for, in
 * the order below; when one cannot answer — busy (429), down (5xx), too slow,
 * unreachable, or an answer that does not read — the next one gets the same
 * prompt. With one key configured this behaves exactly as before.
 *
 * Gemini first, Groq as the first backup, then Mistral (also a free key) and
 * DeepSeek (prepaid, far cheaper than Claude) as reserves when both free
 * quotas are spent, Claude last. Groq is second because it is the fastest to
 * answer, which matters most when the first attempt has already spent part of
 * the time budget.
 */

export type Provider = 'gemini' | 'groq' | 'mistral' | 'deepseek' | 'anthropic'

export const PROVIDER_ORDER: readonly Provider[] = ['gemini', 'groq', 'mistral', 'deepseek', 'anthropic']

export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-3.8-flash',
  // A production model on Groq that supports forced tool calls and writes all
  // eight of the app's languages well. GROQ_MODEL replaces it.
  groq: 'openai/gpt-oss-120b',
  // Mistral's free-plan model. MISTRAL_MODEL replaces it.
  mistral: 'mistral-small-latest',
  // DeepSeek's cheap model. DEEPSEEK_MODEL replaces it when DeepSeek renames it.
  deepseek: 'deepseek-v4-flash',
  anthropic: 'claude-haiku-5-5',
}

/** The providers that have a key, in the order they are tried. */
export function configuredProviders(keys: Partial<Record<Provider, string | undefined>>): Provider[] {
  return PROVIDER_ORDER.filter((p) => !!keys[p])
}

/**
 * The model for a provider. An override (LINGUA_MODEL and friends) names a
 * model of the first provider, so it only applies there. A backup uses its own
 * default — except Groq, Mistral and DeepSeek, whose models can be set on their
 * own with GROQ_MODEL, MISTRAL_MODEL and DEEPSEEK_MODEL, since their catalogues
 * change often.
 */
export function modelFor(
  provider: Provider,
  providers: readonly Provider[],
  override?: string,
  groqModel: string | undefined = process.env.GROQ_MODEL,
  deepseekModel: string | undefined = process.env.DEEPSEEK_MODEL,
) {
  if (provider === providers[0] && override) return override
  if (provider === 'groq' && groqModel) return groqModel
  if (provider === 'deepseek' && deepseekModel) return deepseekModel
  if (provider === 'mistral' && process.env.MISTRAL_MODEL) return process.env.MISTRAL_MODEL
  return DEFAULT_MODELS[provider]
}

// ---------------------------------------------------------------------------
// Groq
// ---------------------------------------------------------------------------

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** The tool each endpoint already gives Claude: name, description, schema. */
export type ToolSpec = {
  name: string
  description?: string
  input_schema: unknown
}

/**
 * Asks Groq for the same answer the endpoint asks Claude for.
 *
 * Groq speaks the OpenAI chat format, and a forced function call there is the
 * same idea as Claude's forced tool: the endpoint's existing tool schema is
 * passed through unchanged, so the answer comes back in exactly the shape
 * readAnthropic returns and nothing after this call needs to know who wrote it.
 *
 * `reasoning_effort: 'low'` because the default model reasons before it
 * answers, and that reasoning is counted against both the token ceiling and
 * the time budget a backup has left.
 */
export function callGroq(
  tool: ToolSpec,
  prompt: string,
  key: string,
  signal: AbortSignal,
  model: string,
  opts: { maxTokens: number; temperature: number },
) {
  return fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: opts.maxTokens,
      temperature: opts.temperature,
      ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description ?? '',
            parameters: tool.input_schema,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: tool.name } },
    }),
  })
}

// ---------------------------------------------------------------------------
// Mistral and DeepSeek
// ---------------------------------------------------------------------------

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

type ChatToolCall = (
  tool: ToolSpec,
  prompt: string,
  key: string,
  signal: AbortSignal,
  model: string,
  opts: { maxTokens: number; temperature: number },
) => Promise<Response>

/**
 * Mistral and DeepSeek ask for the same answer exactly as callGroq does: both
 * speak the OpenAI chat format with function calls, so readGroq reads their
 * answers too. Only the address, the token-limit field and how the one tool
 * is forced differ (Mistral takes 'any', which with a single tool means it).
 */
export const callMistral: ChatToolCall = (tool, prompt, key, signal, model, opts) =>
  callChatTool(MISTRAL_URL, 'any', tool, prompt, key, signal, model, opts)

export const callDeepSeek: ChatToolCall = (tool, prompt, key, signal, model, opts) =>
  callChatTool(DEEPSEEK_URL, { type: 'function', function: { name: tool.name } }, tool, prompt, key, signal, model, opts)

function callChatTool(
  url: string,
  toolChoice: unknown,
  ...[tool, prompt, key, signal, model, opts]: Parameters<ChatToolCall>
) {
  return fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description ?? '',
            parameters: tool.input_schema,
          },
        },
      ],
      tool_choice: toolChoice,
    }),
  })
}

/**
 * Unwraps Groq's (and Mistral's and DeepSeek's) answer to the tool's arguments, as an object.
 *
 * The arguments arrive as a JSON string. A model that ignores the forced call
 * and writes the JSON as plain text is accepted too, so long as it parses —
 * the endpoint validates the shape afterwards either way. Anything else is
 * `null`, which `firstAnswer` treats as unusable and moves on.
 */
export function readGroq(toolName: string) {
  return (data: unknown): unknown => {
    const message = (
      data as {
        choices?: Array<{
          message?: {
            content?: string | null
            tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>
          }
        }>
      }
    ).choices?.[0]?.message
    const call = message?.tool_calls?.find((c) => c.function?.name === toolName)
    const raw = call?.function?.arguments ?? message?.content ?? ''
    const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
    if (!text) return null
    try {
      const value = JSON.parse(text)
      return value && typeof value === 'object' ? value : null
    } catch {
      return null
    }
  }
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
