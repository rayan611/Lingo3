// Quick-translate languages. Like langs.ts this imports nothing, so the
// serverless handler can share the list. Wider than LANGUAGES on purpose: a
// plain translation needs no morphology rules, so it can cover languages the
// app does not teach.

export const TRANSLATE_LANGS = {
  en: 'English',
  fa: 'Persian (Farsi)',
  sv: 'Swedish',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  ru: 'Russian',
  pt: 'Portuguese',
  nl: 'Dutch',
  tr: 'Turkish',
  ar: 'Arabic',
  ja: 'Japanese',
  zh: 'Chinese (Simplified)',
} as const

export type TranslateLang = keyof typeof TRANSLATE_LANGS

export const TRANSLATE_RTL: ReadonlySet<string> = new Set(['fa', 'ar'])

export function isTranslateLang(v: unknown): v is TranslateLang {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(TRANSLATE_LANGS, v)
}

/** Longest text accepted: a phrase or a sentence, not a document. */
export const TRANSLATE_MAX_CHARS = 300
