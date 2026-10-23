import { db } from '../db/db'
import {
  LANG_NAMES,
  activeTargets,
  collectionOf,
  type Collection,
  type Concept,
  type Entry,
  type Lang,
  type Settings,
} from '../db/types'
import { toCsv } from './csv'

/**
 * Exporting one list, for Anki and for everything else.
 *
 * Two formats, because flashcard apps split into two groups and no single
 * file serves both well.
 *
 * **Anki** imports tab-separated text with directives at the top, and its
 * note types have as many fields as you like. So the languages get a column
 * each: the word you are learning, the second language, the third, the
 * example, the topics. Anki can then make whichever cards you want from
 * them, and you can edit one language without touching the others.
 *
 * **Everything else** — Quizlet, Memrise, most of the rest — is two columns,
 * term and definition, and nothing more. There the second and third
 * languages have nowhere to go but the answer side, stacked under the first.
 * That is a real loss of structure, and it is the format's loss rather than
 * ours; the alternative is exporting only one language, which is worse.
 *
 * Both are driven by the SAME idea of which language is primary: the first of
 * your active target languages, in the priority order you set. That is the
 * language the review card already stacks first, so the deck you take to
 * another app is ordered the way the one in here is.
 */

/** Which languages a deck is built from, in the order they appear. */
export interface DeckLangs {
  /** The language the prompt is written in — the one you already know. */
  prompt: Lang
  /** Target languages by priority. The first is the primary; see above. */
  targets: Lang[]
}

export function deckLangs(settings: Settings): DeckLangs {
  return { prompt: settings.nativeLang, targets: activeTargets(settings) }
}

export interface DeckRow {
  concept: Concept
  byLang: Map<Lang, Entry>
}

export async function rowsFor(collectionId: string): Promise<DeckRow[]> {
  const [concepts, entries] = await Promise.all([
    db.concepts.toArray(),
    db.entries.toArray(),
  ])
  const mine = concepts.filter(
    (c) => !c.deletedAt && collectionOf(c) === collectionId,
  )
  const ids = new Set(mine.map((c) => c.id))
  const grouped = new Map<string, Map<Lang, Entry>>()
  for (const e of entries) {
    if (!ids.has(e.conceptId)) continue
    const row = grouped.get(e.conceptId) ?? new Map<Lang, Entry>()
    row.set(e.lang, e)
    grouped.set(e.conceptId, row)
  }
  return mine
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((concept) => ({
      concept,
      byLang: grouped.get(concept.id) ?? new Map<Lang, Entry>(),
    }))
}

/** The prompt side: the word as you know it, falling back to what you typed. */
function promptOf(row: DeckRow, langs: DeckLangs): string {
  return row.byLang.get(langs.prompt)?.headword || row.concept.lemma
}

/**
 * Anki's plain-text format.
 *
 * The directives matter more than they look. Without `#separator:tab` Anki
 * guesses, and a French card containing a comma can push the rest of the row
 * into the wrong field. `#html:false` stops an apostrophe or an angle bracket
 * being read as markup. `#deck:` puts the cards where the list says rather
 * than in Default, and `#tags column:` is what turns the last column into
 * real Anki tags instead of a field full of words.
 *
 * Tabs and newlines are stripped from every cell rather than quoted: Anki's
 * reader has no quoting to speak of, so a stray tab is a corrupt row, and a
 * word containing one is not a word.
 */
export function buildAnkiTsv(
  collection: Collection,
  rows: DeckRow[],
  langs: DeckLangs,
): string {
  const [primary, second, third] = langs.targets
  const header = [
    '#separator:tab',
    '#html:false',
    `#deck:Lingo3::${clean(collection.name)}`,
    '#tags column:7',
    // A comment line naming the columns. Anki ignores anything starting with
    // '#', so this costs nothing and is the only thing standing between the
    // person doing the import and guessing which field is which.
    `#columns:${[
      LANG_NAMES[langs.prompt],
      primary ? LANG_NAMES[primary] : 'Target',
      second ? LANG_NAMES[second] : '',
      third ? LANG_NAMES[third] : '',
      'Example',
      'Meaning',
      'Tags',
    ]
      .map(clean)
      .join('\t')}`,
  ]

  const body = rows.map((row) => {
    const primaryEntry = primary ? row.byLang.get(primary) : undefined
    return [
      promptOf(row, langs),
      primaryEntry?.headword ?? '',
      second ? (row.byLang.get(second)?.headword ?? '') : '',
      third ? (row.byLang.get(third)?.headword ?? '') : '',
      primaryEntry?.example ?? '',
      primaryEntry?.meaning ?? '',
      (row.concept.tags ?? []).join(' '),
    ]
      .map(clean)
      .join('\t')
  })

  return [...header, ...body].join('\n')
}

/** A tab or a newline inside a cell is a broken row, so neither survives. */
function clean(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim()
}

/**
 * Two columns, for every app that only has two.
 *
 * The answer side carries the primary language first and the others under it,
 * which is the arrangement the system prompt of this feature asked for and
 * also the only one that survives an importer with nowhere else to put them.
 * Separated by newlines inside a quoted CSV field — Quizlet, Memrise and a
 * spreadsheet all read that correctly, and it keeps the three languages on
 * three lines of the card rather than running them together.
 */
export function buildGenericCsv(rows: DeckRow[], langs: DeckLangs): string {
  const out: (string | undefined)[][] = [['Front', 'Back']]
  for (const row of rows) {
    const back: string[] = []
    for (const lang of langs.targets) {
      const entry = row.byLang.get(lang)
      if (!entry) continue
      back.push(
        langs.targets.length > 1
          ? `${LANG_NAMES[lang]}: ${entry.headword}`
          : entry.headword,
      )
    }
    const primaryEntry = langs.targets[0]
      ? row.byLang.get(langs.targets[0])
      : undefined
    if (primaryEntry?.example) back.push(primaryEntry.example)
    out.push([promptOf(row, langs), back.join('\n')])
  }
  return toCsv(out)
}

export type DeckFormat = 'anki' | 'generic'

/**
 * Builds a list's deck and hands back the file, without touching the DOM.
 *
 * Separated from the download so the checks can read what comes out: a format
 * that is only ever exercised by clicking a button in a browser is a format
 * nobody has read since the day it was written.
 */
export async function buildDeck(
  collection: Collection,
  settings: Settings,
  format: DeckFormat,
): Promise<{ filename: string; body: string; mime: string; count: number }> {
  const rows = await rowsFor(collection.id)
  const langs = deckLangs(settings)
  const slug =
    collection.name
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'list'
  const date = new Date().toISOString().slice(0, 10)

  if (format === 'anki') {
    return {
      filename: `lingo3-${slug}-anki-${date}.txt`,
      body: buildAnkiTsv(collection, rows, langs),
      mime: 'text/plain;charset=utf-8',
      count: rows.length,
    }
  }
  return {
    filename: `lingo3-${slug}-${date}.csv`,
    body: buildGenericCsv(rows, langs),
    mime: 'text/csv;charset=utf-8',
    count: rows.length,
  }
}

/** Triggers the download. The BOM is what stops Excel mangling UTF-8. */
export function downloadText(filename: string, body: string, mime: string): void {
  const blob = new Blob(['﻿', body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportCollection(
  collection: Collection,
  settings: Settings,
  format: DeckFormat,
): Promise<number> {
  const deck = await buildDeck(collection, settings, format)
  downloadText(deck.filename, deck.body, deck.mime)
  return deck.count
}
