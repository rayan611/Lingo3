/**
 * What /api/expand sends to the shared vocabulary bank.
 *
 * Kept free of browser and Node-only imports so the same code is exercised by
 * scripts/check-shared-vocab.ts and by the serverless function.
 */

export interface SharedEntryIn {
  lang: string
  headword: string
  example?: string
  morphology?: unknown
  notes?: string
  [key: string]: unknown
}

export interface SharedExpansionIn {
  pos: string
  tags?: string[]
  detectedLang?: string
  entries: SharedEntryIn[]
  [key: string]: unknown
}

const ARTICLES: Record<string, string[]> = {
  sv: ['en', 'ett', 'att'],
  de: ['der', 'die', 'das'],
  en: ['a', 'an', 'the', 'to'],
  es: ['el', 'la', 'los', 'las'],
  it: ['il', 'lo', 'la', 'le', 'gli', 'i'],
  fr: ['le', 'la', 'les'],
}

/** "ett hus" → "hus", "to eat" → "eat". Mirrors public.shared_bare_word in SQL. */
export function bareWord(word: string, lang: string): string {
  const parts = word.normalize('NFC').trim().split(/\s+/)
  if (parts.length > 1 && (ARTICLES[lang] ?? []).includes(parts[0].toLowerCase())) {
    return parts.slice(1).join(' ')
  }
  return parts.join(' ')
}

const MAX_HEADWORD = 100
const MAX_EXAMPLE = 500

/**
 * The body for cache_ai_expansion, or null when the answer is not worth
 * keeping. Entries without a headword and an example are dropped rather than
 * failing the whole answer: the database merges languages over time, so a
 * partial answer still helps, but it must contain the typed language and at
 * least one more.
 */
export function sharedCachePayload(
  expansion: SharedExpansionIn,
): { cache_key: string; expansion: SharedExpansionIn } | null {
  const lang = expansion.detectedLang
  if (!lang || !/^[a-z]{2}$/.test(lang)) return null
  const entries = expansion.entries
    .filter(
      (e) =>
        /^[a-z]{2}$/.test(e.lang) &&
        e.headword.trim().length > 0 &&
        e.headword.length <= MAX_HEADWORD &&
        (e.example ?? '').trim().length > 0 &&
        (e.example ?? '').length <= MAX_EXAMPLE,
    )
    .map((e) => ({
      lang: e.lang,
      headword: e.headword.trim(),
      example: e.example!.trim(),
      ...(e.morphology ? { morphology: e.morphology } : {}),
      ...(typeof e.notes === 'string' && e.notes.trim() ? { notes: e.notes.trim() } : {}),
    }))
  const source = entries.find((e) => e.lang === lang)
  if (!source || new Set(entries.map((e) => e.lang)).size < 2) return null
  const key = bareWord(source.headword, lang).toLowerCase().slice(0, 100)
  return {
    cache_key: `ai:${lang}:${expansion.pos}:${key}`,
    expansion: { pos: expansion.pos, tags: expansion.tags, detectedLang: lang, entries },
  }
}

/**
 * Supabase's new secret keys (sb_secret_…) are not JWTs and go in `apikey`
 * alone; the older service_role JWT also goes in Authorization.
 */
export function serviceHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' }
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`
  return headers
}

/** JSON nulls become absent keys: the expansion schemas accept missing, not null. */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, stripNulls(v)]),
    )
  }
  return value
}
