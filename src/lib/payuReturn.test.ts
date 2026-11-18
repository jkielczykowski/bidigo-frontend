import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldRefreshPayment, PAYU_WAIT_MS, PAY_MESSAGES, orderPayState, returnedFromPayu, sellerPayuMessage, shipmentPayState } from './payuReturn.ts'

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

test('sprzedający: „konto PayU do połączenia”, dopóki nie ma zweryfikowanego konta i umowy marketplace', () => {
  assert.equal(sellerPayuMessage({ status: 'verified', marketplaceReady: true }), null)
  assert.match(sellerPayuMessage({ status: 'not_connected', marketplaceReady: true })!.title, /Konto PayU do połączenia/)
  assert.match(sellerPayuMessage({ status: 'pending', marketplaceReady: true })!.title, /weryfikacji/)
  assert.match(sellerPayuMessage({ status: 'rejected', marketplaceReady: true })!.title, /odrzucone/)
  assert.match(sellerPayuMessage({ status: 'locked', marketplaceReady: true })!.title, /zablokowane/)
  // bez umowy marketplace nawet zweryfikowany sprzedający nie sprzedaje z Ochroną
  assert.match(sellerPayuMessage({ status: 'verified', marketplaceReady: false })!.title, /niedostępna/)
  assert.match(sellerPayuMessage({ status: 'not_connected', marketplaceReady: true })!.body, /nie do Bidigo/)
})

test('after the return from PayU the page asks the server to read the payment only while the order still waits and after ~20 s', () => {
  assert.equal(shouldRefreshPayment('PAYMENT_PROCESSING', 5_000), false)
  assert.equal(shouldRefreshPayment('PAYMENT_PROCESSING', 20_000), true)
  assert.equal(shouldRefreshPayment('AWAITING_PAYMENT', 45_000), true)
  assert.equal(shouldRefreshPayment('PAID', 45_000), false)
  assert.equal(shouldRefreshPayment('CANCELLED', 45_000), false)
})
