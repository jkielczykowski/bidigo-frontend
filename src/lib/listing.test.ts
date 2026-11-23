import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conditionLabel, localBidIncrement, needsLocation, parseSuggestions, pickupAllowedFor } from './listing.ts'

test('conditionLabel', () => {
  assert.equal(conditionLabel('like_new'), 'Jak nowy')
  assert.equal(conditionLabel('for_parts'), 'Na części lub uszkodzony')
  assert.equal(conditionLabel(null), null)
  assert.equal(conditionLabel('xx'), null)
})

test('pickupAllowedFor dziedziczy po rodzicu, domyślnie dozwolone', () => {
  const cats = [
    { id: 'a', parent_id: null, pickup_allowed: false },
    { id: 'b', parent_id: 'a', pickup_allowed: null },
    { id: 'c', parent_id: 'a', pickup_allowed: true },
    { id: 'd', parent_id: null },
  ]
  assert.equal(pickupAllowedFor(cats, 'b'), false)
  assert.equal(pickupAllowedFor(cats, 'c'), true)
  assert.equal(pickupAllowedFor(cats, 'd'), true)
  assert.equal(pickupAllowedFor(cats, ''), true)
  assert.equal(pickupAllowedFor(cats, 'nieznana'), true)
})

test('pickupAllowedFor nie zapętla się przy cyklu', () => {
  const cats = [
    { id: 'a', parent_id: 'b' },
    { id: 'b', parent_id: 'a' },
  ]
  assert.equal(pickupAllowedFor(cats, 'a'), true)
})

test('needsLocation tylko przy odbiorze', () => {
  assert.equal(needsLocation(['odbior', 'kurier']), true)
  assert.equal(needsLocation(['kurier', 'inpost']), false)
  assert.equal(needsLocation([]), false)
})

test('parseSuggestions', () => {
  const r = parseSuggestions(
    [
      { id: '1', name: 'A', path: 'X > A', score: 1 },
      { id: '2', name: 'B', score: 5 },
      { name: 'zły' },
      { id: '3', name: 'C', path: 'C', score: 3 },
      { id: '4', name: 'D', path: 'D', score: 2 },
    ],
    3,
  )
  assert.deepEqual(r.map((s) => s.id), ['2', '3', '4'])
  assert.equal(r[0].path, 'B')
  assert.deepEqual(parseSuggestions(null), [])
})

test('localBidIncrement: ~1%, zaokrąglone, 1–50 zł', () => {
  assert.equal(localBidIncrement(0), 1)
  assert.equal(localBidIncrement(50), 1)
  assert.equal(localBidIncrement(200), 2)
  assert.equal(localBidIncrement(500), 5)
  assert.equal(localBidIncrement(1000), 10)
  assert.equal(localBidIncrement(100000), 50)
})
