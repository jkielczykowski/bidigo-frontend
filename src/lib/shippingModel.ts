// Przesyłki InPost: bidigo-api /api/v1/shipments (płatność, etykieta i ShipX żyją na serwerze, tu nie ma żadnych sekretów).

export type ParcelSize = 'A' | 'B' | 'C'

export type Shipment = {
  id: string
  orderId: string
  auctionId?: string
  role: 'buyer' | 'seller' | 'admin'
  status: ShipmentStatus
  statusLabel: string
  paymentMode: 'STANDALONE' | 'WITH_PROTECTION'
  paymentNotice: string
  priceGrosz: number
  parcelSize: ParcelSize
  targetPoint: string
  targetPointName?: string
  trackingNumber?: string
  trackingUrl?: string
  checkoutUrl?: string
  labelAvailable: boolean
  canCancel: boolean
  createdAt: string
  updatedAt: string
  history: { status: ShipmentStatus; label: string; at: string }[]
}

export type ShipmentStatus =
  | 'AWAITING_SHIPPING_PAYMENT'
  | 'SHIPPING_PAID'
  | 'LABEL_GENERATING'
  | 'LABEL_READY'
  | 'AWAITING_DISPATCH'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'SHIPPING_FAILED'
  | 'CANCELLED'

export type ShippingConfig = {
  /** The admin's switch (and the server's kill switch): shows or hides every trace of shipments. */
  flagEnabled: boolean
  /** The ONE condition for paying for a delivery: credentials, payment gateway and mode were checked by the backend. */
  carrierReady: boolean
  /** InPost sandbox: labels are test labels, payments must be test payments. */
  sandbox: boolean
  notReadyReason?: string | null
  message?: string | null
  enabled: boolean
  environment: 'sandbox' | 'production' | string
  geowidgetToken?: string
  sizes: { size: ParcelSize; dimensions: string; priceGrosz: number }[]
  standaloneNotice: string
  protectionNotice: string
}

export type LockerPoint = { code: string; name: string; address: string; city: string; postCode: string }

// ---------------------------------------------------------------- pure helpers (tested)

export function formatGrosz(grosz: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(grosz / 100)
}

/** KRA010M, WAW123BM, POP-KRA12: the codes InPost uses (case-insensitive, spaces ignored). */
export function normaliseLocker(raw: string): string | null {
  const code = raw.replace(/\s+/g, '').toUpperCase()
  return /^([A-Z]{3}\d{2,3}[A-Z]{1,3}|POP-[A-Z0-9-]{2,12})$/.test(code) ? code : null
}

/** 9 digits, "+48", spaces and dashes allowed. null when it cannot be a Polish mobile number InPost accepts. */
export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/[\s\-()]/g, '')
  if (d.startsWith('+48')) d = d.slice(3)
  else if (d.startsWith('0048')) d = d.slice(4)
  return /^\d{9}$/.test(d) ? d : null
}

/** The Geowidget point as the picker needs it (ShipX point name = code). */
export function pointFromGeowidget(p: Record<string, any>): LockerPoint {
  const d = p.address_details ?? {}
  return {
    code: String(p.name ?? ''),
    name: String(p.location_description ?? p.name ?? ''),
    address: [d.street, d.building_number].filter(Boolean).join(' ') || String(p.address?.line1 ?? ''),
    city: String(d.city ?? ''),
    postCode: String(d.post_code ?? ''),
  }
}

const FLOW: ShipmentStatus[] = ['AWAITING_SHIPPING_PAYMENT', 'SHIPPING_PAID', 'LABEL_READY', 'AWAITING_DISPATCH', 'IN_TRANSIT', 'DELIVERED']

/** Progress bar of the happy path: index of the step reached, -1 for failed/cancelled. */
export function progressStep(status: ShipmentStatus): number {
  if (status === 'SHIPPING_FAILED' || status === 'CANCELLED') return -1
  if (status === 'LABEL_GENERATING') return 1
  return FLOW.indexOf(status)
}

export const PROGRESS_LABELS = ['Opłata', 'Opłacona', 'Etykieta', 'Nadanie', 'W drodze', 'Dostarczona']

/** What the person should do next, in their role. */
export function nextAction(s: Pick<Shipment, 'status' | 'role' | 'labelAvailable'>): string {
  const seller = s.role === 'seller'
  switch (s.status) {
    case 'AWAITING_SHIPPING_PAYMENT':
      return seller ? 'Czekamy, aż kupujący opłaci dostawę.' : 'Opłać dostawę, żeby sprzedający mógł nadać paczkę.'
    case 'SHIPPING_PAID':
    case 'LABEL_GENERATING':
      return seller ? 'Przygotowujemy etykietę. Za chwilę będzie do pobrania.' : 'Dostawa opłacona. Przygotowujemy etykietę dla sprzedającego.'
    case 'LABEL_READY':
    case 'AWAITING_DISPATCH':
      return seller ? 'Pobierz etykietę, naklej ją na paczkę i nadaj w dowolnym Paczkomacie InPost.' : 'Sprzedający nada paczkę. Dostaniesz powiadomienie.'
    case 'IN_TRANSIT':
      return seller ? 'Paczka jest w drodze do kupującego.' : 'Paczka jest w drodze. Odbierzesz ją w wybranym Paczkomacie.'
    case 'DELIVERED':
      return 'Paczka została odebrana.'
    case 'SHIPPING_FAILED':
      return seller ? 'Nie udało się utworzyć przesyłki. Zajmujemy się tym, kupujący dostanie zwrot opłaty.' : 'Nie udało się utworzyć przesyłki. Zwrócimy opłatę za dostawę.'
    case 'CANCELLED':
      return 'Przesyłka została anulowana.'
  }
}


// ---------------------------------------------------------------- how a listing's delivery options read

const OPTION_LABELS: Record<string, string> = {
  odbior: 'Odbiór osobisty',
  inpost: 'Paczkomat InPost',
  kurier: 'Kurier',
}

/** "odbior, kurier" is stored; people read "Odbiór osobisty, Kurier". InPost disappears while shipping is switched off. */
export function shippingOptionsText(options: string[] | null | undefined, shippingOn: boolean): string {
  const shown = (options ?? []).filter((o) => shippingOn || o !== 'inpost').map((o) => OPTION_LABELS[o] ?? o)
  return shown.length ? shown.join(', ') : 'do uzgodnienia'
}

/** Why the buyer cannot pay now, in words. */
export const SHIPPING_SOON = 'Dostawa InPost będzie dostępna wkrótce. Ustal wysyłkę ze sprzedającym.'
