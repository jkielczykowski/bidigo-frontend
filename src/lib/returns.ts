// Zwrot na koszt Bidigo (Ochrona Kupującego) — czysta logika, bez sieci. Kontrakt: docs/RETURNS.md w backendzie.
// To, czy zwrot wolno zgłosić, rozstrzyga serwer (pole canRequest); tu tylko opisujemy i walidujemy.

export type ReturnStatus = 'requested' | 'label_ready' | 'in_transit' | 'delivered' | 'refunded' | 'rejected' | 'disputed' | 'cancelled'

export type ReturnInfo = {
  status: ReturnStatus | null
  statusLabelPl?: string | null
  reason?: string | null
  note?: string | null
  deadline?: string | null
  refundAmount?: number | null
  labelAvailable?: boolean
  trackingNumber?: string | null
  canRequest?: boolean
  windowEndsAt?: string | null
}

export const RETURN_REASONS: { value: string; label: string }[] = [
  { value: 'not_liked', label: 'Nie spodobało mi się' },
  { value: 'not_fitting', label: 'Nie pasuje (rozmiar, wygląd)' },
  { value: 'not_as_described', label: 'Niezgodny z opisem' },
  { value: 'damaged', label: 'Uszkodzony' },
  { value: 'other', label: 'Inny powód' },
]

export const RETURN_COST_NOTICE =
  'Zwrot jest na koszt Bidigo: list przewozowy wygenerujesz za darmo. Opłata za Ochronę i koszt dostawy do Ciebie nie wracają. Cenę przedmiotu zwrócimy po doręczeniu paczki sprzedającemu.'

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Zwrot zgłoszony',
  label_ready: 'List zwrotny gotowy — nadaj paczkę',
  in_transit: 'Zwrot w drodze do sprzedającego',
  delivered: 'Zwrot doręczony sprzedającemu',
  refunded: 'Zwrot zrealizowany — pieniądze odesłane',
  rejected: 'Zwrot odrzucony',
  disputed: 'Problem ze zwrotem — rozpatruje Bidigo',
  cancelled: 'Zwrot anulowany',
}

const ACTIVE: ReturnStatus[] = ['requested', 'label_ready', 'in_transit', 'delivered', 'disputed']

export const isActiveReturn = (s: ReturnStatus | null | undefined): boolean => !!s && ACTIVE.includes(s)

/** Status zwrotu po polsku; własny tekst serwera ma pierwszeństwo, gdy jest podany. */
export function returnStatusLabel(info: Pick<ReturnInfo, 'status' | 'statusLabelPl'>): string {
  if (!info.status) return ''
  return info.statusLabelPl?.trim() || STATUS_LABELS[info.status] || info.status
}

export function returnTone(s: ReturnStatus | null | undefined): 'warn' | 'info' | 'ok' | 'bad' | 'muted' {
  switch (s) {
    case 'refunded':
      return 'ok'
    case 'disputed':
    case 'label_ready':
    case 'requested':
      return 'warn'
    case 'rejected':
    case 'cancelled':
      return 'muted'
    default:
      return 'info'
  }
}

/** Etykieta w liście zamówień: „Zwrot” dla zwrotu w toku lub zrealizowanego, inaczej null. */
export function listReturnLabel(s: ReturnStatus | string | null | undefined): string | null {
  if (!s) return null
  if (s === 'rejected' || s === 'cancelled') return null
  return 'Zwrot'
}

export type ReturnRequestError = { reason?: string; note?: string }

export function validateReturnRequest(reason: string, note: string): ReturnRequestError {
  const errors: ReturnRequestError = {}
  if (!RETURN_REASONS.some((r) => r.value === reason)) errors.reason = 'Wybierz powód zwrotu'
  const n = note.trim()
  if (reason === 'other' && n.length < 5) errors.note = 'Opisz powód (min. 5 znaków)'
  if (n.length > 1000) errors.note = 'Opis może mieć maks. 1000 znaków'
  return errors
}

export const canRequestReturn = (info: ReturnInfo | null, role: string | null): boolean =>
  role === 'buyer' && !!info?.canRequest && !isActiveReturn(info.status)

/** Przyciski sprzedającego: tylko gdy paczka zwrotna jest w drodze lub doręczona (ostatecznie decyduje serwer). */
export const sellerReturnActions = (info: ReturnInfo | null, role: string | null): boolean =>
  role === 'seller' && !!info && (info.status === 'in_transit' || info.status === 'delivered')

export const buyerCanDownloadLabel = (info: ReturnInfo | null, role: string | null): boolean =>
  role === 'buyer' && !!info?.labelAvailable && (info.status === 'label_ready' || info.status === 'requested' || info.status === 'in_transit')

/** Tekst o terminie: do kiedy można zgłosić zwrot albo do kiedy sprzedający ma potwierdzić odbiór (potem zwrot jest automatyczny). */
export function returnDeadlineText(info: ReturnInfo, now: number): string | null {
  const fmt = (iso: string) => new Date(iso).toLocaleString('pl-PL')
  if (info.deadline && (info.status === 'in_transit' || info.status === 'delivered')) {
    const left = new Date(info.deadline).getTime() - now
    if (Number.isNaN(left)) return null
    return left > 0
      ? `Sprzedający ma czas na potwierdzenie odbioru do ${fmt(info.deadline)}. Bez reakcji zwrot pieniędzy nastąpi automatycznie.`
      : 'Termin na reakcję sprzedającego minął — zwrot pieniędzy jest realizowany automatycznie.'
  }
  if (info.canRequest && info.windowEndsAt) {
    const left = new Date(info.windowEndsAt).getTime() - now
    if (Number.isNaN(left) || left <= 0) return null
    const h = Math.floor(left / 3_600_000)
    const m = Math.floor((left % 3_600_000) / 60_000)
    return `Zwrot możesz zgłosić do ${fmt(info.windowEndsAt)} (${h > 0 ? `zostało ${h} godz. ${m} min` : `zostało ${m} min`}).`
  }
  if (info.deadline && info.status === 'label_ready') return `Nadaj paczkę zwrotną do ${fmt(info.deadline)}.`
  return null
}

/** Opis dla sprzedającego, zależnie od statusu. */
export function sellerReturnText(info: ReturnInfo): string {
  switch (info.status) {
    case 'requested':
    case 'label_ready':
      return 'Kupujący zgłosił zwrot. Wypłata za to zamówienie jest wstrzymana, a paczka zwrotna nie została jeszcze nadana.'
    case 'in_transit':
      return 'Zwrot jest w drodze do Ciebie. Gdy paczka dotrze, potwierdź odbiór — wtedy zwrócimy kupującemu cenę przedmiotu. Jeśli przedmiot jest uszkodzony lub inny niż wysłany, zgłoś problem.'
    case 'delivered':
      return 'Paczka zwrotna została doręczona. Potwierdź odbiór albo zgłoś problem ze zwrotem.'
    case 'disputed':
      return 'Zgłosiłeś(-aś) problem ze zwrotem. Rozpatrzy go Bidigo; zwrot pieniędzy jest wstrzymany.'
    case 'refunded':
      return 'Zwrot został zrealizowany, kupujący odzyskał cenę przedmiotu.'
    default:
      return ''
  }
}
