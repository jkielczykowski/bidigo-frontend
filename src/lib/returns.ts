// Zwrot na koszt Bidigo (Ochrona Kupującego) — czysta logika, bez sieci. Kontrakt: docs/RETURNS.md w backendzie.
// To, czy zwrot wolno zgłosić, rozstrzyga serwer (pole canRequest); tu tylko opisujemy i walidujemy.

export type ReturnStatus = 'requested' | 'label_ready' | 'in_transit' | 'delivered' | 'refunded' | 'rejected' | 'disputed' | 'cancelled'

export type RefundState = 'none' | 'pending' | 'failed' | 'done'

export type ReturnInfo = {
  status: ReturnStatus | 'none' | null
  reasonLabelPl?: string | null
  cannotRequestReason?: string | null
  returnWindowHours?: number | null
  refundState?: RefundState | null
  canConfirmReceived?: boolean
  canDispute?: boolean
  needsReturnLocker?: boolean
  returnLocker?: { code: string; name?: string | null } | null
  trackingUrl?: string | null
  disputeDescription?: string | null
  rejectReason?: string | null
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
  { value: 'changed_mind', label: 'Nie spodobało mi się / zmieniłem(-am) zdanie' },
  { value: 'not_as_described', label: 'Niezgodny z opisem' },
  { value: 'damaged', label: 'Uszkodzony' },
  { value: 'wrong_item', label: 'Dostałem(-am) inny przedmiot' },
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

export const isActiveReturn = (s: ReturnStatus | 'none' | null | undefined): boolean => !!s && s !== 'none' && ACTIVE.includes(s)

/** Czy zamówienie ma zwrot (status różny od „none”). */
export const hasReturn = (info: Pick<ReturnInfo, 'status'> | null | undefined): boolean => !!info?.status && info.status !== 'none'

/** Status zwrotu po polsku; własny tekst serwera ma pierwszeństwo, gdy jest podany. */
export function returnStatusLabel(info: Pick<ReturnInfo, 'status' | 'statusLabelPl'>): string {
  if (!info.status || info.status === 'none') return ''
  return info.statusLabelPl?.trim() || STATUS_LABELS[info.status] || info.status
}

export function returnTone(s: ReturnStatus | 'none' | null | undefined): 'warn' | 'info' | 'ok' | 'bad' | 'muted' {
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
  if (!s || s === 'none') return null
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

/** Przyciski sprzedającego: decyduje serwer (canConfirmReceived / canDispute). */
export const sellerCanConfirm = (info: ReturnInfo | null, role: string | null): boolean => role === 'seller' && !!info?.canConfirmReceived
export const sellerCanDispute = (info: ReturnInfo | null, role: string | null): boolean => role === 'seller' && !!info?.canDispute
export const sellerNeedsLocker = (info: ReturnInfo | null, role: string | null): boolean => role === 'seller' && !!info?.needsReturnLocker

/** Kod Paczkomatu (np. WAW22M): litery i cyfry, 3-12 znaków; zwraca kod w wielkich literach albo null. */
export function normalizeLockerCode(input: string): string | null {
  const c = input.trim().toUpperCase().replace(/\s+/g, '')
  return /^[A-Z0-9]{3,12}$/.test(c) ? c : null
}

/** Zamówienie z otwartym zwrotem: ukrywamy „Wszystko w porządku” i „Zgłoś problem” (baza i tak odrzuci je 409). Fallback gdy backend sam ich nie ukryje. */
export function actionsDuringReturn<T extends string>(actions: T[], returnStatus: string | null | undefined, info: ReturnInfo | null): T[] {
  const open = info ? isActiveReturn(info.status) : isActiveReturn(returnStatus as ReturnStatus | null | undefined)
  return open ? actions.filter((a) => a !== 'confirm_receipt' && a !== 'report_problem') : actions
}

export const buyerCanDownloadLabel = (info: ReturnInfo | null, role: string | null): boolean =>
  role === 'buyer' && !!info?.labelAvailable

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
  if (info.canRequest && info.status === 'none' && info.windowEndsAt) {
    const left = new Date(info.windowEndsAt).getTime() - now
    if (Number.isNaN(left) || left <= 0) return null
    const h = Math.floor(left / 3_600_000)
    const m = Math.floor((left % 3_600_000) / 60_000)
    return `Zwrot możesz zgłosić do ${fmt(info.windowEndsAt)} (${h > 0 ? `zostało ${h} godz. ${m} min` : `zostało ${m} min`}).`
  }
  if (info.deadline && (info.status === 'label_ready' || info.status === 'requested')) return `Paczkę zwrotną trzeba nadać do ${fmt(info.deadline)}, inaczej zwrot zostanie anulowany.`
  return null
}

/** Opis dla sprzedającego, zależnie od statusu. */
export function sellerReturnText(info: ReturnInfo): string {
  switch (info.status) {
    case 'requested':
      return info.needsReturnLocker
        ? 'Kupujący zgłosił zwrot. Podaj Paczkomat, do którego ma trafić paczka zwrotna — dopiero wtedy przygotujemy list. Wypłata za to zamówienie jest wstrzymana.'
        : 'Kupujący zgłosił zwrot. Przygotowujemy list zwrotny. Wypłata za to zamówienie jest wstrzymana.'
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
