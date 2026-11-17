import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_BULK,
  defaultsProblems,
  insertPayload,
  leafOptions,
  makeRow,
  pricesFor,
  repriced,
  rowProblems,
  suggestIncrement,
} from './allegroBulk.ts'

const cats = [
  { id: 'e', name: 'Elektronika' },
  { id: 'e-t', name: 'Telefony', parent_id: 'e' },
  { id: 'e-t-s', name: 'Smartfony', parent_id: 'e-t' },
  { id: 'e-t-a', name: 'Akcesoria', parent_id: 'e-t' },
  { id: 'd', name: 'Dom' },
  { id: 'd-k', name: 'Kuchnia', parent_id: 'd' },
]

test('prices: half as the start, the full price as "Kup teraz", tiny prices without it', () => {
  assert.deepEqual(pricesFor(100, 50, true), { start: 50, buyNow: 100 })
  assert.deepEqual(pricesFor(100, 30, false), { start: 30, buyNow: null })
  assert.deepEqual(pricesFor(1, 50, true), { start: 1, buyNow: null })
  assert.deepEqual(pricesFor(undefined, 50, true), { start: 1, buyNow: null })
  assert.equal(pricesFor(100, 500, true).start, 100)
})

test('the bid step grows with the price', () => {
  assert.deepEqual([5, 50, 300, 1000, 5000].map(suggestIncrement), [1, 5, 10, 25, 50])
})

test('leafOptions lists only leaves with their full path, sorted', () => {
  assert.deepEqual(
    leafOptions(cats).map((o) => o.label),
    ['Dom › Kuchnia', 'Elektronika › Telefony › Akcesoria', 'Elektronika › Telefony › Smartfony'],
  )
})

test('makeRow takes texts, prices and the matched category', () => {
  const row = makeRow(
    { id: 'o1', title: 'Smartfon Samsung', description: 'Opis telefonu', price: 400, imageUrls: ['a', 'b'], categoryPath: ['Elektronika', 'Telefony', 'Smartfony'] },
    cats,
    DEFAULT_BULK,
  )
  assert.equal(row.categoryId, 'e-t-s')
  assert.equal(row.guessed, true)
  assert.equal(row.start, '200')
  assert.equal(row.buyNow, '400')
  assert.equal(row.include, true)
})

test('rowProblems names what is missing', () => {
  const leaves = new Set(['e-t-s'])
  const ok = { ...makeRow({ id: 'o', title: 'Smartfon Samsung', description: 'opis opis', price: 40, imageUrls: ['a'], categoryPath: ['Elektronika', 'Telefony', 'Smartfony'] }, cats, DEFAULT_BULK) }
  assert.deepEqual(rowProblems(ok, leaves), [])
  const bad = { ...ok, title: 'ab', categoryId: 'e', imageUrls: [], buyNow: '1', start: '10' }
  assert.deepEqual(rowProblems(bad, leaves), ['tytuł (min. 5 znaków)', 'kategoria', '„Kup teraz” musi być wyższe od ceny startowej', 'zdjęcie (oferta nie ma zdjęć)'])
})

test('defaultsProblems needs a city with a location and a delivery option', () => {
  assert.deepEqual(defaultsProblems(DEFAULT_BULK), ['miasto'])
  assert.deepEqual(defaultsProblems({ ...DEFAULT_BULK, city: 'Kraków' }), ['lokalizacja miasta (wybierz miasto z listy)'])
  assert.deepEqual(defaultsProblems({ ...DEFAULT_BULK, city: 'Kraków', lat: 50, lng: 19 }), [])
  assert.deepEqual(defaultsProblems({ ...DEFAULT_BULK, city: 'Kraków', lat: 50, lng: 19, shipping: [] }), ['dostawa'])
})

test('repriced follows a new share', () => {
  const row = makeRow({ id: 'o', title: 'Aparat Zenit', description: 'opis opis', price: 200, imageUrls: ['a'] }, cats, DEFAULT_BULK)
  const r = repriced(row, { ...DEFAULT_BULK, startPercent: 25, withBuyNow: false })
  assert.equal(r.start, '50')
  assert.equal(r.buyNow, '')
})

test('insertPayload carries the shared settings and ends on the last minute of the day', () => {
  const row = makeRow({ id: 'o', title: 'Aparat Zenit', description: 'opis opis', price: 200, imageUrls: ['a'] }, cats, DEFAULT_BULK)
  const d = { ...DEFAULT_BULK, city: 'Kraków', lat: 50.06, lng: 19.94, shipping: ['odbior', 'inpost'], durationDays: 14 as const }
  const p = insertPayload('u1', { ...row, categoryId: 'd-k' }, d, ['u'], new Date('2026-11-17T10:00:00'))
  assert.equal(p.seller_id, 'u1')
  assert.equal(p.category_id, 'd-k')
  assert.equal(p.starting_price, 100)
  assert.equal(p.current_price, 100)
  assert.equal(p.bid_increment, 10)
  assert.equal(p.buy_now_price, 200)
  assert.equal(p.city, 'Kraków')
  assert.deepEqual(p.shipping_options, ['odbior', 'inpost'])
  assert.equal(p.duration_days, 14)
  assert.equal(new Date(p.ends_at as string).getDate(), 1)
  assert.equal(new Date(p.ends_at as string).getHours(), 23)
})
