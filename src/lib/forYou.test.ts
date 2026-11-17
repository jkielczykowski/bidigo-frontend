import test from 'node:test'
import assert from 'node:assert/strict'
import { composeForYou, forYouTitle, forYouView, mergeUnique, FOR_YOU_SIZE, type FyAuction } from './forYou.ts'

const H = 3600_000
const mk = (id: string, cat: string | null, endsInH: number, extra: Partial<FyAuction> = {}): FyAuction => ({
  id,
  seller_id: 'seller',
  category_id: cat,
  bid_count: 0,
  watch_count: 0,
  ends_at: new Date(1_800_000_000_000 + endsInH * H).toISOString(),
  created_at: new Date(1_790_000_000_000 - endsInH * H).toISOString(),
  ...extra,
})
const ids = (xs: FyAuction[]) => xs.map((a) => a.id)

test('mergeUnique: bez duplikatów, w kolejności źródeł, do limitu', () => {
  const a = mk('a', 'x', 1), b = mk('b', 'x', 2), c = mk('c', 'x', 3)
  assert.deepEqual(ids(mergeUnique([[a, b], [b, c], [a]], 10)), ['a', 'b', 'c'])
  assert.deepEqual(ids(mergeUnique([[a, b], [c]], 2)), ['a', 'b'])
  assert.deepEqual(mergeUnique([], 5), [])
})

test('użytkownik bez historii: popularne, potem kończące się, potem reszta — zawsze coś, gdy są aukcje', () => {
  const pool = [mk('nowa', 'a', 50), mk('konczy', 'a', 1), mk('hit', 'b', 30, { bid_count: 7 }), mk('obs', 'b', 20, { watch_count: 2 })]
  const { items } = composeForYou(pool, { viewedIds: [], userId: null })
  assert.deepEqual(ids(items), ['hit', 'obs', 'konczy', 'nowa'])
})

test('z historią: aukcje z kategorii oglądanych (bez oglądanej i własnych) idą pierwsze', () => {
  const pool = [
    mk('ogladana', 'rowery', 5),
    mk('rower2', 'rowery', 9),
    mk('rower3', 'rowery', 4),
    mk('moj-rower', 'rowery', 2, { seller_id: 'ja' }),
    mk('hit', 'lego', 1, { bid_count: 9 }),
  ]
  const { items, tiers } = composeForYou(pool, { viewedIds: ['ogladana'], userId: 'ja' })
  assert.deepEqual(ids(items).slice(0, 3), ['rower3', 'rower2', 'hit'])
  assert.equal(tiers['rower3'], 'similar')
  assert.equal(tiers['hit'], 'popular')
  // oglądana i własna dopiero na końcu (ostateczność), nie na początku
  assert.deepEqual(ids(items).slice(3), ['ogladana', 'moj-rower'])
})

test('kategorie rodzeństwa: ta sama kategoria nadrzędna liczy się jako podobna', () => {
  const pool = [mk('v', 'rower-gorski', 3), mk('sib', 'rower-miejski', 8), mk('inne', 'lego', 1)]
  const { items } = composeForYou(pool, { viewedIds: ['v'], userId: null, parentOf: { 'rower-gorski': 'rowery', 'rower-miejski': 'rowery' } })
  assert.equal(items[0].id, 'sib')
})

test('ulubione kategorie wchodzą przed popularnymi', () => {
  const pool = [mk('hit', 'lego', 1, { bid_count: 9 }), mk('fav', 'ksiazki', 40)]
  const { items } = composeForYou(pool, { viewedIds: [], userId: 'ja', favoriteCategoryIds: ['ksiazki'] })
  assert.deepEqual(ids(items), ['fav', 'hit'])
})

test('limit i brak duplikatów przy dużej puli', () => {
  const pool = Array.from({ length: 40 }, (_, i) => mk(`a${i}`, i % 3 ? 'x' : null, i, { bid_count: i % 5 }))
  const { items } = composeForYou(pool, { viewedIds: ['a0', 'a1'], userId: null })
  assert.equal(items.length, FOR_YOU_SIZE)
  assert.equal(new Set(ids(items)).size, items.length)
  assert.equal(composeForYou(pool, { viewedIds: [], userId: null, limit: 5 }).items.length, 5)
})

test('jedyne aukcje to własne i oglądane: sekcja nadal niepusta; pusta pula = pusta lista', () => {
  const only = [mk('moja', 'x', 1, { seller_id: 'ja' }), mk('ogl', 'x', 2)]
  assert.deepEqual(ids(composeForYou(only, { viewedIds: ['ogl'], userId: 'ja' }).items), ['ogl', 'moja'])
  assert.deepEqual(composeForYou([], { viewedIds: ['x'], userId: 'ja' }).items, [])
})

test('forYouView: nigdy pusty nagłówek — karty, szkielet, błąd albo zachęta', () => {
  assert.equal(forYouView({ loading: true, error: false, count: 0 }), 'loading')
  assert.equal(forYouView({ loading: false, error: true, count: 0 }), 'error')
  assert.equal(forYouView({ loading: false, error: false, count: 0 }), 'empty')
  assert.equal(forYouView({ loading: false, error: false, count: 3 }), 'items')
  assert.equal(forYouView({ loading: true, error: true, count: 3 }), 'items')
})

test('forYouTitle', () => {
  assert.equal(forYouTitle(true, true), 'Polecane na podstawie oglądanych')
  assert.equal(forYouTitle(false, true), 'Polecane dla Ciebie')
  assert.equal(forYouTitle(false, false), 'Popularne i kończące się')
})
