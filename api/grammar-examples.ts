import { authenticateAiRequest, enforceAiRateLimit } from '../src/server/aiSecurity.js'
import { callGroq, callMistral, callDeepSeek, configuredProviders, firstAnswer, modelFor, readGroq } from '../src/server/aiFallback.js'
import { LANG_PROMPT_NAMES } from '../src/db/langs.js'
import { z } from 'zod'

export const maxDuration = 60
const keys = { gemini: process.env.GEMINI_API_KEY, groq: process.env.GROQ_API_KEY, mistral: process.env.MISTRAL_API_KEY, deepseek: process.env.DEEPSEEK_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY }
const providers = configuredProviders(keys)
const schema = z.object({ lang: z.enum(['fa','en','sv','de','es','ru','it','fr']), nativeLang: z.enum(['fa','en','sv','de','es','ru','it','fr']), title: z.string().trim().min(2).max(160), explanation: z.string().trim().min(8).max(6000) }).strict()
const resultSchema = z.object({ examples: z.array(z.object({ sentence: z.string().trim().min(2).max(500), translation: z.string().trim().min(2).max(500) })).min(2).max(5) })
const tool = { name: 'write_grammar_examples', description: 'Generate accurate learner examples for one grammar rule', input_schema: { type: 'object', properties: { examples: { type: 'array', items: { type: 'object', properties: { sentence: { type: 'string' }, translation: { type: 'string' } }, required: ['sentence','translation'] } } }, required: ['examples'] } }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) }
async function respond(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = await authenticateAiRequest(req)
  if (!auth.ok) return json({ error: auth.message }, auth.status)
  let body: unknown
  try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: 'Invalid grammar input' }, 400)
  if (!providers.length) return json({ error: 'AI provider unavailable' }, 503)
  const rate = await enforceAiRateLimit(req, auth.userId, 'story', 20)
  if (!rate.allowed) return json({ error: rate.message }, rate.status)
  const { lang, nativeLang, title, explanation } = parsed.data
  const prompt = `Create 3 to 4 DIFFERENT natural, grammatically accurate examples that demonstrate this grammar rule. Sentences MUST be in ${LANG_PROMPT_NAMES[lang]}; translations MUST be in ${LANG_PROMPT_NAMES[nativeLang]}. Return only tool JSON. Do not invent unsupported grammar. Rule: ${title}\nNotes: ${explanation}`
  const result = await firstAnswer(providers.map(provider => ({
    provider,
    call: (signal: AbortSignal) => {
      const model = modelFor(provider, providers, process.env.LINGUA_MODEL)
      const options = { maxTokens: 1100, temperature: 0.3 }
      if (provider === 'groq') return callGroq(tool, prompt, keys.groq!, signal, model, options)
      if (provider === 'mistral') return callMistral(tool, prompt, keys.mistral!, signal, model, options)
      if (provider === 'deepseek') return callDeepSeek(tool, prompt, keys.deepseek!, signal, model, options)
      if (provider === 'gemini') return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(keys.gemini!)}`, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1400, responseMimeType: 'application/json' } }) })
      return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-api-key': keys.anthropic!, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 1100, tools: [tool], tool_choice: { type: 'tool', name: tool.name }, messages: [{ role: 'user', content: prompt }] }) })
    },
    read: provider === 'gemini' ? (data: unknown) => { try { return JSON.parse((data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text ?? '') } catch { return null } } : provider === 'anthropic' ? (data: unknown) => (data as { content?: Array<{ type: string; name?: string; input?: unknown }> }).content?.find(x => x.type === 'tool_use' && x.name === tool.name)?.input : readGroq(tool.name),
  })), 45000, 'grammar-examples', 'AI unavailable')
  if (!result.ok) return json({ error: result.error }, result.status)
  const checked = resultSchema.safeParse(result.value)
  return checked.success ? json(checked.data) : json({ error: 'Invalid examples' }, 502)
}
type NodeReq = { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type NodeRes = { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }
export default async function handler(req: Request | NodeReq, res?: NodeRes): Promise<Response | void> {
  let request: Request
  if (res) {
    const headers = new Headers()
    for (const [k, v] of Object.entries((req as NodeReq).headers ?? {})) if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
    const node = req as NodeReq
    request = new Request('https://local' + (node.url ?? '/api/grammar-examples'), { method: node.method ?? 'GET', headers, body: node.method === 'POST' ? typeof node.body === 'string' ? node.body : JSON.stringify(node.body ?? {}) : undefined })
  } else request = req as Request
  let response: Response
  try { response = await respond(request) } catch (error) { console.error('[grammar-examples] request failed', error instanceof Error ? error.name : 'unknown'); response = json({ error: 'AI unavailable' }, 500) }
  if (!res) return response
  res.statusCode = response.status
  response.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(await response.text())
}
