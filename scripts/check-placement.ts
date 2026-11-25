import assert from 'node:assert/strict'
import { PLACEMENT, PLACEMENT_LANGS, scorePlacement } from '../src/academy/placementQuestions'

for (const lang of PLACEMENT_LANGS) {
  const qs = PLACEMENT[lang]
  assert.equal(qs.length, 12, `${lang}: twelve questions`)
  for (const level of ['A1', 'A2', 'B1', 'B2'] as const) assert.equal(qs.filter(q => q.level === level).length, 3, `${lang} ${level}: three questions`)
  for (const q of qs) {
    assert.equal(q.options.length, 4)
    assert.equal(new Set(q.options).size, 4, `${lang}: options must differ: ${q.q}`)
    assert.ok(q.answer >= 0 && q.answer < 4)
    assert.ok(q.q.includes('___'), `${lang}: a gap is marked: ${q.q}`)
  }
  const right = qs.map(q => q.answer)
  assert.deepEqual(scorePlacement(lang, right), { level: 'B2', correct: 12, total: 12 })
  assert.equal(scorePlacement(lang, qs.map(() => null)).level, 'A1')
  assert.equal(scorePlacement(lang, qs.map(q => (q.answer + 1) % 4)).correct, 0)
  // a strong A1, A2 and one B1 answer is A2; a gap at A1 stops the climb even if later steps are right
  const partial = qs.map((q, i) => (i < 6 ? q.answer : i === 6 ? q.answer : null))
  assert.equal(scorePlacement(lang, partial).level, 'A2')
  const gap = qs.map((q, i) => (q.level === 'A1' && i === 0 ? null : q.answer))
  assert.equal(scorePlacement(lang, gap).level, 'B2', 'two of three at a step is enough')
  const bad = qs.map((q, i) => (q.level === 'A1' ? null : q.answer))
  assert.equal(scorePlacement(lang, bad).level, 'A1', 'failing A1 keeps the estimate at A1')
}
console.log('Placement: 12 questions per language, valid options, scoring thresholds and climb rule pass.')
