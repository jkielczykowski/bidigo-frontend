// Powrót z PayU i stan płatności. Powrót przeglądarki (continueUrl) NICZEGO nie potwierdza: o zapłacie decyduje
// podpisane powiadomienie PayU po stronie serwera, a ta strona tylko pyta serwer o stan i mówi kupującemu, co się dzieje.

export type PayState = 'pending' | 'paid' | 'failed'

/** Jak długo (ms) czekamy na powiadomienie PayU, zanim zaproponujemy ponowną próbę. */
export const PAYU_WAIT_MS = 90_000

/** Czy adres zawiera znacznik powrotu z PayU (?payment=payu). */
export function returnedFromPayu(params: URLSearchParams): boolean {
  return params.get('payment') === 'payu'
}

const OPEN_ORDER = new Set(['AWAITING_PAYMENT', 'PAYMENT_PROCESSING'])
const DEAD_ORDER = new Set(['CANCELLED', 'REFUNDED', 'EXPIRED'])

/**
 * Stan płatności zamówienia z Ochroną po powrocie z PayU.
 * PAYMENT_PROCESSING = PayU jeszcze nie potwierdził; AWAITING_PAYMENT = płatność nieudana/anulowana (serwer cofnął zamówienie).
 */
export function orderPayState(status: string): PayState {
  if (status === 'PAYMENT_PROCESSING') return 'pending'
  if (status === 'AWAITING_PAYMENT' || DEAD_ORDER.has(status)) return 'failed'
  return OPEN_ORDER.has(status) ? 'pending' : 'paid'
}

/**
 * Stan płatności za dostawę. Dopóki przesyłka czeka na płatność i ma żywy link, powiadomienia jeszcze nie było
 * (lub PayU nadal czeka na kupującego): „oczekuje”; po PAYU_WAIT_MS proponujemy ponowną próbę. Bez linku
 * (serwer go usunął po anulowaniu w PayU) i bez zapłaty: „nieudana”.
 */
export function shipmentPayState(status: string, hasCheckoutUrl: boolean, waitedMs: number): PayState {
  if (status === 'CANCELLED' || status === 'SHIPPING_FAILED') return 'failed'
  if (status !== 'AWAITING_SHIPPING_PAYMENT') return 'paid'
  if (!hasCheckoutUrl) return 'failed'
  return waitedMs >= PAYU_WAIT_MS ? 'failed' : 'pending'
}

export const PAY_MESSAGES: Record<PayState, { title: string; body: string }> = {
  pending: {
    title: 'Czekamy na potwierdzenie płatności z PayU',
    body: 'Płatność jest w toku. Nie zamykaj tej strony — status odświeży się sam, gdy PayU potwierdzi wpłatę. Nic nie zostanie wysłane, dopóki nie dostaniemy potwierdzenia.',
  },
  paid: {
    title: 'Płatność udana',
    body: 'PayU potwierdził wpłatę. Dziękujemy!',
  },
  failed: {
    title: 'Płatność nieudana lub anulowana',
    body: 'Nie otrzymaliśmy potwierdzenia płatności z PayU, więc nie pobraliśmy pieniędzy za to zamówienie. Możesz spróbować zapłacić jeszcze raz. Jeśli pieniądze zeszły z konta, a status się nie zmienia, odezwij się do nas — sprawdzimy płatność.',
  },
}

export const PAYU_NOTE = 'Płatność obsługuje PayU. Zostaniesz przekierowany na stronę PayU, a po płatności wrócisz do Bidigo.'
export const PAYU_TEST_NOTE = 'Tryb testowy PayU (sandbox): płatności są próbne, żadne prawdziwe pieniądze nie są pobierane.'
