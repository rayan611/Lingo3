import type { Lang, PartOfSpeech } from '../db/types'

/**
 * The word packs that ship with the app.
 *
 * Three decisions are worth reading before touching the data files.
 *
 * **One row, every language.** A pack is a list of *concepts*, and each row
 * carries the word in all eight languages. That is the same shape the rest of
 * the app uses — a Concept with an Entry per language — so enabling a pack is
 * a local write and nothing else: no model call, no network, no waiting, and
 * it works on a train. It also means a learner who changes their native
 * language keeps the whole pack, because the row already holds the new one.
 *
 * **Every concept is in exactly one pack.** `red` is an A1 word and it is
 * also an everyday-colour word, and listing it twice would be the obvious
 * thing to do and the wrong one. The packs are partitioned instead: the
 * closed sets — numbers, colours, days, months, food, family — are the
 * everyday pack, A1 takes the core verbs, pronouns, question words and
 * prepositions, A2 takes travel, work, health, feeling and the connectives.
 * So "enable all three" is 300 distinct words rather than 300 minus an
 * overlap nobody can see.
 *
 * `seedId` is still checked on enable, as a belt to that brace: if a row ever
 * does appear twice, or you add the same pack twice, or a word arrives from
 * another device mid-enable, the second one is skipped rather than
 * duplicated. The partition is the design; the check is the guarantee.
 *
 * **Headwords carry their article; morphology does not ship.** `der Hund`,
 * `en hund`, `el perro` — the article is in the headword, exactly as the
 * model is told to return it, because a wrong or missing gender is the single
 * most expensive error this app can make. The rest of the morphology (verb
 * tables, Russian cases) and the example sentences are left empty and filled
 * in by the ordinary expansion queue when you ask for it. A hundred rows of
 * hand-written verb tables would be a hundred chances to drill something
 * wrong for months.
 */

/**
 * One concept, in every language.
 *
 * A tuple rather than an object, and the field order is fixed by LANG_ORDER
 * below. Three hundred of these as objects would be three hundred repetitions
 * of the same eight keys; as tuples the data file reads like the vocabulary
 * list it is, and a missing column is a compile error rather than a silently
 * absent language.
 */
export type SeedRow = readonly [
  id: string,
  pos: PartOfSpeech,
  /** Space-separated topics, written onto the concept as `tags`. */
  tags: string,
  fa: string,
  en: string,
  sv: string,
  de: string,
  es: string,
  ru: string,
  it: string,
  fr: string,
]

/** The column order of a SeedRow, from index 3 onwards. */
export const LANG_ORDER = ['fa', 'en', 'sv', 'de', 'es', 'ru', 'it', 'fr'] as const

export interface Pack {
  id: string
  /** What the list is called when it is created. */
  name: string
  /** One line under the name on the word-lists screen. */
  blurb: string
  rows: readonly SeedRow[]
}

/** The word in one language, or undefined where a row leaves it blank. */
export function wordIn(row: SeedRow, lang: Lang): string | undefined {
  const i = (LANG_ORDER as readonly string[]).indexOf(lang)
  if (i < 0) return undefined
  return row[3 + i] || undefined
}

/**
 * The gloss stored on an entry: the same concept in the learner's own
 * language.
 *
 * This is why carrying all eight languages in the row pays for itself. The
 * gloss is not a fixed English string baked into the pack — it is whichever
 * column the learner reads, so a Persian speaker studying Swedish sees
 * "سگ" under `en hund` rather than "dog", and nothing had to be translated to
 * make that true.
 *
 * The one case that needs an answer is the entry for the native language
 * itself, where the gloss would otherwise repeat the headword. English fills
 * in there, since it is the language the rest of the app falls back to.
 */
export function glossFor(row: SeedRow, lang: Lang, nativeLang: Lang): string {
  if (lang !== nativeLang) {
    const native = wordIn(row, nativeLang)
    if (native) return native
  }
  return wordIn(row, 'en') ?? wordIn(row, nativeLang) ?? row[0]
}

export function tagsOf(row: SeedRow): string[] {
  return row[2].split(/\s+/).filter(Boolean)
}

/** How many words a pack holds. */
export function packSize(pack: Pack): number {
  return pack.rows.length
}
