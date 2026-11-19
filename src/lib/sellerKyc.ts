// Weryfikacja sprzedającego (dane do wypłaty): czysta logika bez sieci, testowana przez node --test.
// Kontrakt API: docs/PAYU-KYC.md w repozytorium backendu. Teksty dla użytkownika mówią „operator płatności”, bez nazwy.
import { normalizePlPhone } from './phone.ts'

export type KycStatus = 'not_started' | 'in_progress' | 'pending' | 'verified' | 'rejected' | 'reverification'
export type KycKind = 'PRIVATE_PERSON' | 'SOLE_TRADER'

export type KycDocument = { code: string; label: string }

export type KycState = {
  status: KycStatus
  kind: KycKind | null
  documentsRequested: KycDocument[]
  message: string | null
  lastError: string | null
  extCustomerId: string | null
  shopId: string | null
  widgetUrl: string | null
}

export type KycForm = {
  firstName: string
  lastName: string
  birthDate: string
  street: string
  zipcode: string
  city: string
  phone: string
  email: string
  iban: string
  nip: string
  companyName: string
}

export const EMPTY_FORM: KycForm = {
  firstName: '', lastName: '', birthDate: '', street: '', zipcode: '', city: '', phone: '', email: '', iban: '', nip: '', companyName: '',
}

export type KycFormErrors = Partial<Record<keyof KycForm, string>>

/** Limit pliku dokumentu (w sandboxie operatora 1 MB). */
export const MAX_DOCUMENT_BYTES = 1024 * 1024
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

/** Normalizuje IBAN do postaci „PL” + 26 cyfr (bez spacji); null, gdy to nie jest polski numer rachunku w formie IBAN. */
export function normalizePlIban(input: string): string | null {
  const s = input.replace(/\s+/g, '').toUpperCase()
  const digits = /^\d{26}$/.test(s) ? `PL${s}` : s
  return /^PL\d{26}$/.test(digits) ? digits : null
}

/** Suma kontrolna IBAN (mod 97 = 1). */
export function ibanChecksumOk(iban: string): boolean {
  const s = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false
  const rearranged = s.slice(4) + s.slice(0, 4)
  let rem = 0
  for (const ch of rearranged) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of v) rem = (rem * 10 + Number(d)) % 97
  }
  return rem === 1
}

export function isValidPlIban(input: string): boolean {
  const n = normalizePlIban(input)
  return n !== null && ibanChecksumOk(n)
}

/** IBAN do wyświetlania w grupach po 4 znaki. */
export function formatIban(input: string): string {
  const s = input.replace(/\s+/g, '').toUpperCase().slice(0, 28)
  return s.replace(/(.{4})/g, '$1 ').trim()
}

export function isValidZip(input: string): boolean {
  return /^\d{2}-\d{3}$/.test(input.trim())
}

/** Wstawia myślnik w kodzie pocztowym w trakcie pisania: 00950 → 00-950. */
export function formatZip(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 5)
  return d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d
}

export function normalizeNip(input: string): string {
  return input.replace(/[\s-]/g, '').replace(/^PL/i, '')
}

/** NIP: 10 cyfr, suma kontrolna z wagami 6-5-7-2-3-4-5-6-7 modulo 11 (reszta 10 jest niepoprawna). */
export function isValidNip(input: string): boolean {
  const n = normalizeNip(input)
  if (!/^\d{10}$/.test(n)) return false
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = w.reduce((a, x, i) => a + x * Number(n[i]), 0)
  const c = sum % 11
  return c !== 10 && c === Number(n[9])
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim())
}

/** Pełnoletność na dzień `today`; data w formacie RRRR-MM-DD. */
export function ageOn(birthDate: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1
  return age
}

