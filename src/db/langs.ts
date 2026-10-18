// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------
//
// Deliberately a file of its OWN, importing nothing.
//
// It used to live in types.ts, which imports theme.ts, which touches
// `document` — so the serverless handlers could not import it and kept their
// own hard-coded copy of the list instead. That copy is how a language could
// be added to the app and still be rejected by the API. Nothing here may grow
// an import that reaches the DOM.

/**
 * ADDING A LANGUAGE
 *
 * Add one entry to LANGUAGES below and you are done. Nothing is hard-coded to
 * three languages: the schema is per (word x language), the queue reads
 * whatever is active, and a language with no morphology rules of its own falls
 * back to plain entries rather than breaking.
 *
 * Two optional extras, worth doing for a language you will actually study:
 *   - morphology rules in MorphologySchema in ./types.ts (gender, verb forms)
 *   - display labels in src/lib/morphology.ts, so forms are labelled in that
 *     language's own grammatical terms
 *   - the matching block in MORPHOLOGY_RULES in api/expand.ts, so the model
 *     knows which fields to fill
 *
 * Without those three, the language still works — you just get the headword,
 * meaning and example rather than tables of forms.
 */
export const LANGUAGES = {
  fa: { name: 'Persian', native: 'فارسی', bcp47: 'fa-IR', rtl: true },
  en: { name: 'English', native: 'English', bcp47: 'en-GB', rtl: false },
  sv: { name: 'Swedish', native: 'Svenska', bcp47: 'sv-SE', rtl: false },
  de: { name: 'German', native: 'Deutsch', bcp47: 'de-DE', rtl: false },
  es: { name: 'Spanish', native: 'Español', bcp47: 'es-ES', rtl: false },
  ru: { name: 'Russian', native: 'Русский', bcp47: 'ru-RU', rtl: false },
  it: { name: 'Italian', native: 'Italiano', bcp47: 'it-IT', rtl: false },
} as const satisfies Record<
  string,
  { name: string; native: string; bcp47: string; rtl: boolean }
>

export type Lang = keyof typeof LANGUAGES

export const LANGS = Object.keys(LANGUAGES) as Lang[]
