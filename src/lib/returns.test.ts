import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RETURN_COST_NOTICE, RETURN_REASONS, buyerCanDownloadLabel, canRequestReturn, isActiveReturn, listReturnLabel,
  returnDeadlineText, returnStatusLabel, returnTone, sellerReturnActions, validateReturnRequest,
} from './returns.ts'

test('powody zwrotu zawierają „nie spodobało mi się”', () => {
  assert.ok(RETURN_REASONS.some((r) => r.value === 'not_liked' && /spodobało/.test(r.label)))
})

test('informacja o kosztach: opłata i dostawa nie wracają, cena po doręczeniu', () => {
  assert.match(RETURN_COST_NOTICE, /Opłata za Ochronę i koszt dostawy.*nie wracają/)
  assert.match(RETURN_COST_NOTICE, /po doręczeniu paczki sprzedającemu/)
  assert.doesNotMatch(RETURN_COST_NOTICE, /PayU/i)
})

test('walidacja: powód wymagany, przy „inny” opis', () => {
  assert.deepEqual(validateReturnRequest('not_liked', ''), {})
  assert.ok(validateReturnRequest('', '').reason)
  assert.ok(validateReturnRequest('other', ' ab ').note)
  assert.deepEqual(validateReturnRequest('other', 'za mały'), {})
  assert.ok(validateReturnRequest('damaged', 'x'.repeat(1001)).note)
})

test('etykiety statusów po polsku, tekst serwera ma pierwszeństwo', () => {
  assert.equal(returnStatusLabel({ status: 'in_transit' }), 'Zwrot w drodze do sprzedającego')
  assert.equal(returnStatusLabel({ status: 'in_transit', statusLabelPl: 'W drodze' }), 'W drodze')
  assert.equal(returnStatusLabel({ status: null }), '')
  assert.equal(returnTone('refunded'), 'ok')
  assert.equal(returnTone('rejected'), 'muted')
})

test('status „Zwrot” w liście zamówień', () => {
  assert.equal(listReturnLabel('in_transit'), 'Zwrot')
  assert.equal(listReturnLabel('refunded'), 'Zwrot')
  assert.equal(listReturnLabel('cancelled'), null)
  assert.equal(listReturnLabel(null), null)
  assert.equal(isActiveReturn('refunded'), false)
  assert.equal(isActiveReturn('disputed'), true)
})

test('przyciski: kupujący zgłasza tylko gdy serwer pozwala, sprzedający przy zwrocie w drodze', () => {
  assert.equal(canRequestReturn({ status: null, canRequest: true }, 'buyer'), true)
  assert.equal(canRequestReturn({ status: null, canRequest: true }, 'seller'), false)
  assert.equal(canRequestReturn({ status: null, canRequest: false }, 'buyer'), false)
  assert.equal(canRequestReturn({ status: 'label_ready', canRequest: true }, 'buyer'), false)
  assert.equal(sellerReturnActions({ status: 'in_transit' }, 'seller'), true)
  assert.equal(sellerReturnActions({ status: 'in_transit' }, 'buyer'), false)
  assert.equal(sellerReturnActions({ status: 'refunded' }, 'seller'), false)
  assert.equal(buyerCanDownloadLabel({ status: 'label_ready', labelAvailable: true }, 'buyer'), true)
  assert.equal(buyerCanDownloadLabel({ status: 'label_ready', labelAvailable: false }, 'buyer'), false)
  assert.equal(buyerCanDownloadLabel({ status: 'label_ready', labelAvailable: true }, 'seller'), false)
})

test('terminy', () => {
  const now = Date.parse('2026-11-20T10:00:00Z')
  assert.match(returnDeadlineText({ status: null, canRequest: true, windowEndsAt: '2026-11-20T13:30:00Z' }, now) ?? '', /zostało 3 godz\. 30 min/)
  assert.equal(returnDeadlineText({ status: null, canRequest: true, windowEndsAt: '2026-11-20T09:00:00Z' }, now), null)
  assert.match(returnDeadlineText({ status: 'in_transit', deadline: '2026-11-27T10:00:00Z' }, now) ?? '', /automatycznie/)
  assert.match(returnDeadlineText({ status: 'delivered', deadline: '2026-11-19T10:00:00Z' }, now) ?? '', /minął/)
})
