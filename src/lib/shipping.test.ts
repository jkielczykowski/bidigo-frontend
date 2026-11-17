import test from 'node:test'
import assert from 'node:assert/strict'
import { formatGrosz, nextAction, normaliseLocker, normalisePhone, pointFromGeowidget, progressStep } from './shippingModel.ts'

test('locker codes: case and spaces do not matter, rubbish is refused', () => {
  assert.equal(normaliseLocker(' kra010m '), 'KRA010M')
  assert.equal(normaliseLocker('WAW123BM'), 'WAW123BM')
  assert.equal(normaliseLocker('pop-kra12'), 'POP-KRA12')
  assert.equal(normaliseLocker('Kraków'), null)
  assert.equal(normaliseLocker(''), null)
})

test('phone: 9 digits with optional +48', () => {
  assert.equal(normalisePhone('+48 600-100-200'), '600100200')
  assert.equal(normalisePhone('600100200'), '600100200')
  assert.equal(normalisePhone('12345'), null)
  assert.equal(normalisePhone('+49 600100200'), null)
})

test('price from grosze in zloty', () => {
  assert.match(formatGrosz(1199), /11,99/)
})

test('geowidget point becomes a picker point', () => {
  const p = pointFromGeowidget({
    name: 'KRA010M',
    location_description: 'Przy Biedronce',
    address_details: { street: 'Długa', building_number: '5', city: 'Kraków', post_code: '31-001' },
  })
  assert.deepEqual(p, { code: 'KRA010M', name: 'Przy Biedronce', address: 'Długa 5', city: 'Kraków', postCode: '31-001' })
})

test('progress follows the happy path and is -1 for failed or cancelled', () => {
  assert.equal(progressStep('AWAITING_SHIPPING_PAYMENT'), 0)
  assert.equal(progressStep('LABEL_GENERATING'), 1)
  assert.equal(progressStep('IN_TRANSIT'), 4)
  assert.equal(progressStep('DELIVERED'), 5)
  assert.equal(progressStep('SHIPPING_FAILED'), -1)
  assert.equal(progressStep('CANCELLED'), -1)
})

test('the seller is told to download the label, the buyer to pay', () => {
  assert.match(nextAction({ status: 'LABEL_READY', role: 'seller', labelAvailable: true }), /Pobierz etykietę/)
  assert.match(nextAction({ status: 'AWAITING_SHIPPING_PAYMENT', role: 'buyer', labelAvailable: false }), /Opłać dostawę/)
})
