import type { Card } from '../db/types'

const DAY = 86_400_000

/** Due/relearning first, then difficult upcoming cards; easy future cards stay out. */
export function waitingReviewCandidates(cards: Card[], now: number, shown: ReadonlyMap<string, number>): string[] {
  const best = new Map<string, number>()
  for (const card of cards) {
    if (card.suspended) continue
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
