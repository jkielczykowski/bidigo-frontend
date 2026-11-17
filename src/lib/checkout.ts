// Kasa „Kup z dostawą i Ochroną Bidigo” i oś statusów zamówienia: czysta logika (bez sieci), testowana node --test.
// Kwalifikację liczy WYŁĄCZNIE backend (order_quote); tu tylko opisujemy to, co zwrócił, jednym zdaniem.
import { NOT_ELIGIBLE_TEXT, type Order, type Quote } from './ordersLogic.ts'

export type PayuReady = { ready: boolean; testMode?: boolean; marketplaceEnabled?: boolean } | null

const REASONS: Record<string, string> = {
  protection_disabled: 'Ochrona Kupującego jest teraz wyłączona.',
  payments_not_ready: 'Płatności za przedmioty przez Bidigo jeszcze nie działają.',
  marketplace_not_ready: 'Płatności za przedmioty przez Bidigo jeszcze nie działają.',
  seller_payu_missing: 'Sprzedający nie połączył jeszcze konta PayU, więc ten przedmiot nie ma Ochrony.',
  fee_not_configured: 'Ochrona nie jest jeszcze ustawiona dla tej kategorii.',
  price_above_limit: 'Cena przedmiotu przekracza limit Ochrony.',
  not_inpost: NOT_ELIGIBLE_TEXT,
  parcel_data_missing: 'Sprzedający nie podał jeszcze wymiarów paczki, więc Ochrona jest niedostępna.',
  shipping_price_missing: 'Sprzedający nie podał jeszcze kosztu wysyłki, więc Ochrona jest niedostępna.',
  parcel_too_large: 'Paczka jest za duża na Paczkomat InPost, więc Ochrona jest niedostępna.',
  limits_not_configured: 'Gabaryty InPost nie są jeszcze ustawione, więc Ochrona jest niedostępna.',
  auction_not_found: 'Nie znaleziono aukcji.',
}

export type BuyChoices = {
  /** „Kup z dostawą i Ochroną Bidigo”: tylko gdy backend mówi, że aukcja się kwalifikuje i bramka PayU jest gotowa */
  protection: { available: boolean; reason: string | null }
  /** „Kup bezpośrednio od sprzedającego”: zawsze dostępne */
  direct: { available: true }
}

export function buyChoices(quote: Quote | null, payu: PayuReady): BuyChoices {
  let reason: string | null = null
  if (!quote) reason = 'Nie udało się sprawdzić, czy Ochrona jest dostępna dla tego przedmiotu.'
  else if (!quote.eligible) {
    reason = quote.notEligibleText ?? (quote.reason ? REASONS[quote.reason] : null) ?? 'Ochrona nie jest dostępna dla tego przedmiotu.'
  } else if (!payu || !payu.ready || payu.marketplaceEnabled === false) {
    reason = 'Płatności PayU są chwilowo niedostępne, więc Ochrona jest teraz niedostępna.'
  }
  return { protection: { available: reason === null, reason }, direct: { available: true } }
}

/** Skutki zakupu bezpośredniego: komunikat wymagany, żeby kupujący wiedział, z czego rezygnuje. */
export const DIRECT_CONSEQUENCES =
  'Kupujesz bezpośrednio od sprzedającego: umawiacie się na odbiór lub wysyłkę w czacie, a płatność jest poza Bidigo. Bidigo nie wstrzymuje wtedy pieniędzy i nie zwraca ich w razie problemu, więc nie masz Ochrony Kupującego.'

export const COVERS = [
  'Paczka nie dotarła (zagubiona lub nigdy nie nadana).',
  'W paczce jest inny przedmiot niż w ogłoszeniu.',
  'Przedmiot jest uszkodzony lub niekompletny (zgłoszenie z opisem i zdjęciami).',
  'Paczka jest pusta.',
]
export const NOT_COVERS = [
  'Przedmiot, który po prostu Ci się nie podoba lub nie pasuje, jeśli jest zgodny z opisem.',
  'Zakupy bezpośrednie (bez Ochrony) i płatności poza Bidigo.',
  'Zgłoszenia po upływie okna na zgłoszenie problemu.',
]

/** Cztery punkty „Jak to działa”; okno zgłoszeń pochodzi z ustawień admina (reportWindowHours), nie z kodu. */
export function howItWorks(reportWindowHours: number | null): { title: string; text: string }[] {
  const window = reportWindowHours != null ? `${reportWindowHours} godz.` : 'ograniczony czas'
  return [
    { title: 'Płacisz teraz', text: 'Jedną płatnością przez PayU: przedmiot, dostawa i opłata za Ochronę.' },
    { title: 'Pieniądze czekają u operatora', text: 'Pieniądze za przedmiot nie trafiają na konto Bidigo ani do sprzedającego, dopóki nie potwierdzisz odbioru.' },
    { title: 'Sprzedający nadaje paczkę', text: 'Dostaje informację o opłaconym zamówieniu i etykietę InPost do Paczkomatu, który wybrałeś.' },
    { title: 'Potwierdzasz odbiór', text: `Gdy odbierzesz paczkę, klikasz „Wszystko w porządku”, a sprzedający dostaje pieniądze. Masz ${window} od doręczenia na zgłoszenie problemu; bez zgłoszenia zamówienie kończy się samo.` },
  ]
}

export const PAYMENT_METHODS_NOTE =
  'Metodę płatności (np. BLIK, karta, szybki przelew) wybierasz na stronie PayU, gdzie zobaczysz dokładnie te, które PayU udostępnia dla tej płatności.'

// ---------------------------------------------------------------- oś statusów

export type StepState = 'done' | 'current' | 'todo' | 'blocked'
export type TimelineStep = { key: string; label: string; state: StepState }

