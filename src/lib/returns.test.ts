import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RETURN_COST_NOTICE, RETURN_REASONS, buyerCanDownloadLabel, canRequestReturn, isActiveReturn, listReturnLabel,
  returnDeadlineText, returnStatusLabel, returnTone, sellerCanConfirm, sellerCanDispute, sellerNeedsLocker, normalizeLockerCode, actionsDuringReturn, hasReturn, validateReturnRequest,
} from './returns.ts'

test('powody zwrotu zawierają „nie spodobało mi się”', () => {
  assert.ok(RETURN_REASONS.some((r) => r.value === 'changed_mind' && /spodobało/.test(r.label)))
})

test('informacja o kosztach: opłata i dostawa nie wracają, cena po doręczeniu', () => {
  assert.match(RETURN_COST_NOTICE, /Opłata za Ochronę i koszt dostawy.*nie wracają/)
  assert.match(RETURN_COST_NOTICE, /po doręczeniu paczki sprzedającemu/)
  assert.doesNotMatch(RETURN_COST_NOTICE, /PayU/i)
})

test('walidacja: powód wymagany, przy „inny” opis', () => {
  assert.deepEqual(validateReturnRequest('changed_mind', ''), {})
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
  assert.equal(canRequestReturn({ status: 'none', canRequest: true }, 'buyer'), true)
  assert.equal(canRequestReturn({ status: 'none', canRequest: true }, 'seller'), false)
  assert.equal(canRequestReturn({ status: null, canRequest: false }, 'buyer'), false)
  assert.equal(canRequestReturn({ status: 'label_ready', canRequest: true }, 'buyer'), false)
  assert.equal(sellerCanConfirm({ status: 'in_transit', canConfirmReceived: true }, 'seller'), true)
  assert.equal(sellerCanConfirm({ status: 'in_transit', canConfirmReceived: true }, 'buyer'), false)
  assert.equal(sellerCanConfirm({ status: 'in_transit' }, 'seller'), false)
  assert.equal(sellerCanDispute({ status: 'delivered', canDispute: true }, 'seller'), true)
  assert.equal(sellerNeedsLocker({ status: 'requested', needsReturnLocker: true }, 'seller'), true)
  assert.equal(sellerNeedsLocker({ status: 'requested', needsReturnLocker: true }, 'buyer'), false)
  assert.equal(buyerCanDownloadLabel({ status: 'label_ready', labelAvailable: true }, 'buyer'), true)
  assert.equal(buyerCanDownloadLabel({ status: 'label_ready', labelAvailable: false }, 'buyer'), false)
  assert.equal(buyerCanDownloadLabel({ status: 'label_ready', labelAvailable: true }, 'seller'), false)
})

test('terminy', () => {
  const now = Date.parse('2026-11-20T10:00:00Z')
  assert.match(returnDeadlineText({ status: 'none', canRequest: true, windowEndsAt: '2026-11-20T13:30:00Z' }, now) ?? '', /zostało 3 godz\. 30 min/)
  assert.equal(returnDeadlineText({ status: 'none', canRequest: true, windowEndsAt: '2026-11-20T09:00:00Z' }, now), null)
  assert.match(returnDeadlineText({ status: 'in_transit', deadline: '2026-11-27T10:00:00Z' }, now) ?? '', /automatycznie/)
  assert.match(returnDeadlineText({ status: 'delivered', deadline: '2026-11-19T10:00:00Z' }, now) ?? '', /minął/)
})

test('kod Paczkomatu', () => {
  assert.equal(normalizeLockerCode(' waw22m '), 'WAW22M')
  assert.equal(normalizeLockerCode('a'), null)
  assert.equal(normalizeLockerCode('WA-W22'), null)
})

test('status „none” to brak zwrotu; przy otwartym zwrocie znikają akcje potwierdzenia i zgłoszenia problemu', () => {
  assert.equal(hasReturn({ status: 'none' }), false)
  assert.equal(hasReturn({ status: 'in_transit' }), true)
  assert.equal(returnStatusLabel({ status: 'none' }), '')
  assert.equal(listReturnLabel('none'), null)
  const all = ['confirm_receipt', 'report_problem', 'cancel']
  assert.deepEqual(actionsDuringReturn(all, null, { status: 'in_transit' }), ['cancel'])
  assert.deepEqual(actionsDuringReturn(all, 'label_ready', null), ['cancel'])
  assert.deepEqual(actionsDuringReturn(all, null, { status: 'none' }), all)
  assert.deepEqual(actionsDuringReturn(all, 'refunded', null), all)
})
