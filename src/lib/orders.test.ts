import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NOT_ELIGIBLE_TEXT,
  costLines,
  parcelColumns,
  parcelInputFrom,
  quoteMessage,
  statusLabel,
  statusTone,
  visibleActions,
} from './ordersLogic.ts'

const empty = { locker: '', kind: '', length: '', width: '', height: '', weight: '', shippingPrice: '' } as const

test('the required sentence is shown for an item that does not qualify, only when the service is available', () => {
  assert.equal(quoteMessage({ eligible: false, reason: 'not_inpost', notEligibleText: NOT_ELIGIBLE_TEXT }), NOT_ELIGIBLE_TEXT)
  assert.equal(NOT_ELIGIBLE_TEXT, 'Ochrona Kupującego jest dostępna dla przedmiotów wysyłanych Paczkomatem InPost. Ten przedmiot nie kwalifikuje się do tej usługi.')
  // service off / not configured: the backend sends no text and we say nothing
  assert.equal(quoteMessage({ eligible: false, reason: 'protection_disabled', notEligibleText: null }), null)
  assert.equal(quoteMessage({ eligible: true, reason: null, notEligibleText: null }), null)
})

test('cost summary lists item + delivery + protection and agrees with the server total', () => {
  const c = costLines({ itemPrice: 100, shippingPrice: 12.99, protectionFee: 5, total: 117.99 })
  assert.deepEqual(c.lines.map((l) => l.key), ['item', 'shipping', 'protection'])
  assert.equal(c.total, 117.99)
  assert.equal(c.consistent, true)
  assert.equal(costLines({ itemPrice: 100, shippingPrice: 12.99, protectionFee: 5, total: 120 }).consistent, false)
  // 0.1 + 0.2 style float sums stay on the grosz
  assert.equal(costLines({ itemPrice: 0.1, shippingPrice: 0.2, protectionFee: 0, total: null }).total, 0.3)
})

test('"no" and unanswered need no dimensions; "yes" needs all of them and a shipping price', () => {
  assert.deepEqual(parcelColumns({ ...empty, locker: 'no' }).errors, {})
  assert.equal(parcelColumns({ ...empty, locker: 'no' }).columns.inpost_locker_ok, false)
  assert.equal(parcelColumns({ ...empty, locker: '' }).columns.inpost_locker_ok, null)
  const missing = parcelColumns({ ...empty, locker: 'yes' })
  assert.deepEqual(Object.keys(missing.errors).sort(), ['height', 'length', 'shippingPrice', 'weight', 'width'])
  const ok = parcelColumns({ locker: 'yes', kind: ' ubrania ', length: '30,5', width: '20', height: '5', weight: '0.8', shippingPrice: '0' })
  assert.deepEqual(ok.errors, {})
  assert.deepEqual(ok.columns, {
    inpost_locker_ok: true, parcel_kind: 'ubrania', parcel_length_cm: 30.5, parcel_width_cm: 20, parcel_height_cm: 5,
    parcel_weight_kg: 0.8, locker_shipping_price: 0,
  })
})

test('a "no" answer clears earlier parcel data so a stale size cannot qualify the item', () => {
  const c = parcelColumns({ locker: 'no', kind: 'x', length: '10', width: '10', height: '10', weight: '1', shippingPrice: '9' }).columns
  assert.equal(c.parcel_length_cm, null)
  assert.equal(c.locker_shipping_price, null)
})

test('invalid numbers are rejected; the limits themselves are the backend\'s business', () => {
  const bad = parcelColumns({ locker: 'yes', kind: '', length: '-1', width: 'abc', height: '0', weight: '1', shippingPrice: '-3' })
  assert.deepEqual(Object.keys(bad.errors).sort(), ['height', 'length', 'shippingPrice', 'width'])
  // a huge parcel passes validation here — whether it fits InPost is decided server-side from configured limits
  assert.deepEqual(parcelColumns({ locker: 'yes', kind: '', length: '500', width: '500', height: '500', weight: '500', shippingPrice: '1' }).errors, {})
})

test('round trip of stored columns into the form', () => {
  const input = parcelInputFrom({ inpost_locker_ok: true, parcel_length_cm: 30, parcel_width_cm: 20, parcel_height_cm: 5, parcel_weight_kg: 1.2, locker_shipping_price: 12.99, parcel_kind: 'książki' })
  assert.deepEqual(input, { locker: 'yes', kind: 'książki', length: '30', width: '20', height: '5', weight: '1.2', shippingPrice: '12.99' })
  assert.equal(parcelInputFrom(null).locker, '')
})

test('every status has a Polish label; direct sales say "ustal ze sprzedawcą"', () => {
  assert.equal(statusLabel('AWAITING_PAYMENT'), 'Czeka na płatność')
  assert.equal(statusLabel('AWAITING_SHIPMENT', 'direct'), 'Do ustalenia ze sprzedawcą')
  assert.equal(statusLabel('AWAITING_SHIPMENT', 'protected'), 'Czeka na wysyłkę')
  assert.equal(statusTone('COMPLETED'), 'ok')
  assert.equal(statusTone('DISPUTED'), 'warn')
})

test('only the actions the server allows are shown, in a stable order', () => {
  assert.deepEqual(visibleActions({ actions: ['cancel', 'pay', 'choose_direct'] }), ['pay', 'choose_direct', 'cancel'])
  assert.deepEqual(visibleActions({ actions: [] }), [])
})
