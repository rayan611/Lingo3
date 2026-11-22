import assert from 'node:assert/strict'
import { LANGS } from '../src/db/langs'
import { TRAINING_LABELS } from '../src/ui/trainingLabels'
for (const lang of LANGS) {
  const labels = TRAINING_LABELS[lang]
  assert.ok(labels, `Missing Training Center locale: ${lang}`)
  for (const key of ['home','title','choose','activities','academy','academyDetail'] as const)
    assert.ok(labels[key].trim(), `Missing ${lang}.${key}`)
  assert.equal(labels.titles.length, 4)
  assert.equal(labels.details.length, 4)
  assert.ok([...labels.titles, ...labels.details].every(value => value.trim()))
}
console.log('PASS: Training Center labels cover all eight native languages')