const STEPS = [
  ['paid', 'Opłacone'],
  ['ship', 'Sprzedający nadaje paczkę'],
  ['transit', 'W drodze'],
  ['ready', 'Gotowa do odbioru'],
  ['received', 'Odebrane'],
  ['payout', 'Środki trafiły do sprzedającego'],
] as const

/** Ile kroków osi jest ukończonych (0..6). payout: status wypłaty dla sprzedającego (order_checkout_state.payout.status). */
export function timelineProgress(status: Order['status'], payoutStatus: string | null | undefined): number {
  switch (status) {
    case 'PAID':
    case 'AWAITING_SHIPMENT':
      return 1
    case 'SHIPPED':
      return 2
    case 'DELIVERED':
      return 3 // „w drodze” skończone, bieżący krok: gotowa do odbioru
    case 'COMPLETED':
      return payoutStatus === 'succeeded' ? 6 : 5
    case 'DISPUTED':
      return 3
    default:
      return 0
  }
}

export function orderTimeline(order: Pick<Order, 'status'>, payoutStatus?: string | null): TimelineStep[] {
  const stopped = order.status === 'DISPUTED' || order.status === 'CANCELLED' || order.status === 'REFUNDED'
  const done = timelineProgress(order.status, payoutStatus)
  return STEPS.map(([key, label], i) => {
    let state: StepState = i < done ? 'done' : i === done ? 'current' : 'todo'
    if (stopped && i >= done) state = i === done ? 'blocked' : 'todo'
    if (order.status === 'COMPLETED' && payoutStatus === 'succeeded') state = 'done'
    return { key, label, state }
  })
}

/** Jedno zdanie „co teraz” dla kupującego i sprzedającego. */
export function whatNow(order: Pick<Order, 'status'>, role: 'buyer' | 'seller' | 'admin' | null, reportWindowHours: number | null, payoutStatus?: string | null): string {
  const seller = role === 'seller'
  const hours = reportWindowHours != null ? `${reportWindowHours} godz.` : 'ograniczony czas'
  switch (order.status) {
    case 'AWAITING_PAYMENT':
      return seller ? 'Kupujący jeszcze nie zapłacił.' : 'Zamówienie czeka na Twoją płatność.'
    case 'PAYMENT_PROCESSING':
      return seller ? 'Płatność kupującego jest w toku.' : 'Czekamy na potwierdzenie płatności z PayU.'
    case 'PAID':
    case 'AWAITING_SHIPMENT':
      return seller
        ? 'Zamówienie opłacone — nadaj paczkę. Pieniądze czekają na potwierdzenie odbioru przez kupującego.'
        : 'Zapłacone. Sprzedający nadaje teraz paczkę do wybranego Paczkomatu.'
    case 'SHIPPED':
      return seller ? 'Paczka jest w drodze do kupującego.' : 'Paczka jest w drodze do Paczkomatu.'
    case 'DELIVERED':
      return seller
        ? 'Paczka czeka na odbiór. Dostaniesz pieniądze po potwierdzeniu odbioru albo po upływie terminu bez zgłoszenia.'
        : `Paczka czeka w Paczkomacie. Odbierz ją i sprawdź zawartość. Masz ${hours} od doręczenia na zgłoszenie problemu.`
    case 'COMPLETED':
      return payoutStatus === 'succeeded'
        ? (seller ? 'Środki zostały wypłacone.' : 'Zamówienie zakończone. Sprzedający dostał pieniądze.')
        : (seller ? 'Zamówienie zakończone — wypłata jest w drodze do Ciebie.' : 'Zamówienie zakończone. Wypłata dla sprzedającego jest w drodze.')
    case 'DISPUTED':
      return 'Zgłoszono problem. Pieniądze są wstrzymane do rozstrzygnięcia.'
    case 'REFUNDED':
      return 'Pieniądze zostały zwrócone kupującemu.'
    case 'CANCELLED':
      return 'Zamówienie anulowane.'
  }
}

/** Odliczanie do końca okna zgłoszeń: „zostało 31 godz. 5 min” albo „okno minęło”. */
export function countdown(untilIso: string | null | undefined, now: number): { expired: boolean; text: string } | null {
  if (!untilIso) return null
  const ms = new Date(untilIso).getTime() - now
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return { expired: true, text: 'okno na zgłoszenie problemu minęło' }
  const min = Math.floor(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return { expired: false, text: h > 0 ? `zostało ${h} godz. ${m} min` : `zostało ${m} min` }
}

/**
 * Czas na płatność z Ochroną (limit „Czas na płatność” z admina): odliczanie i skutek upływu terminu. Skutek zależy od źródła zamówienia:
 * „Kup teraz” = rezerwacja wygasa i zamówienie jest anulowane; wygrana licytacja = Ochrona znika i zostaje transakcja bezpośrednia.
 */
export function paymentDeadline(order: { status: string; fulfillment: string; source?: string | null; paymentDueAt: string | null }, now: number): { title: string; consequence: string } | null {
  if (order.fulfillment !== 'protected' || order.status !== 'AWAITING_PAYMENT') return null
  const c = countdown(order.paymentDueAt, now)
  if (!c) return null
  const consequence = order.source === 'buy_now'
    ? 'Po tym terminie rezerwacja wygaśnie, a zamówienie zostanie anulowane.'
    : 'Po tym terminie Ochrona zniknie i zostanie transakcja bezpośrednia ze sprzedającym, bez Ochrony Kupującego.'
  return { title: c.expired ? 'Czas na płatność z Ochroną minął' : `Czas na płatność z Ochroną: ${c.text} (do ${new Date(order.paymentDueAt as string).toLocaleString('pl-PL')})`, consequence }
}
