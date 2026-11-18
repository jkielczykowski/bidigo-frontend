// Kasa „Kup z dostawą i Ochroną Bidigo” i oś statusów zamówienia: czysta logika (bez sieci), testowana node --test.
// Kwalifikację liczy WYŁĄCZNIE backend (order_quote); tu tylko opisujemy to, co zwrócił, jednym zdaniem.
import { NOT_ELIGIBLE_TEXT, type Order, type Quote } from './ordersLogic.ts'

export type PayuReady = { ready: boolean; testMode?: boolean; marketplaceEnabled?: boolean } | null

/**
 * Kody `reason` z buyer_protection_check (SQL) → jedno zdanie po polsku. Kluczowe: „nie kwalifikuje się” mówimy WYŁĄCZNIE o przedmiocie
 * (kategoria wyłączona z Paczkomatu, sprzedający nie oferuje Paczkomatu). Braki konfiguracji po stronie Bidigo to „chwilowo niedostępna”.
 * Tekstu notEligibleText z backendu NIE używamy: jest ogólny i błędnie sugeruje przedmiot także przy braku konfiguracji.
 */
export const PROTECTION_TEMPORARILY_UNAVAILABLE = 'Ochrona Kupującego jest chwilowo niedostępna.'

/** Powody po stronie konfiguracji Bidigo (admin może to naprawić w panelu). */
export const CONFIG_REASONS = new Set(['protection_disabled', 'payments_not_ready', 'marketplace_not_ready', 'fee_not_configured', 'limits_not_configured'])

const REASONS: Record<string, string> = {
  // konfiguracja Bidigo / PayU: nic o przedmiocie
  protection_disabled: PROTECTION_TEMPORARILY_UNAVAILABLE,
  payments_not_ready: PROTECTION_TEMPORARILY_UNAVAILABLE,
  marketplace_not_ready: PROTECTION_TEMPORARILY_UNAVAILABLE,
  fee_not_configured: PROTECTION_TEMPORARILY_UNAVAILABLE,
  limits_not_configured: PROTECTION_TEMPORARILY_UNAVAILABLE,
  // sprzedający
  seller_payu_missing: 'Sprzedający nie połączył jeszcze konta PayU, więc ta oferta nie ma Ochrony.',
  parcel_data_missing: 'Sprzedający nie podał jeszcze wymiarów paczki.',
  shipping_price_missing: 'Sprzedający nie podał jeszcze kosztu wysyłki Paczkomatem.',
  // przedmiot
  category_excluded: NOT_ELIGIBLE_TEXT,
  not_inpost: NOT_ELIGIBLE_TEXT,
  parcel_too_large: 'Paczka jest za duża na Paczkomat InPost.',
  price_above_limit: 'Cena przedmiotu przekracza limit Ochrony.',
  auction_not_found: 'Nie znaleziono aukcji.',
}

/** Zdanie dla danego kodu; nieznany kod (np. nowy po stronie backendu) = „chwilowo niedostępna”, nigdy „nie kwalifikuje się”. */
export function protectionReasonText(reason: string | null | undefined): string {
  return (reason ? REASONS[reason] : undefined) ?? PROTECTION_TEMPORARILY_UNAVAILABLE
}

export type BuyChoices = {
  /** „Kup z dostawą i Ochroną Bidigo”: tylko gdy backend mówi, że aukcja się kwalifikuje i bramka PayU jest gotowa */
  protection: { available: boolean; reason: string | null; /** brak konfiguracji po stronie Bidigo: admin może to naprawić */ configIssue?: boolean }
  /** „Kup bezpośrednio od sprzedającego”: zawsze dostępne */
  direct: { available: true }
}

export function buyChoices(quote: Quote | null, payu: PayuReady): BuyChoices {
  let reason: string | null = null
  if (!quote) reason = 'Nie udało się sprawdzić, czy Ochrona jest dostępna dla tego przedmiotu.'
  else if (!quote.eligible) {
    reason = protectionReasonText(quote.reason)
  } else if (!payu || !payu.ready || payu.marketplaceEnabled === false) {
    reason = 'Płatności PayU są chwilowo niedostępne, więc Ochrona jest teraz niedostępna.'
  }
  const configIssue = reason !== null && ((!!quote && !quote.eligible && !!quote.reason && CONFIG_REASONS.has(quote.reason)) || (!!quote && quote.eligible))
  return { protection: { available: reason === null, reason, configIssue }, direct: { available: true } }
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

/** Tekst błędu startu płatności: nigdy surowy kod HTTP w kasie (status 502 i inne zostają w API). */
export function checkoutErrorText(status: number): string {
  switch (status) {
    case 401: return 'Zaloguj się ponownie, żeby zapłacić.'
    case 403:
    case 404: return 'Tego zamówienia nie możesz opłacić.'
    case 409: return 'Ochrona nie jest już dostępna dla tego zamówienia albo brakuje dostawy lub zgody. Odśwież stronę.'
    case 422: return 'Konto PayU sprzedającego jest niezweryfikowane, więc płatność jest niemożliwa. Napisz do sprzedawcy.'
    case 503: return 'Płatności są chwilowo niedostępne. Spróbuj później.'
    default: return 'Nie udało się rozpocząć płatności PayU, spróbuj ponownie.'
  }
}

/**
 * Czy w ogłoszeniu w ogóle oferujemy „Kup teraz”: tylko z Ochroną Kupującego. Kategoria bez Paczkomatu (V110), brak kwalifikacji (Paczkomat, wymiary,
 * limit ceny, Ochrona wyłączona) albo niegotowe PayU = żadnego przycisku i żadnej ceny „Kup teraz”; zostają licytacja i rozmowa ze sprzedającym.
 */
export function buyNowOffered(lockerOk: boolean, quote: Quote | null, payu: PayuReady): boolean {
  return lockerOk && buyChoices(quote, payu).protection.available
}

/** Zegar do końca czasu na płatność: „23:59:41” (godz:min:sek); null bez terminu, „00:00:00” po terminie. */
export function payClock(dueIso: string | null | undefined, now: number): { expired: boolean; text: string } | null {
  if (!dueIso) return null
  const ms = new Date(dueIso).getTime() - now
  if (Number.isNaN(ms)) return null
  const sec = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return { expired: ms <= 0, text: `${p(Math.floor(sec / 3600))}:${p(Math.floor((sec % 3600) / 60))}:${p(sec % 60)}` }
}

/**
 * Dlaczego „Kup teraz” jest niedostępne, jednym zdaniem dla kupującego, z którym nic nie da się zrobić poza rozmową ze sprzedającym.
 * Limit ceny podaje kwotę (z `protection_price_limit`), reszta to powody z buyer_protection_check.
 */
export function buyNowUnavailableText(reason: string | null | undefined, priceLimit: number | null): string {
  if (reason === 'price_above_limit' && priceLimit != null) {
    const x = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(priceLimit)
    return `Ochrona Kupującego obejmuje zakupy do ${x} zł. Napisz do sprzedawcy, żeby ustalić zakup.`
  }
  if (reason === 'price_above_limit') return 'Cena przedmiotu przekracza limit Ochrony Kupującego. Napisz do sprzedawcy, żeby ustalić zakup.'
  return `${protectionReasonText(reason)} Napisz do sprzedawcy, żeby ustalić zakup.`
}
