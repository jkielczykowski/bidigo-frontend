// Orders and Ochrona Bidigo — pure logic (no network), tested with node --test.
// Eligibility is NEVER computed here: the backend decides (rpc order_quote → buyer_protection_check).
// This file only describes and validates what the backend returned.

export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'AWAITING_SHIPMENT'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'REFUNDED'

export type OrderAction =
  | 'pay'
  | 'choose_direct'
  | 'cancel'
  | 'ship'
  | 'confirm_receipt'
  | 'report_problem'
  | 'respond_dispute'

export type Quote = {
  eligible: boolean
  reason: string | null
  itemPrice: number
  shippingPrice: number | null
  protectionFee: number | null
  total: number | null
  promoApplied?: boolean
  notEligibleText: string | null
}

export type Order = {
  id: string
  number: string
  auctionId: string
  itemTitle: string
  imageUrl: string | null
  status: OrderStatus
  fulfillment: 'protected' | 'direct'
  source?: 'auction' | 'buy_now'
  role: 'buyer' | 'seller' | 'admin' | null
  buyerName: string | null
  sellerName: string | null
  itemAmount: number
  shippingAmount: number
  protectionFee: number
  totalAmount: number
  refundedAmount: number
  trackingNumber: string | null
  paymentDueAt: string | null
  reportUntil: string | null
  createdAt: string
  actions: OrderAction[]
  dispute: { kind: string; status: string; description: string; sellerResponse: string | null; resolutionNote: string | null } | null
  history?: { from: string | null; to: OrderStatus; note: string; at: string }[]
  refunds?: { id: string; amount: number; status: string; reason: string }[]
}

/** The exact sentence required for items that do not qualify (shown only when the service itself is available). */
export const NOT_ELIGIBLE_TEXT =
  'Ochrona Kupującego jest dostępna dla przedmiotów wysyłanych Paczkomatem InPost. Ten przedmiot nie kwalifikuje się do tej usługi.'

const STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Czeka na płatność',
  PAYMENT_PROCESSING: 'Płatność w toku',
  PAID: 'Opłacone',
  AWAITING_SHIPMENT: 'Czeka na wysyłkę',
  SHIPPED: 'Wysłane',
  DELIVERED: 'Doręczone — czeka na potwierdzenie',
  COMPLETED: 'Zakończone',
  DISPUTED: 'Zgłoszony problem',
  CANCELLED: 'Anulowane',
  REFUNDED: 'Zwrócone',
}

export function statusLabel(status: OrderStatus, fulfillment: 'protected' | 'direct' = 'protected'): string {
  if (fulfillment === 'direct' && status === 'AWAITING_SHIPMENT') return 'Do ustalenia ze sprzedawcą'
  return STATUS_LABELS[status] ?? status
}

export type Tone = 'warn' | 'info' | 'ok' | 'bad' | 'muted'
export function statusTone(status: OrderStatus): Tone {
  switch (status) {
    case 'AWAITING_PAYMENT':
    case 'DISPUTED':
      return 'warn'
    case 'COMPLETED':
      return 'ok'
    case 'CANCELLED':
    case 'REFUNDED':
      return 'muted'
    default:
      return 'info'
  }
}

/** The text to show under "Kup z Ochroną" — or nothing (null) when the service is not available at all. */
export function quoteMessage(q: Pick<Quote, 'eligible' | 'reason' | 'notEligibleText'>): string | null {
  if (q.eligible) return null
  if (q.notEligibleText) return q.notEligibleText
  // Service off / not configured / unavailable for the price or category: no promise, no tease.
  return null
}

/** Cost lines for the checkout summary: item + delivery + protection = total (all from the server's numbers). */
export function costLines(q: { itemPrice: number; shippingPrice: number | null; protectionFee: number | null; total: number | null }) {
  const lines = [
    { key: 'item', label: 'Cena przedmiotu', amount: q.itemPrice },
    { key: 'shipping', label: 'Dostawa Paczkomatem InPost', amount: q.shippingPrice ?? 0 },
    { key: 'protection', label: 'Ochrona Kupującego Bidigo', amount: q.protectionFee ?? 0 },
  ]
  const sum = round2(lines.reduce((s, l) => s + l.amount, 0))
  return { lines, total: q.total ?? sum, consistent: q.total == null || Math.abs(q.total - sum) < 0.005 }
}