/** Walidacja formularza po polsku; pusty obiekt = wszystko w porządku. NIP i nazwa firmy tylko dla działalności. */
export function validateKycForm(f: KycForm, kind: KycKind, today: Date = new Date()): KycFormErrors {
  const e: KycFormErrors = {}
  if (f.firstName.trim().length < 2) e.firstName = 'Podaj imię (min. 2 znaki).'
  if (f.lastName.trim().length < 2) e.lastName = 'Podaj nazwisko (min. 2 znaki).'
  const age = ageOn(f.birthDate, today)
  if (age === null) e.birthDate = 'Podaj datę urodzenia.'
  else if (age < 18) e.birthDate = 'Dane do wypłaty może podać tylko osoba pełnoletnia.'
  else if (age > 120) e.birthDate = 'Sprawdź datę urodzenia.'
  if (f.street.trim().length < 3) e.street = 'Podaj ulicę i numer domu.'
  if (!isValidZip(f.zipcode)) e.zipcode = 'Kod pocztowy w formacie 00-000.'
  if (f.city.trim().length < 2) e.city = 'Podaj miejscowość.'
  if (!normalizePlPhone(f.phone)) e.phone = 'Podaj polski numer telefonu (9 cyfr).'
  if (!isValidEmail(f.email)) e.email = 'Podaj poprawny adres e-mail.'
  if (!f.iban.trim()) e.iban = 'Podaj numer rachunku bankowego.'
  else if (!normalizePlIban(f.iban)) e.iban = 'Numer rachunku musi być polski: PL i 26 cyfr.'
  else if (!isValidPlIban(f.iban)) e.iban = 'Numer rachunku jest niepoprawny, sprawdź cyfry.'
  if (kind === 'SOLE_TRADER') {
    if (!f.nip.trim()) e.nip = 'Podaj NIP firmy.'
    else if (!isValidNip(f.nip)) e.nip = 'NIP jest niepoprawny (10 cyfr, sprawdź cyfrę kontrolną).'
    if (f.companyName.trim().length < 2) e.companyName = 'Podaj nazwę działalności.'
  }
  return e
}

/** Ładunek dla POST /data: znormalizowany, bez pól niepasujących do typu. */
export function buildKycPayload(f: KycForm, kind: KycKind): Record<string, string> {
  const p: Record<string, string> = {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    birthDate: f.birthDate,
    street: f.street.trim(),
    zipcode: f.zipcode.trim(),
    city: f.city.trim(),
    phone: normalizePlPhone(f.phone) ?? f.phone.trim(),
    email: f.email.trim(),
    iban: normalizePlIban(f.iban) ?? f.iban.trim(),
  }
  if (kind === 'SOLE_TRADER') {
    p.nip = normalizeNip(f.nip)
    p.companyName = f.companyName.trim()
  }
  return p
}

/** Błąd pliku dokumentu albo null. */
export function documentFileError(file: { size: number; type: string }): string | null {
  if (file.size === 0) return 'Plik jest pusty.'
  if (file.size > MAX_DOCUMENT_BYTES) return 'Plik jest za duży (limit 1 MB). Zmniejsz zdjęcie lub zapisz skan w niższej jakości.'
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) return 'Dozwolone formaty: PDF, JPG, PNG.'
  return null
}

/** Krok kreatora, na który prowadzi stan weryfikacji (początek ścieżki; „dane → regulamin” w jednym stanie in_progress ustala widok). */
export type KycStep = 'kind' | 'data' | 'regulations' | 'documents' | 'waiting' | 'verified' | 'rejected'

export function stepForState(s: Pick<KycState, 'status' | 'documentsRequested'>, dataSent: boolean, regulationsAccepted: boolean): KycStep {
  switch (s.status) {
    case 'not_started': return 'kind'
    case 'verified': return 'verified'
    case 'rejected': return 'rejected'
    case 'reverification': return s.documentsRequested.length > 0 ? 'documents' : 'data'
    case 'pending': return s.documentsRequested.length > 0 ? 'documents' : 'waiting'
    case 'in_progress':
      if (!dataSent) return 'data'
      return regulationsAccepted ? (s.documentsRequested.length > 0 ? 'documents' : 'waiting') : 'regulations'
  }
}

