import assert from 'node:assert/strict'
import { waitingReviewCandidates } from '../src/lib/waitingReview'
import type { Card } from '../src/db/types'

const now = Date.now()
function card(id: string, patch: Partial<Card> = {}): Card {
  return { id, conceptId: id, lang: 'sv', due: now + 86400000, stability: 20,
    difficulty: 2, elapsedDays: 1, scheduledDays: 20, learningSteps: 0,
    reps: 10, lapses: 0, state: 2, updatedAt: now, ...patch }
}
const cards = [
  card('easy-future'), card('hard-future', { difficulty: 8 }),
  card('due', { due: now - 1000 }), card('relearning', { state: 3, due: now }),
  card('new', { reps: 0, state: 0 }), card('suspended', { suspended: true, due: 0 }),
]
const before = JSON.stringify(cards)
assert.deepEqual(waitingReviewCandidates(cards, now, new Map()), ['relearning', 'due', 'hard-future', 'new'])
assert.equal(waitingReviewCandidates(cards, now, new Map([['relearning', 1]]))[0], 'due')
assert.equal(waitingReviewCandidates(cards, now, new Map([['relearning', 4], ['due', 3], ['hard-future', 2], ['new', 1]]))[0], 'new')
assert.equal(waitingReviewCandidates([card('same'), card('same-de', { conceptId: 'same', lang: 'de', difficulty: 9 })], now, new Map()).length, 1)
assert.deepEqual(waitingReviewCandidates([], now, new Map()), [])
assert.equal(JSON.stringify(cards), before, 'passive practice must never mutate the schedule')
console.log('Waiting review: priority, variety, deduplication, easy/suspended exclusion and unchanged schedules pass.')
