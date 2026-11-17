import test from 'node:test'
import assert from 'node:assert/strict'
import { judgePoint, pointAddressLine, pointFromCode, pointFromGeowidget } from './shippingModel.ts'
// @ts-expect-error plain ESM served as a static file of the map frame
import { cropHeight, parsePlaces, pointKind, zoomFor, HOSTS } from '../../public/locker-frame/lib.js'

const LOCKER = {
  name: 'WAW221AP',
  type: ['parcel_locker'],
  location_description: 'Przy Biedronce',
  opening_hours: '24/7',
  address_details: { street: 'Długa', building_number: '5', city: 'Warszawa', post_code: '00-001' },
}

test('a parcel locker from the map becomes the point sent to the backend (code format unchanged)', () => {
  const j = judgePoint(LOCKER)
  assert.ok(j.ok)
  if (j.ok) {
    assert.equal(j.point.code, 'WAW221AP')
    assert.equal(j.point.name, 'Przy Biedronce')
    assert.equal(j.point.hours, '24/7')
    assert.equal(pointAddressLine(j.point), 'Długa 5, 00-001 Warszawa')
  }
})

test('a PaczkoPunkt is refused with its own reason, rubbish is invalid', () => {
  assert.deepEqual(judgePoint({ ...LOCKER, type: ['pop'] }), { ok: false, reason: 'not_locker' })
  assert.deepEqual(judgePoint({ ...LOCKER, name: 'nie-kod' }), { ok: false, reason: 'invalid' })
  assert.deepEqual(judgePoint(null), { ok: false, reason: 'invalid' })
  assert.deepEqual(judgePoint({}), { ok: false, reason: 'invalid' })
  assert.ok(judgePoint({ name: 'KRA010M' }).ok) // no type given: accepted like FluffyTag does
})

test('a typed code is checked the same way and gives a point with only the code known', () => {
  assert.deepEqual(pointFromCode(' kra010m '), { code: 'KRA010M', name: 'KRA010M', address: '', city: '', postCode: '' })
  assert.equal(pointFromCode('Kraków'), null)
  assert.equal(pointFromCode(''), null)
})

test('the point has no hours key when the map gave none; address falls back to line1/line2', () => {
  const p = pointFromGeowidget({ name: 'KRA010M', address: { line1: 'Rynek 1', line2: '31-000 Kraków' } })
  assert.equal('hours' in p, false)
  assert.equal(p.address, 'Rynek 1')
  assert.equal(p.city, '31-000 Kraków')
})

test('frame: the same decisions as the page about what may be chosen', () => {
  assert.equal(pointKind(LOCKER), 'locker')
  assert.equal(pointKind({ ...LOCKER, type: ['pop'] }), 'not_locker')
  assert.equal(pointKind({ name: 'x' }), 'invalid')
  assert.equal(pointKind(undefined), 'invalid')
})

test('frame: the native header is cropped by a width-dependent height', () => {
  assert.equal(cropHeight(600), 182)
  assert.equal(cropHeight(400), 213)
  assert.equal(cropHeight(300), 237)
})

test('frame: places from the city proxy become suggestions (max 8, no duplicates, no broken rows)', () => {
  const places = [
    { name: 'Kraków', displayName: 'Kraków, Małopolskie', lat: 50.06, lng: 19.94 },
    { name: 'Kraków', displayName: 'Kraków, Małopolskie', lat: 50.06, lng: 19.94 },
    { name: '', lat: 1, lng: 1 },
    { name: 'Bez współrzędnych' },
    { name: 'Wieś', displayName: 'Wieś', lat: 51, lng: 20, kind: 'village' },
  ]
  const out = parsePlaces({ places })
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { label: 'Kraków', detail: 'Małopolskie', lat: 50.06, lng: 19.94, zoom: 13 })
  assert.equal(out[1].zoom, 14)
  assert.equal(parsePlaces({ places: Array.from({ length: 20 }, (_, i) => ({ name: 'M' + i, lat: 1, lng: 1 })) }).length, 8)
  assert.deepEqual(parsePlaces(null), [])
  assert.equal(zoomFor('city'), 13)
})

test('frame: the map hosts are InPost\'s (sandbox and production), nothing from the URL', () => {
  assert.equal(HOSTS.production, 'https://geowidget.inpost.pl')
  assert.match(HOSTS.sandbox, /^https:\/\/sandbox-easy-geowidget-sdk\.easypack24\.net$/)
})
