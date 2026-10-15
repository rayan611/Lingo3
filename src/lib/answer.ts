import type { Lang } from '../db/types'

/**
 * Is what you typed the same word?
 *
 * Case and surrounding whitespace are noise, and so are the diacritic-free
 * spellings a phone keyboard produces, so "fodd" is accepted for "född".
 * Everything else — including the article, which is half of what you are
 * learning — has to match.
 *
 * Lives here rather than in the review screen because the cloze prompt grades
 * against the same rules, and two copies of "what counts as right" is how the
 * two quietly drift apart.
 */
export function sameWord(typed: string, expected: string, _lang?: Lang): boolean {
  return normaliseAnswer(typed) === normaliseAnswer(expected)
}

export function normaliseAnswer(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
