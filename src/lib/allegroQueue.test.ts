import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { readImportQueue, suggestPrices, writeImportQueue } from './allegroQueue.ts'

const store = new Map<string, string>()
;(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}

describe('suggestPrices', () => {
  it('starts at half of the Allegro price and offers the price as "Kup teraz"', () => {
    assert.deepEqual(suggestPrices(199), { start: 99, buyNow: 199 })
    assert.deepEqual(suggestPrices(40.4), { start: 20, buyNow: 40 })
  })
  it('never starts below 1 zł and drops "Kup teraz" when it would not exceed the start', () => {
    assert.deepEqual(suggestPrices(1), { start: 1, buyNow: null })
    assert.deepEqual(suggestPrices(2), { start: 1, buyNow: 2 })
    assert.deepEqual(suggestPrices(undefined), { start: 1, buyNow: null })
  })
})

describe('import queue', () => {
  beforeEach(() => store.clear())
  it('round-trips and ends when every offer is done', () => {
    writeImportQueue({ ids: ['a', 'b'], pos: 1 })
    assert.deepEqual(readImportQueue(), { ids: ['a', 'b'], pos: 1 })
    writeImportQueue({ ids: ['a', 'b'], pos: 2 })
    assert.equal(readImportQueue(), null)
  })
  it('survives garbage in storage', () => {
    store.set('bidigo.allegroImport', '{nope')
    assert.equal(readImportQueue(), null)
  })
})