export const STATUS_LABEL: Record<KycStatus, string> = {
  not_started: 'Nie rozpoczęto',
  in_progress: 'W trakcie',
  pending: 'Oczekuje na weryfikację',
  verified: 'Zweryfikowane',
  rejected: 'Odrzucone',
  reverification: 'Wymaga ponownej weryfikacji',
}

export const KIND_LABEL: Record<KycKind, string> = {
  PRIVATE_PERSON: 'Osoba prywatna',
  SOLE_TRADER: 'Jednoosobowa działalność gospodarcza',
}

export const STATUS_TONE: Record<KycStatus, 'ok' | 'warn' | 'bad' | 'info'> = {
  not_started: 'info', in_progress: 'warn', pending: 'warn', verified: 'ok', rejected: 'bad', reverification: 'warn',
}

/** Komunikat do banera sprzedającego; null = wszystko w porządku (konto zweryfikowane). */
export function sellerKycMessage(status: KycStatus | null): { title: string; body: string; cta: string } | null {
  switch (status) {
    case 'verified': return null
    case null:
    case 'not_started':
      return {
        title: 'Podaj dane do wypłaty',
        body: 'Żeby sprzedawać z Ochroną Bidigo, podaj dane do wypłaty. Pieniądze za towar trafią prosto na Twoje konto u operatora płatności (nie do Bidigo), po potwierdzeniu odbioru przez kupującego. Do tego czasu sprzedajesz bezpośrednio.',
        cta: 'Podaj dane do wypłaty',
      }
    case 'in_progress':
      return { title: 'Dane do wypłaty: dokończ weryfikację', body: 'Zaczęliśmy weryfikację, ale brakuje jeszcze kilku kroków. Dokończ ją, żeby włączyć sprzedaż z Ochroną Bidigo.', cta: 'Dokończ weryfikację' }
    case 'pending':
      return { title: 'Weryfikacja w toku', body: 'Operator płatności sprawdza Twoje dane. Zwykle trwa to krótko. Gdy skończy, włączymy sprzedaż z Ochroną Bidigo. Do tego czasu sprzedajesz bezpośrednio.', cta: 'Zobacz stan weryfikacji' }
    case 'rejected':
      return { title: 'Weryfikacja odrzucona', body: 'Operator płatności nie zweryfikował Twoich danych, więc nie możesz sprzedawać z Ochroną Bidigo. Sprawdź powód i spróbuj ponownie.', cta: 'Zobacz powód i ponów' }
    case 'reverification':
      return { title: 'Potrzebna ponowna weryfikacja', body: 'Operator płatności prosi o ponowne potwierdzenie Twoich danych. Do tego czasu wypłaty mogą być wstrzymane.', cta: 'Potwierdź dane' }
  }
}

/** Kwota do odebrania (w zł) z zamówień sprzedającego z Ochroną, które już opłacono, a nie są zakończone ani odwołane. */
export function amountWaitingForSeller(orders: { fulfillment: string; status: string; itemAmount: number }[]): number {
  const live = new Set(['PAID', 'AWAITING_SHIPMENT', 'SHIPPED', 'DELIVERED', 'DISPUTED'])
  return orders.filter((o) => o.fulfillment === 'protected' && live.has(o.status)).reduce((a, o) => a + (Number(o.itemAmount) || 0), 0)
}

/** Czy wypłata czeka na dane sprzedającego (nie jest jeszcze zweryfikowany). */
export function payoutBlocked(status: KycStatus | null): boolean {
  return status !== 'verified'
}

export const BUYER_SELLER_VERIFYING = 'Sprzedający kończy weryfikację konta do wypłaty, więc płatność jest chwilowo niemożliwa. Napisz do sprzedawcy, a gdy skończy, wróć i zapłać.'

/** Błąd 422 {field, message} z API: pole formularza albo tekst ogólny. */
export function fieldErrorFromApi(body: unknown): { field: keyof KycForm | null; message: string } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { field?: unknown; message?: unknown }
  if (typeof b.message !== 'string' || !b.message) return null
  const known = Object.keys(EMPTY_FORM)
  return { field: typeof b.field === 'string' && known.includes(b.field) ? (b.field as keyof KycForm) : null, message: b.message }
}
