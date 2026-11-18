import test from 'node:test'
import assert from 'node:assert/strict'
import { buyNowOffered, checkoutErrorText, COVERS, DIRECT_CONSEQUENCES, NOT_COVERS, buyChoices, countdown, howItWorks, orderTimeline, paymentDeadline, protectionReasonText, whatNow } from './checkout.ts'
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

test('każdy kod reason z buyer_protection_check ma właściwe zdanie; „nie kwalifikuje się” tylko dla przedmiotu', () => {
  // pełna lista kodów z SQL (V70/V74/V102/V111): protection_disabled, payments_not_ready, marketplace_not_ready, seller_payu_missing,
  // fee_not_configured, price_above_limit, category_excluded, not_inpost, parcel_data_missing, shipping_price_missing, limits_not_configured, parcel_too_large, auction_not_found
  const GENERIC = 'Ochrona Kupującego jest dostępna dla przedmiotów wysyłanych Paczkomatem InPost. Ten przedmiot nie kwalifikuje się do tej usługi.'
  const no = (reason: string | null, text: string | null = GENERIC): Quote => ({ ...eligible, eligible: false, reason, notEligibleText: text })
  // konfiguracja Bidigo: „chwilowo niedostępna”, bez słowa o przedmiocie, nawet gdy backend dołączył ogólny notEligibleText
  for (const r of ['limits_not_configured', 'fee_not_configured', 'protection_disabled', 'payments_not_ready', 'marketplace_not_ready']) {
    const c = buyChoices(no(r), payuOk)
    assert.equal(c.protection.available, false, r)
    assert.equal(c.protection.reason, 'Ochrona Kupującego jest chwilowo niedostępna.', r)
    assert.doesNotMatch(c.protection.reason!, /kwalifikuje/, r)
    assert.equal(c.protection.configIssue, true, r)
  }
  // przedmiot: dosłowne wymagane zdanie
  for (const r of ['category_excluded', 'not_inpost']) {
    const c = buyChoices(no(r), payuOk)
    assert.equal(c.protection.reason, GENERIC, r)
    assert.equal(c.protection.configIssue, false, r)
  }
  assert.equal(buyChoices(no('parcel_data_missing'), payuOk).protection.reason, 'Sprzedający nie podał jeszcze wymiarów paczki.')
  assert.match(buyChoices(no('shipping_price_missing'), payuOk).protection.reason!, /kosztu wysyłki/)
  assert.match(buyChoices(no('seller_payu_missing'), payuOk).protection.reason!, /konta PayU/)
  assert.match(buyChoices(no('parcel_too_large'), payuOk).protection.reason!, /za duża/)
  assert.match(buyChoices(no('price_above_limit'), payuOk).protection.reason!, /limit/)
  assert.equal(buyChoices(no('auction_not_found'), payuOk).protection.reason, 'Nie znaleziono aukcji.')
  // kod, którego nie znamy (nowy w backendzie): nigdy „nie kwalifikuje się”
  assert.equal(buyChoices(no('cos_nowego'), payuOk).protection.reason, 'Ochrona Kupującego jest chwilowo niedostępna.')
  assert.equal(buyChoices(no(null), payuOk).protection.reason, 'Ochrona Kupującego jest chwilowo niedostępna.')
  assert.equal(protectionReasonText('limits_not_configured'), 'Ochrona Kupującego jest chwilowo niedostępna.')
  assert.match(buyChoices(null, payuOk).protection.reason!, /Nie udało się sprawdzić/)
  // każde zdanie to jedno zdanie
  for (const r of ['limits_not_configured', 'category_excluded', 'parcel_data_missing', 'shipping_price_missing', 'seller_payu_missing', 'parcel_too_large', 'price_above_limit']) {
    const s = buyChoices(no(r), payuOk).protection.reason!
    assert.ok(s.endsWith('.') && !s.includes('\n'), r)
  }
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

test('termin płatności: odliczanie i skutek zależny od źródła zamówienia', () => {
  const now = Date.parse('2026-11-17T10:00:00Z')
  const base = { status: 'AWAITING_PAYMENT', fulfillment: 'protected', paymentDueAt: '2026-11-18T10:00:00Z' }
  const buyNow = paymentDeadline({ ...base, source: 'buy_now' }, now)!
  assert.match(buyNow.title, /zostało 24 godz\. 0 min/)
  assert.match(buyNow.consequence, /rezerwacja wygaśnie/)
  assert.match(buyNow.consequence, /anulowane/)
  const won = paymentDeadline({ ...base, source: 'auction' }, now)!
  assert.match(won.consequence, /Ochrona zniknie/)
  assert.match(won.consequence, /bez Ochrony Kupującego/)
  assert.equal(paymentDeadline({ ...base, source: 'auction', paymentDueAt: '2026-11-17T09:00:00Z' }, now)!.title, 'Czas na płatność z Ochroną minął')
  assert.equal(paymentDeadline({ ...base, status: 'PAID' }, now), null)
  assert.equal(paymentDeadline({ ...base, fulfillment: 'direct' }, now), null)
})

test('błąd startu płatności: czytelny komunikat, nigdy surowy kod HTTP', () => {
  for (const status of [400, 401, 403, 404, 409, 500, 502, 503, 504]) {
    const text = checkoutErrorText(status)
    assert.doesNotMatch(text, /\b50[0-9]\b|\b40[0-9]\b|Bad Gateway/, String(status))
    assert.ok(text.endsWith('.'), String(status))
  }
  assert.equal(checkoutErrorText(502), 'Nie udało się rozpocząć płatności PayU, spróbuj ponownie.')
  assert.equal(checkoutErrorText(500), 'Nie udało się rozpocząć płatności PayU, spróbuj ponownie.')
})

test('„Kup teraz” tylko z Ochroną: bez kwalifikacji, bez Paczkomatu w kategorii albo bez PayU nie ma przycisku ani ceny', () => {
  const ok = { ready: true, testMode: true, marketplaceEnabled: true }
  assert.equal(buyNowOffered(true, eligible, ok), true)
  assert.equal(buyNowOffered(false, eligible, ok), false, 'kategoria bez Paczkomatu (np. Audi w Pojazdach)')
  assert.equal(buyNowOffered(true, { ...eligible, eligible: false, reason: 'limits_not_configured' }, ok), false)
  assert.equal(buyNowOffered(true, { ...eligible, eligible: false, reason: 'price_above_limit' }, ok), false)
  assert.equal(buyNowOffered(true, { ...eligible, eligible: false, reason: 'not_inpost' }, ok), false)
  assert.equal(buyNowOffered(true, eligible, { ready: false }), false, 'PayU niegotowe')
  assert.equal(buyNowOffered(true, eligible, null), false)
  assert.equal(buyNowOffered(true, null, ok), false, 'nie udało się sprawdzić: nic nie oferujemy')
})
