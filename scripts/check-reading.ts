import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  GENRES, LEVELS, buildIndex, lemmaOf, lookupWord, pickNext, splitText, wordCount,
  type ReadingStory, type VocabEntry,
} from '../src/reading/library.ts'

const vocab: VocabEntry[] = JSON.parse(readFileSync('public/reading/vocab.json', 'utf8'))
const index = buildIndex(vocab)

// The word bank: every level is there, and inflected forms find their word.
assert.ok(vocab.length >= 5000)
for (const l of ['A1', 'A2', 'B1', 'B2']) assert.ok(vocab.some((e) => e.l === l), `level ${l}`)
assert.ok(lookupWord(index, 'tiderna')?.some((e) => e.en === 'time'), 'definite plural')
assert.ok(lookupWord(index, 'Tid')?.length, 'case-insensitive')
assert.equal(lookupWord(index, 'zzzqx'), null)
assert.equal(lemmaOf({ id: 1, sv: 'en tid / en gång', en: 'time', de: '', l: 'A1', t: 'noun' }), 'tid')
assert.equal(lemmaOf({ id: 2, sv: 'ett år', en: 'year', de: '', l: 'A1', t: 'noun' }), 'år')

// Text splitting keeps every character, so the story reads back unchanged.
const sample = 'Hon säger: “Hej, Anna-Lisa!” Det är 5 kr.'
assert.equal(splitText(sample).map((s) => s.text).join(''), sample)
assert.deepEqual(splitText(sample).filter((s) => s.word).map((s) => s.text), ['Hon', 'säger', 'Hej', 'Anna-Lisa', 'Det', 'är', 'kr'])

// The stories: well-formed, unique, listed in the index, at least 170 words.
const listed: string[] = JSON.parse(readFileSync('public/reading/index.json', 'utf8')).files
const onDisk = readdirSync('public/reading/stories').filter((f) => f.endsWith('.json')).sort()
assert.deepEqual([...listed].sort(), onDisk, 'public/reading/index.json lists every story file')
const stories: ReadingStory[] = listed.flatMap((f) => JSON.parse(readFileSync(`public/reading/stories/${f}`, 'utf8')))
const ids = new Set<string>()
for (const s of stories) {
  assert.ok(!ids.has(s.id), `duplicate id ${s.id}`); ids.add(s.id)
  assert.ok((LEVELS as readonly string[]).includes(s.level), `${s.id} level`)
  assert.ok(GENRES.some((g) => g.id === s.genre), `${s.id} genre`)
  assert.ok(s.title.sv && s.title.en, `${s.id} title`)
  assert.ok(s.p.length >= 4 && s.p.every((p) => p.sv.trim() && p.en.trim()), `${s.id} paragraphs need Swedish and English`)
  assert.ok(wordCount(s) >= 170, `${s.id} has ${wordCount(s)} words`)
}

// New story: prefers unread, never the one just read, stays inside the chosen levels.
const mk = (id: string, level: ReadingStory['level']): ReadingStory => ({ id, level, genre: 'story', title: { sv: id, en: id }, p: [] })
const pool = [mk('a', 'A1'), mk('b', 'A1'), mk('c', 'B1')]
assert.equal(pickNext(pool, ['A1'], new Set(['a']), undefined, () => 0)?.id, 'b')
assert.equal(pickNext(pool, ['A1'], new Set(), 'a', () => 0)?.id, 'b')
assert.equal(pickNext(pool, ['B1'], new Set(['c']), undefined, () => 0)?.id, 'c', 'all read: any story again')
assert.equal(pickNext(pool, ['C1'], new Set()), null)

console.log(`reading checks passed (${stories.length} stories, ${vocab.length} words)`)