export const round2 = (n: number) => Math.round(n * 100) / 100

// ---- seller's parcel fields ("Czy można wysłać Paczkomatem InPost?") ----

export type ParcelInput = {
  locker: 'yes' | 'no' | ''
  kind: string
  length: string
  width: string
  height: string
  weight: string
  shippingPrice: string
}

export type ParcelColumns = {
  inpost_locker_ok: boolean | null
  parcel_kind: string | null
  parcel_length_cm: number | null
  parcel_width_cm: number | null
  parcel_height_cm: number | null
  parcel_weight_kg: number | null
  locker_shipping_price: number | null
}

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

/** Validates the seller's answer; the backend re-validates and decides eligibility (limits are configuration). */
export function parcelColumns(p: ParcelInput): { columns: ParcelColumns; errors: Partial<Record<keyof ParcelInput, string>> } {
  const errors: Partial<Record<keyof ParcelInput, string>> = {}
  const empty: ParcelColumns = {
    inpost_locker_ok: p.locker === 'no' ? false : null,
    parcel_kind: null,
    parcel_length_cm: null,
    parcel_width_cm: null,
    parcel_height_cm: null,
    parcel_weight_kg: null,
    locker_shipping_price: null,
  }
  if (p.locker !== 'yes') return { columns: empty, errors }
  const fields: [keyof ParcelInput, string][] = [
    ['length', 'Podaj długość w cm'],
    ['width', 'Podaj szerokość w cm'],
    ['height', 'Podaj wysokość w cm'],
    ['weight', 'Podaj wagę w kg'],
  ]
  for (const [key, msg] of fields) {
    const v = num(p[key])
    if (v == null || !Number.isFinite(v) || v <= 0) errors[key] = msg
  }
  const price = num(p.shippingPrice)
  if (price == null || !Number.isFinite(price) || price < 0) errors.shippingPrice = 'Podaj koszt wysyłki Paczkomatem (może być 0)'
  if (p.kind.trim().length > 60) errors.kind = 'Rodzaj przedmiotu: maks. 60 znaków'
  return {
    errors,
    columns: {
      inpost_locker_ok: true,
      parcel_kind: p.kind.trim() || null,
      parcel_length_cm: num(p.length),
      parcel_width_cm: num(p.width),
      parcel_height_cm: num(p.height),
      parcel_weight_kg: num(p.weight),
      locker_shipping_price: price,
    },
  }
}

export function parcelInputFrom(a: Partial<ParcelColumns> | null | undefined): ParcelInput {
  const s = (v: number | null | undefined) => (v == null ? '' : String(v))
  return {
    locker: a?.inpost_locker_ok === true ? 'yes' : a?.inpost_locker_ok === false ? 'no' : '',
    kind: a?.parcel_kind ?? '',
    length: s(a?.parcel_length_cm),
    width: s(a?.parcel_width_cm),
    height: s(a?.parcel_height_cm),
    weight: s(a?.parcel_weight_kg),
    shippingPrice: s(a?.locker_shipping_price),
  }
}

export const PROBLEM_KINDS: { value: string; label: string }[] = [
  { value: 'not_received', label: 'Nie dostałem paczki' },
  { value: 'not_as_described', label: 'Przedmiot niezgodny z opisem' },
  { value: 'damaged', label: 'Przedmiot uszkodzony' },
  { value: 'other', label: 'Inny problem' },
]

/** Buttons the person sees, in order — only what the server allows (order.actions). */
export function visibleActions(o: Pick<Order, 'actions'>): OrderAction[] {
  const order: OrderAction[] = ['pay', 'choose_direct', 'ship', 'confirm_receipt', 'report_problem', 'respond_dispute', 'cancel']
  return order.filter((a) => o.actions.includes(a))
}
