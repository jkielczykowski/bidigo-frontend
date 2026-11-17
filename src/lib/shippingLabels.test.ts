import test from 'node:test'
import assert from 'node:assert/strict'
import { shippingLabels } from './format.ts'

test('shipping codes become Polish labels, unknown ones are dropped, empty means "do uzgodnienia"', () => {
  assert.equal(shippingLabels(['odbior', 'kurier']), 'odbiór osobisty, kurier')
  assert.equal(shippingLabels(['inpost']), 'InPost')
  assert.equal(shippingLabels(['xyz']), 'do uzgodnienia')
  assert.equal(shippingLabels([]), 'do uzgodnienia')
  assert.equal(shippingLabels(null), 'do uzgodnienia')
})
