import test from 'node:test'
import assert from 'node:assert/strict'
import { PAYU_WAIT_MS, PAY_MESSAGES, orderPayState, returnedFromPayu, shipmentPayState } from './payuReturn.ts'

test('powrót z PayU rozpoznajemy po ?payment=payu, stary ?paid=1 nic nie znaczy', () => {
  assert.equal(returnedFromPayu(new URLSearchParams('payment=payu')), true)
  assert.equal(returnedFromPayu(new URLSearchParams('paid=1')), false)
  assert.equal(returnedFromPayu(new URLSearchParams('')), false)
})

test('zamówienie: oczekuje, udana i nieudana płatność', () => {
  assert.equal(orderPayState('PAYMENT_PROCESSING'), 'pending')
  assert.equal(orderPayState('AWAITING_PAYMENT'), 'failed') // serwer cofnął zamówienie po CANCELED
  assert.equal(orderPayState('CANCELLED'), 'failed')
  for (const s of ['PAID', 'AWAITING_SHIPMENT', 'SHIPPED', 'DELIVERED', 'COMPLETED']) assert.equal(orderPayState(s), 'paid', s)
})

test('dostawa: czeka na PayU z żywym linkiem, potem proponuje ponowną próbę; bez linku = nieudana', () => {
  assert.equal(shipmentPayState('AWAITING_SHIPPING_PAYMENT', true, 0), 'pending')
  assert.equal(shipmentPayState('AWAITING_SHIPPING_PAYMENT', true, PAYU_WAIT_MS - 1), 'pending')
  assert.equal(shipmentPayState('AWAITING_SHIPPING_PAYMENT', true, PAYU_WAIT_MS), 'failed')
  assert.equal(shipmentPayState('AWAITING_SHIPPING_PAYMENT', false, 0), 'failed')
  assert.equal(shipmentPayState('SHIPPING_PAID', false, 0), 'paid')
  assert.equal(shipmentPayState('LABEL_READY', false, 0), 'paid')
  assert.equal(shipmentPayState('CANCELLED', false, 0), 'failed')
})

test('komunikaty są po polsku, wspominają PayU i nie obiecują pieniędzy przed potwierdzeniem', () => {
  for (const k of ['pending', 'paid', 'failed'] as const) assert.match(PAY_MESSAGES[k].title + PAY_MESSAGES[k].body, /PayU|płatno/i)
  assert.match(PAY_MESSAGES.pending.body, /Nic nie zostanie wysłane/)
  assert.doesNotMatch(JSON.stringify(PAY_MESSAGES), /Stripe/)
})
