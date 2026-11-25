import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import type { WeekSlot } from '../src/academy/AcademyWeekPicker'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// The app is built with the automatic JSX runtime; under plain tsx the classic one needs React in scope.
;(globalThis as { React?: unknown }).React = React
const { AcademyWeekPicker } = await import('../src/academy/AcademyWeekPicker')

// Slots two days from now, so they fall in the current or the next week view.
const base = new Date()
base.setDate(base.getDate() + 2)
base.setHours(10, 0, 0, 0)
const at = (h: number) => {
  const d = new Date(base)
  d.setHours(h)
  return d.toISOString()
}
const slots: WeekSlot[] = [
  { id: 'a', status: 'free', starts_at: at(10), ends_at: at(11) },
  { id: 'b', status: 'free', starts_at: at(12), ends_at: at(13) },
  { id: 'c', status: 'free', starts_at: at(14), ends_at: at(15) },
  { id: 'd', status: 'free', starts_at: at(16), ends_at: at(17) },
  { id: 'busy', status: 'busy', starts_at: at(18), ends_at: at(19) }
]

async function render(props: Partial<React.ComponentProps<typeof AcademyWeekPicker>>) {
  let tree!: TestRenderer.ReactTestRenderer
  await act(async () => {
    tree = TestRenderer.create(<AcademyWeekPicker locale="en" slots={slots} {...props} />)
  })
  return tree
}
const blocks = (tree: TestRenderer.ReactTestRenderer) => tree.root.findAll(n => typeof n.props.className === 'string' && n.props.className.includes('ac-week-block') && n.type === 'button')
const sameWeekOrNext = async (props: Partial<React.ComponentProps<typeof AcademyWeekPicker>>) => {
  let tree = await render(props)
  if (blocks(tree).length === 0 && tree.root.findAll(n => n.props.className === 'ac-week-block busy').length === 0) {
    // the slots fell into next week: move forward once
    const next = tree.root.findAllByType('button').filter(b => (b.props.className ?? '').includes('ac-btn')).pop()!
    await act(async () => next.props.onClick())
  }
  return tree
}

const picked: string[] = []
let tree = await sameWeekOrNext({ selected: picked, max: 3, onToggle: s => picked.push(s.id) })
assert.equal(blocks(tree).length, 4, 'four free slots are tappable buttons')
assert.equal(tree.root.findAll(n => n.props.className === 'ac-week-block busy').length, 1, 'busy slot is shown but not a button')
await act(async () => blocks(tree)[0].props.onClick())
assert.deepEqual(picked, ['a'])

// at the limit, unselected free slots are disabled; selected ones stay enabled
tree = await sameWeekOrNext({ selected: ['a', 'b', 'c'], max: 3, onToggle: () => {} })
const states = Object.fromEntries(blocks(tree).map(b => [b.props['aria-label'].slice(-12), b.props.disabled]))
assert.equal(blocks(tree).filter(b => b.props.disabled).length, 1, 'only the unselected fourth slot is disabled')
assert.equal(blocks(tree).filter(b => b.props['aria-pressed']).length, 3)
void states

// read-only view: no tappable slots at all
tree = await sameWeekOrNext({ readOnly: true })
assert.equal(blocks(tree).length, 0, 'read-only shows blocks without buttons')

// past slots are never shown
tree = await render({ slots: [{ id: 'old', status: 'free', starts_at: new Date(Date.now() - 86400000 * 3).toISOString(), ends_at: new Date(Date.now() - 86400000 * 3 + 3600000).toISOString() }] })
assert.equal(blocks(tree).length, 0)
console.log('Week picker: tappable free slots, busy shown grey, selection limit, read-only mode and past slots hidden pass.')
process.exit(0)
