import { markForms } from './highlight'
import { normaliseAnswer } from './answer'

export interface Cloze {
  /** The sentence up to the gap. */
  before: string
  /** The form that belongs in the gap — what has to be typed. */
  answer: string
  /** The rest of the sentence. */
  after: string
}

/** A sentence with nothing but the word in it teaches nothing. */
const MIN_CONTEXT_WORDS = 2

/**
 * The word's own example sentence with the word taken out of it.
 *
 * This is production practice rather than recognition, which is where
 * interference between two similar languages actually shows up — and it costs
 * nothing: the sentence was generated when the word was added and until now
 * was only ever displayed.
 *
 * The form in the gap is the INFLECTED one the sentence uses, not the
 * headword, and that is the point rather than a complication: "dricker" is
 * what you have to say, "dricka" is what a dictionary gives you.
 *
 * Returns null whenever a cloze would be worse than the ordinary prompt —
 * no example, no form of this word in it, or no sentence left once the word
 * is removed. The caller falls back; nothing is lost but the variation.
 */
export function buildCloze(
  example: string | undefined,
  forms: string[],
): Cloze | null {
  if (!example?.trim()) return null

  const segments = markForms(example, forms)
  const first = segments.findIndex((s) => s.hit)
  if (first === -1) return null

  const answer = segments[first].text
  const wanted = normaliseAnswer(answer)

  // Every other occurrence of the SAME form is blanked too — leaving one
  // visible would print the answer beside the gap. A different form of the
  // same word stays: it is a clue, but a fair one, and blanking two
  // different words would make it unclear which is being asked for.
  let before = ''
  let after = ''
  let seen = false
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isGap = segment.hit && normaliseAnswer(segment.text) === wanted
    if (isGap && !seen) {
      seen = true
      continue
    }
    const text = isGap ? '' : segment.text
    if (seen) after += text
    else before += text
  }

  const context = `${before} ${after}`.trim().split(/\s+/).filter(Boolean)
  if (context.length < MIN_CONTEXT_WORDS) return null

  return { before, answer, after }
}
