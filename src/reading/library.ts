/**
 * The Reading Library: stories written in advance from the Swedish word bank,
 * level by level, with the word bank itself used for tap-to-translate.
 *
 * Everything here is plain data and pure functions, so the behaviour is checked
 * without a browser (scripts/check-reading.ts). The two JSON sources live in
 * public/reading and are fetched on demand, not bundled: the word bank alone is
 * ~700 KB and most sessions never open this screen.
 */

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type Level = (typeof LEVELS)[number]

export const GENRES = [
  { id: 'story', label: 'Story' },
  { id: 'fact', label: 'Fact' },
  { id: 'life', label: 'Life' },
  { id: 'funny', label: 'Funny' },
  { id: 'info', label: 'Information' },
] as const
export type GenreId = (typeof GENRES)[number]['id']

export interface VocabEntry {
  id: number
  /** Headword as written in the bank: may carry an article or alternatives ("en tid / en gång"). */
  sv: string
  en: string
  de: string
  /** A1–B2 from the bank, 'X' for words that only come from the owner's own list. */
  l: string
  t: string
  /** Swedish inflected forms: plural, definite, past, comparative and so on. */
  f?: string[]
  /** [Swedish, English, German] example sentence. */
  x?: string[]
}

export interface ReadingStory {
  id: string
  level: Level
  genre: GenreId
  title: { sv: string; en: string }
  p: { sv: string; en: string }[]
}

export interface Segment {
  text: string
  /** True for a word, false for spaces and punctuation. */
  word: boolean
}

const ARTICLE = /^(en|ett|att|har|är|den|det|de)\s+/i

/** Every spelling under which an entry can be found when a learner taps a word. */
export function variantsOf(entry: VocabEntry): string[] {
  const out = new Set<string>()
  for (const raw of [entry.sv, ...(entry.f ?? [])]) {
    const text = raw.replace(/\(.*?\)/g, '')
    for (const piece of text.split(/[/,]/)) {
      let v = piece.trim().toLocaleLowerCase().replace(/!$/, '')
      v = v.replace(ARTICLE, '').replace(ARTICLE, '')
      if (!v) continue
      out.add(v)
      if (v.includes(' ')) out.add(v.split(' ')[0])
    }
  }
  return [...out]
}

export type VocabIndex = Map<string, VocabEntry[]>

export function buildIndex(entries: readonly VocabEntry[]): VocabIndex {
  const index: VocabIndex = new Map()
  for (const entry of entries) {
    for (const v of variantsOf(entry)) {
      const list = index.get(v)
      if (list) list.push(entry)
      else index.set(v, [entry])
    }
  }
  return index
}

const levelRank = (l: string) => {
  const i = (LEVELS as readonly string[]).indexOf(l)
  return i < 0 ? 9 : i
}

/** The entries for a tapped word, easiest level first. Null when the bank does not know it. */
export function lookupWord(index: VocabIndex, token: string): VocabEntry[] | null {
  const word = token.toLocaleLowerCase()
  const hits = index.get(word) ?? (word.endsWith('s') ? index.get(word.slice(0, -1)) : undefined)
  return hits ? [...hits].sort((a, b) => levelRank(a.l) - levelRank(b.l)) : null
}

/** Splits a paragraph into words and the gaps between them, so every word can be a button. */
export function splitText(text: string): Segment[] {
  const out: Segment[] = []
  const re = /[A-Za-zÅÄÖåäöéÉ]+(?:-[A-Za-zÅÄÖåäöé]+)*/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), word: false })
    out.push({ text: m[0], word: true })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false })
  return out
}

/** "en tid / en gång" → "tid". What gets added to the learner's own words. */
export function lemmaOf(entry: VocabEntry): string {
  const first = entry.sv.replace(/\(.*?\)/g, '').split('/')[0].trim()
  return first.replace(/^(en|ett)\s+/i, '').replace(/^att\s+/i, '')
}

export function wordCount(story: ReadingStory): number {
  return story.p.reduce((n, p) => n + (p.sv.match(/\S+/g)?.length ?? 0), 0)
}

/**
 * The story the "New story" button opens: unread first, then the one whose
 * level is easiest, then anything. `random` is injected so the choice is testable.
 */
export function pickNext(
  stories: readonly ReadingStory[],
  levels: readonly Level[],
  done: ReadonlySet<string>,
  exclude?: string,
  random: () => number = Math.random,
): ReadingStory | null {
  const inLevels = stories.filter((s) => levels.includes(s.level) && s.id !== exclude)
  const unread = inLevels.filter((s) => !done.has(s.id))
  const pool = unread.length ? unread : inLevels
  return pool.length ? pool[Math.floor(random() * pool.length)] : null
}

// ---------------------------------------------------------------------------
// Which stories have been read. Kept on the device: a tick is a personal
// bookmark, not learning data, and it must work with no sign-in.
// ---------------------------------------------------------------------------

const DONE_KEY = 'lingo3.reading.done'

export function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveDone(done: ReadonlySet<string>): void {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]))
  } catch {
    /* private mode or full storage: the tick lasts until the page closes */
  }
}

// ---------------------------------------------------------------------------
// Fetching. One request each, remembered for the life of the page; the browser
// cache and the service worker keep them for offline reading.
// ---------------------------------------------------------------------------

let vocabPromise: Promise<VocabEntry[]> | null = null
let storiesPromise: Promise<ReadingStory[]> | null = null

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return (await res.json()) as T
}

export function loadVocab(): Promise<VocabEntry[]> {
  vocabPromise ??= getJson<VocabEntry[]>('/reading/vocab.json').catch((e) => {
    vocabPromise = null
    throw e
  })
  return vocabPromise
}

export function loadStories(): Promise<ReadingStory[]> {
  storiesPromise ??= getJson<{ files: string[] }>('/reading/index.json')
    .then(async ({ files }) => (await Promise.all(files.map((f) => getJson<ReadingStory[]>(`/reading/stories/${f}`)))).flat())
    .catch((e) => {
      storiesPromise = null
      throw e
    })
  return storiesPromise
}
