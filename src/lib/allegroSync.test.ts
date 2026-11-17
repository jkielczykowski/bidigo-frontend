import test from 'node:test'
import assert from 'node:assert/strict'
import { importedTexts, planSync, type LinkedListing } from './allegroSync.ts'

const L = (o: Partial<LinkedListing> & { auctionId: string; offerId: string }): LinkedListing => ({
  title: 'Aparat',
  description: 'Sprawny aparat',
  status: 'active',
  bidCount: 0,
  ...o,
})
const same = new Map([['o1', { title: 'Aparat', description: 'Sprawny aparat' }]])

test('importedTexts cuts the title, falls back to the title for an empty description', () => {
  assert.equal(importedTexts({ title: 'x'.repeat(200), description: 'd' }).title.length, 120)
  assert.equal(importedTexts({ title: 'Aparat', description: '  ' }).description, 'Aparat')
  assert.equal(importedTexts({ title: 'A', description: 'y'.repeat(5000) }).description.length, 4000)
})

test('an unchanged offer needs nothing, whitespace differences do not count', () => {
  const p = planSync([L({ auctionId: 'a1', offerId: 'o1', description: 'Sprawny   aparat ' })], new Set(['o1']), true, same)
  assert.deepEqual(p, { update: [], cancel: [], locked: [] })
})

test('a changed title or description is an update, with the new text', () => {
  const texts = new Map([['o1', { title: 'Aparat Zenit', description: 'Nowy opis' }]])
  const p = planSync([L({ auctionId: 'a1', offerId: 'o1' })], new Set(['o1']), true, texts)
  assert.deepEqual(p.update, [{ auctionId: 'a1', title: 'Aparat Zenit', oldTitle: 'Aparat', description: 'Nowy opis' }])
})

test('an offer gone from Allegro cancels the listing', () => {
  const p = planSync([L({ auctionId: 'a1', offerId: 'o9' })], new Set(['o1']), true, same)
  assert.deepEqual(p.cancel, [{ auctionId: 'a1', title: 'Aparat' }])
})

test('an incomplete offer list never cancels anything', () => {
  const p = planSync([L({ auctionId: 'a1', offerId: 'o9' })], new Set(['o1']), false, same)
  assert.deepEqual(p, { update: [], cancel: [], locked: [] })
})

test('a listing with bids is only reported, never updated or cancelled', () => {
  const texts = new Map([['o1', { title: 'Zmiana', description: 'x' }]])
  const p = planSync(
    [L({ auctionId: 'a1', offerId: 'o1', bidCount: 2 }), L({ auctionId: 'a2', offerId: 'o9', bidCount: 1 })],
    new Set(['o1']),
    true,
    texts,
  )
  assert.deepEqual(p.update, [])
  assert.deepEqual(p.cancel, [])
  assert.deepEqual(p.locked, [
    { auctionId: 'a1', title: 'Aparat', gone: false },
    { auctionId: 'a2', title: 'Aparat', gone: true },
  ])
})

test('ended or cancelled listings are ignored', () => {
  const p = planSync([L({ auctionId: 'a1', offerId: 'o9', status: 'sold' })], new Set(), true, new Map())
  assert.deepEqual(p, { update: [], cancel: [], locked: [] })
})
