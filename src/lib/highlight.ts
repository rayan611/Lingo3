import { morphLines } from './morphology'
import type { Lang, Morphology } from '../db/types'

export interface Segment {
  text: string
  hit: boolean
}

/** A letter, a combining mark or a digit — used as a word boundary test. */
const LETTER = /[\p{L}\p{M}\p{N}]/u

/**
 * Every written form this entry can appear as: the headword plus every value
 * in its morphology table.
 *
 * An example sentence contains an INFLECTED form, not the headword — "Jag
 * dricker kaffe", not "dricka" — so finding the word in its own example means
 * knowing all of its forms. The morphology tables already hold them.
 *
 * A multi-word value also contributes its last word, because German Perfekt is
 * stored as `ist gegangen` and the sentence usually only carries `gegangen`.
 * Only the last word: the first is an auxiliary, and matching bare `ist` would
 * light up half the sentence.
 */
export function formCandidates(
  headword: string,
  lang: Lang,
  form: Morphology['form'] | undefined,
): string[] {
  const out = new Set<string>()

  // `raw` is typed as a string but a morphology line can be assembled from
  // fields that were never filled in, so it is checked rather than trusted.
  const add = (raw: string | undefined | null) => {
    if (!raw) return
    for (const part of raw.split(/[,;/|]/)) {
      const value = part.trim().replace(/^[-–—]+|[-–—]+$/g, '').trim()
      if (value.length < 2) continue
      out.add(value)
      const words = value.split(/\s+/)
      const last = words[words.length - 1]
      if (words.length > 1 && last.length >= 3) out.add(last)
    }
  }

  add(headword)
  for (const line of morphLines(lang, form)) add(line.value)

  // Longest first, so `hunden` wins over `hund` at the same position.
  return [...out].sort((a, b) => b.length - a.length)
}

/**
 * Splits a sentence into plain and matched segments.
 *
 * Deliberately not a regex: building one from arbitrary word forms means
 * escaping, and the boundary test needs lookbehind, which is the kind of thing
 * that works everywhere except the one iPhone you actually own. A scan is
 * longer to read and has no such surprises.
 *
 * Matching is done on a lowercased copy and sliced out of the original, so the
 * returned text keeps its real capitalisation. If lowercasing changes the
 * length — which a few scripts do — nothing is highlighted rather than the
 * wrong thing being highlighted.
 */
export function markForms(text: string, candidates: string[]): Segment[] {
  if (!text) return []
  const lower = text.toLowerCase()
  if (lower.length !== text.length || candidates.length === 0) {
    return [{ text, hit: false }]
  }

  const forms = candidates
    .map((c) => c.toLowerCase())
    .filter((c) => c.length >= 2)
    .sort((a, b) => b.length - a.length)

  const segments: Segment[] = []
  let plain = ''
  let i = 0

  while (i < text.length) {
    let matched = 0
    for (const form of forms) {
      if (form.length > text.length - i) continue
      if (!lower.startsWith(form, i)) continue
      if (LETTER.test(text[i - 1] ?? '')) continue
      if (LETTER.test(text[i + form.length] ?? '')) continue
      matched = form.length
      break
    }
    if (matched > 0) {
      if (plain) {
        segments.push({ text: plain, hit: false })
        plain = ''
      }
      segments.push({ text: text.slice(i, i + matched), hit: true })
      i += matched
    } else {
      plain += text[i]
      i += 1
    }
  }
  if (plain) segments.push({ text: plain, hit: false })
  return segments
}
