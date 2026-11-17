import test from 'node:test'
import assert from 'node:assert/strict'
import { COVERS, DIRECT_CONSEQUENCES, NOT_COVERS, buyChoices, countdown, howItWorks, orderTimeline, whatNow } from './checkout.ts'
import type { Quote } from './ordersLogic.ts'

const eligible: Quote = { eligible: true, reason: null, itemPrice: 100, shippingPrice: 12.99, protectionFee: 4, total: 116.99, notEligibleText: null }
const payuOk = { ready: true, testMode: true, marketplaceEnabled: true }

test('dwa wybory: Ochrona tylko gdy backend kwalifikuje i PayU jest gotowe; bezpośredni zawsze', () => {
  const ok = buyChoices(eligible, payuOk)
  assert.equal(ok.protection.available, true)
  assert.equal(ok.protection.reason, null)
  assert.equal(ok.direct.available, true)
  // bramka PayU niegotowa: Ochrona niedostępna z powodem, bezpośredni nadal jest
  const off = buyChoices(eligible, { ready: false })
  assert.equal(off.protection.available, false)
  assert.match(off.protection.reason!, /PayU/)
  assert.equal(off.direct.available, true)
  assert.equal(buyChoices(eligible, null).protection.available, false)
  assert.equal(buyChoices(eligible, { ready: true, marketplaceEnabled: false }).protection.available, false)
})

test('brak niejasnych stanów: każdy powód niedostępności to jedno zdanie, a wymagane zdanie o Paczkomacie jest dosłowne', () => {
  const no = (reason: string | null, text: string | null = null): Quote => ({ ...eligible, eligible: false, reason, notEligibleText: text })
  for (const r of ['protection_disabled', 'payments_not_ready', 'marketplace_not_ready', 'seller_payu_missing', 'fee_not_configured', 'price_above_limit',
    'parcel_data_missing', 'shipping_price_missing', 'parcel_too_large', 'limits_not_configured']) {
    const c = buyChoices(no(r), payuOk)
    assert.equal(c.protection.available, false, r)
    assert.ok(c.protection.reason && c.protection.reason.endsWith('.') && !c.protection.reason.includes('\n'), r)
  }
  assert.equal(buyChoices(no('not_inpost', 'Ochrona Kupującego jest dostępna dla przedmiotów wysyłanych Paczkomatem InPost. Ten przedmiot nie kwalifikuje się do tej usługi.'), payuOk).protection.reason,
    'Ochrona Kupującego jest dostępna dla przedmiotów wysyłanych Paczkomatem InPost. Ten przedmiot nie kwalifikuje się do tej usługi.')
  // powód spoza listy (np. wykluczona kategoria z innego wątku): ogólne zdanie, bez zgadywania
  assert.equal(buyChoices(no('category_excluded'), payuOk).protection.reason, 'Ochrona nie jest dostępna dla tego przedmiotu.')
  assert.match(buyChoices(null, payuOk).protection.reason!, /Nie udało się sprawdzić/)
})

test('skutki zakupu bezpośredniego są jawne', () => {
  assert.match(DIRECT_CONSEQUENCES, /nie masz Ochrony/)
  assert.match(DIRECT_CONSEQUENCES, /poza Bidigo/)
  assert.ok(COVERS.length >= 3 && NOT_COVERS.length >= 2)
})

test('„Jak to działa”: 4 punkty, okno zgłoszeń z ustawień admina', () => {
  const s = howItWorks(48)
  assert.equal(s.length, 4)
  assert.match(s[3].text, /48 godz\./)
  assert.match(howItWorks(null)[3].text, /ograniczony czas/)
  assert.match(s[1].text, /nie trafiają na konto Bidigo/)
})

test('oś statusów: Opłacone → nadaje → w drodze → gotowa → odebrane → środki', () => {
  const states = (status: any, payout?: string) => orderTimeline({ status }, payout).map((s) => s.state).join(',')
  assert.equal(states('AWAITING_SHIPMENT'), 'done,current,todo,todo,todo,todo')
  assert.equal(states('SHIPPED'), 'done,done,current,todo,todo,todo')
  assert.equal(states('DELIVERED'), 'done,done,done,current,todo,todo')
  assert.equal(states('COMPLETED', 'requested'), 'done,done,done,done,done,current')
  assert.equal(states('COMPLETED', 'succeeded'), 'done,done,done,done,done,done')
  assert.equal(states('DISPUTED'), 'done,done,done,blocked,todo,todo')
  assert.equal(orderTimeline({ status: 'AWAITING_SHIPMENT' }).map((s) => s.label).join(' | '),
    'Opłacone | Sprzedający nadaje paczkę | W drodze | Gotowa do odbioru | Odebrane | Środki trafiły do sprzedającego')
})

test('„co teraz” dla kupującego i sprzedającego; pieniądze czekają na potwierdzenie odbioru', () => {
  assert.match(whatNow({ status: 'AWAITING_SHIPMENT' }, 'seller', 48), /Zamówienie opłacone — nadaj paczkę/)
  assert.match(whatNow({ status: 'AWAITING_SHIPMENT' }, 'seller', 48), /czekają na potwierdzenie odbioru/)
  assert.match(whatNow({ status: 'DELIVERED' }, 'buyer', 48), /48 godz\./)
  assert.match(whatNow({ status: 'DISPUTED' }, 'buyer', 48), /wstrzymane/)
})

test('odliczanie okna zgłoszeń', () => {
  const now = Date.parse('2026-11-17T10:00:00Z')
  assert.equal(countdown(null, now), null)
  assert.deepEqual(countdown('2026-11-18T15:05:00Z', now), { expired: false, text: 'zostało 29 godz. 5 min' })
  assert.deepEqual(countdown('2026-11-17T10:20:00Z', now), { expired: false, text: 'zostało 20 min' })
  assert.equal(countdown('2026-11-17T09:00:00Z', now)!.expired, true)
})
