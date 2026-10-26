import type { Card } from '../db/types'

const DAY = 86_400_000

/** Reviewed due/relearning cards first; stable easy and unreviewed cards stay out. */
export function waitingReviewCandidates(cards: Card[], now: number, shown: ReadonlyMap<string, number>): string[] {
  const best = new Map<string, number>()
  for (const card of cards) {
    if (card.suspended || card.reps === 0) continue
    // Repeatedly successful, stable cards are too easy for this passive practice.
    if (card.state === 2 && card.difficulty < 5 && card.lapses === 0 && card.stability >= 21) continue
    const due = card.due <= now
    const hard = card.difficulty >= 6 || card.lapses > 0 || card.state === 3
    if (!due && !hard && card.reps > 0) continue
    const score = (card.state === 3 ? 400 : due && card.reps > 0 ? 300 : hard ? 200 : 100)
      + card.difficulty * 3 + Math.min(card.lapses, 10) * 5
      + (due ? Math.min((now - card.due) / DAY, 30) : 0)
    best.set(card.conceptId, Math.max(best.get(card.conceptId) ?? -Infinity, score))
  }
  return [...best.keys()].sort((a, b) =>
    // Unseen concepts come first. Once exhausted, rotate oldest exposure first.
    (shown.get(a) ?? 0) - (shown.get(b) ?? 0) || best.get(b)! - best.get(a)! || a.localeCompare(b),
  )
}

/** Random unseen word; when exhausted, sample the least recently shown half. */
export function chooseWaitingWord(ids: string[], shown: ReadonlyMap<string, number>, current?: string, random = Math.random): string | undefined {
  const alternatives = ids.filter((id) => id !== current)
  if (!alternatives.length) return ids[0]
  const unseen = alternatives.filter((id) => !shown.has(id))
  const pool = unseen.length ? unseen : [...alternatives]
    .sort((a, b) => (shown.get(a) ?? 0) - (shown.get(b) ?? 0))
    .slice(0, Math.max(1, Math.ceil(alternatives.length / 2)))
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** Count all displayed words and translations; allow 3–6 seconds to read. */
export function waitingWordDuration(text: string): number {
  return Math.min(6000, Math.max(3000, 3000 + (Array.from(text).length - 24) * 45))
}

/** Fit the complete natural card into the available visual viewport. */
export function waitingPopupScale(width: number, height: number, availableWidth: number, availableHeight: number): number {
  return Math.min(1, Math.max(1, availableWidth) / Math.max(1, width), Math.max(1, availableHeight) / Math.max(1, height))
}
