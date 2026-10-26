import assert from 'node:assert/strict'
import { waitingReviewCandidates, chooseWaitingWord, waitingWordDuration, waitingPopupScale } from '../src/lib/waitingReview'
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
  card('new', { reps: 0, state: 0 }), card('easy-mastered-due', { due: now - 1000, stability: 40 }), card('suspended', { suspended: true, due: 0 }),
]
const before = JSON.stringify(cards)
assert.deepEqual(waitingReviewCandidates(cards, now, new Map()), ['relearning', 'due', 'hard-future'])
assert.equal(waitingReviewCandidates(cards, now, new Map([['relearning', 1]]))[0], 'due')
assert.equal(waitingReviewCandidates(cards, now, new Map([['relearning', 4], ['due', 3], ['hard-future', 2], ['new', 1]]))[0], 'hard-future')
assert.equal(waitingReviewCandidates([card('same'), card('same-de', { conceptId: 'same', lang: 'de', difficulty: 9 })], now, new Map()).length, 1)
assert.deepEqual(waitingReviewCandidates([], now, new Map()), [])
assert.equal(JSON.stringify(cards), before, 'passive practice must never mutate the schedule')
console.log('Waiting review: priority, variety, deduplication, easy/suspended exclusion and unchanged schedules pass.')

assert.equal(chooseWaitingWord(['a','b','c'], new Map([['a',1]]), undefined, () => 0), 'b')
assert.equal(chooseWaitingWord(['a','b','c'], new Map([['a',1]]), undefined, () => .99), 'c')
assert.notEqual(chooseWaitingWord(['a','b'], new Map([['a',1],['b',2]]), 'b'), 'b')
assert.equal(chooseWaitingWord(['a'], new Map(), 'a'), 'a')
assert.equal(chooseWaitingWord([], new Map()), undefined)
assert.equal(waitingWordDuration('kort'), 3000)
assert.equal(waitingWordDuration('x'.repeat(1000)), 6000)
assert.ok(waitingWordDuration('x'.repeat(60)) > 3000 && waitingWordDuration('x'.repeat(60)) < 6000)
for (const [w,h] of [[320,568],[390,844],[1440,900],[568,220],[320,150]]) {
  const scale = waitingPopupScale(360, 350, w - 24, h - 24)
  assert.ok(360 * scale <= w - 24 + .01 && 350 * scale <= h - 24 + .01)
}
console.log('Random selection, no immediate repeats, 3–6s timing and viewport fit pass.')
