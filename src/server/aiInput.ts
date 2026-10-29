import { LANGS, type Lang } from '../db/langs.js'

/**
 * Derived from LANGUAGES rather than listed again.
 *
 * This used to be its own hard-coded array, and a second copy of it lived in
 * the two JSON schemas in api/expand.ts. Adding a language to LANGUAGES then
 * left the server rejecting it — the one failure mode the comment on
 * LANGUAGES promises cannot happen.
 */
export const SUPPORTED_LANGS: readonly Lang[] = LANGS
export type SupportedLang = Lang

const LANG_SET: ReadonlySet<string> = new Set(SUPPORTED_LANGS)
const GENRES = new Set(['fun', 'fact', 'social', 'dialogue', 'joke'])
const LENGTHS = new Set(['short', 'long'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isSupportedLang(value: unknown): value is SupportedLang {
  return typeof value === 'string' && LANG_SET.has(value)
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export interface ExpandInput {
  lemma: string
  sourceLang?: SupportedLang
  nativeLang: SupportedLang
  langs: SupportedLang[]
  hint?: string
  /** A second word the learner entered with this one, to learn side by side. */
  partner?: string
}

export function parseExpandInput(input: unknown): ParseResult<ExpandInput> {
  if (!isRecord(input)) return { ok: false, error: 'Request body must be a JSON object.' }

  const lemma = typeof input.lemma === 'string' ? input.lemma.trim() : ''
  if (!lemma) return { ok: false, error: 'lemma is required.' }
  if (lemma.length > 120) return { ok: false, error: 'lemma is too long (maximum 120 characters).' }

  const nativeLang = input.nativeLang === undefined ? 'fa' : input.nativeLang
  if (!isSupportedLang(nativeLang)) return { ok: false, error: 'nativeLang is not supported.' }

  let sourceLang: SupportedLang | undefined
  if (input.sourceLang !== undefined && input.sourceLang !== null && input.sourceLang !== '') {
    if (!isSupportedLang(input.sourceLang)) return { ok: false, error: 'sourceLang is not supported.' }
    sourceLang = input.sourceLang
  }

  if (!Array.isArray(input.langs) || input.langs.length < 1 || input.langs.length > SUPPORTED_LANGS.length) {
    return {
      ok: false,
      error: `langs must contain between 1 and ${SUPPORTED_LANGS.length} supported languages.`,
    }
  }
  if (!input.langs.every(isSupportedLang)) {
    return { ok: false, error: 'langs contains an unsupported language.' }
  }
  const langs = [...new Set(input.langs)] as SupportedLang[]
  if (langs.length !== input.langs.length) {
    return { ok: false, error: 'langs must not contain duplicates.' }
  }

  let hint: string | undefined
  if (input.hint !== undefined && input.hint !== null && input.hint !== '') {
    if (typeof input.hint !== 'string') return { ok: false, error: 'hint must be text.' }
    hint = input.hint.trim()
    if (hint.length > 300) return { ok: false, error: 'hint is too long (maximum 300 characters).' }
  }

  let partner: string | undefined
  if (input.partner !== undefined && input.partner !== null && input.partner !== '') {
    if (typeof input.partner !== 'string') return { ok: false, error: 'partner must be text.' }
    partner = input.partner.trim()
    if (partner.length > 120) {
      return { ok: false, error: 'partner is too long (maximum 120 characters).' }
    }
  }

  return { ok: true, value: { lemma, sourceLang, nativeLang, langs, hint, partner } }
}

export interface StoryInput {
  lang: SupportedLang
  nativeLang: SupportedLang
  words: string[]
  genre: string
  length: 'short' | 'long'
  unknownShare: number
}

export function parseStoryInput(input: unknown): ParseResult<StoryInput> {
  if (!isRecord(input)) return { ok: false, error: 'Request body must be a JSON object.' }

  const lang = input.lang === undefined ? 'sv' : input.lang
  const nativeLang = input.nativeLang === undefined ? 'fa' : input.nativeLang
  if (!isSupportedLang(lang)) return { ok: false, error: 'lang is not supported.' }
  if (!isSupportedLang(nativeLang)) return { ok: false, error: 'nativeLang is not supported.' }

  if (!Array.isArray(input.words) || !input.words.every((word) => typeof word === 'string')) {
    return { ok: false, error: 'words must be an array of text values.' }
  }
  if (input.words.some((word) => word.trim().length > 120)) {
    return { ok: false, error: 'Each word must be 120 characters or fewer.' }
  }
  const words = input.words.map((word) => word.trim()).filter(Boolean).slice(0, 400)
  if (words.length < 5) return { ok: false, error: 'Not enough words yet. Add a few more and try again.' }

  const genre = input.genre === undefined ? 'fun' : input.genre
  const length = input.length === undefined ? 'short' : input.length
  if (typeof genre !== 'string' || !GENRES.has(genre)) return { ok: false, error: 'genre is not supported.' }
  if (typeof length !== 'string' || !LENGTHS.has(length)) return { ok: false, error: 'length must be short or long.' }

  const unknownShare = input.unknownShare === undefined ? 0.05 : input.unknownShare
  if (typeof unknownShare !== 'number' || !Number.isFinite(unknownShare)) {
    return { ok: false, error: 'unknownShare must be a finite number.' }
  }

  return {
    ok: true,
    value: {
      lang,
      nativeLang,
      words,
      genre,
      length: length as 'short' | 'long',
      unknownShare: Math.min(0.3, Math.max(0, unknownShare)),
    },
  }
}
