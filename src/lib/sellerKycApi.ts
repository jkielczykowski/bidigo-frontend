import { supabase } from './supabase'
import { acceptRegulationsIdempotent, fieldErrorFromApi, type KycForm, type KycKind, type KycState } from './sellerKyc.ts'
import { buildKycPayload } from './sellerKyc.ts'

// Klient API weryfikacji sprzedającego: /api/v1/seller/kyc (kontrakt: docs/PAYU-KYC.md w repozytorium backendu).

/** Błąd API: status HTTP, tekst po polsku i (przy 422) pole formularza, którego dotyczy. */
export class KycApiError extends Error {
  readonly status: number
  readonly field: keyof KycForm | null
  constructor(status: number, message: string, field: keyof KycForm | null = null) {
    super(message)
    this.status = status
    this.field = field
  }
}

const BASE = '/api/v1/seller/kyc'

function statusText(status: number): string {
  switch (status) {
    case 401: return 'Zaloguj się ponownie.'
    case 403: return 'Weryfikacja sprzedających nie jest jeszcze włączona dla tego konta.'
    case 409: return 'Ten krok nie jest teraz dostępny. Odśwież stronę.'
    case 413: return 'Plik jest za duży (limit 1 MB).'
    case 429: return 'Za dużo prób. Poczekaj chwilę i spróbuj ponownie.'
    case 503: return 'Weryfikacja jest chwilowo niedostępna. Spróbuj później.'
    default: return 'Nie udało się wykonać operacji. Spróbuj ponownie.'
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  let body: BodyInit | undefined
  if (init.form) body = init.form
  else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.body)
  }
  const res = await fetch(`${BASE}${path}`, { method: init.method ?? 'GET', headers, body })
  if (!res.ok) {
    const parsed = await res.json().catch(() => null)
    const fe = res.status === 422 ? fieldErrorFromApi(parsed) : null
    throw new KycApiError(res.status, fe?.message ?? statusText(res.status), fe?.field ?? null)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

function normalize(raw: Partial<KycState>): KycState {
  return {
    status: raw.status ?? 'not_started',
    kind: raw.kind ?? null,
    documentsRequested: Array.isArray(raw.documentsRequested) ? raw.documentsRequested : [],
    message: raw.message ?? null,
    lastError: raw.lastError ?? null,
    extCustomerId: raw.extCustomerId ?? null,
    shopId: raw.shopId ?? null,
    widgetUrl: raw.widgetUrl || null,
    regulationsAccepted: raw.regulationsAccepted ?? null,
    dataSent: raw.dataSent ?? null,
    sandbox: raw.sandbox ?? null,
  }
}

export const fetchKyc = () => call<Partial<KycState>>('/').then(normalize)
export const startKyc = (kind: KycKind) => call<Partial<KycState>>('/start', { method: 'POST', body: { kind } }).then(normalize)
export const sendKycData = (form: KycForm, kind: KycKind) => call<Partial<KycState>>('/data', { method: 'POST', body: buildKycPayload(form, kind) }).then(normalize)
export const confirmRegulationsAccepted = () =>
  acceptRegulationsIdempotent(() => call<Partial<KycState>>('/regulations-accepted', { method: 'POST' }), () => call<Partial<KycState>>('/')).then(normalize)
export const refreshKyc = () => call<Partial<KycState>>('/refresh', { method: 'POST' }).then(normalize)
export const completeKyc = () => call<Partial<KycState>>('/complete', { method: 'POST' }).then(normalize)

/** Dokument: `type` to kod z documentsRequested (np. ID_CARD); tył i data ważności tylko dla dokumentów tożsamości. */
export function uploadKycDocument(type: string, file: File, opts: { fileBack?: File | null; expireDate?: string } = {}) {
  const form = new FormData()
  form.append('type', type)
  form.append('file', file)
  if (opts.fileBack) form.append('fileBack', opts.fileBack)
  if (opts.expireDate) form.append('expireDate', opts.expireDate)
  return call<Partial<KycState>>('/documents', { method: 'POST', form }).then(normalize)
}
