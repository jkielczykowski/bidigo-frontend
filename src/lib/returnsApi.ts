import { supabase } from './supabase'
import { ApiError } from './bidigoApi'
import type { ReturnInfo } from './returns.ts'

// bidigo-api: /api/v1/orders/{orderId}/return (JWT). Reguły i uprawnienia pilnuje serwer.

async function call(method: string, orderId: string, suffix = '', body?: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`/api/v1/orders/${orderId}/return${suffix}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, returnErrorText(res.status, text))
  }
  return res
}

/** Komunikat po polsku: serwer przy 409/422 podaje własny tekst (message), inaczej zwykły opis. */
export function returnErrorText(status: number, bodyText: string): string {
  try {
    const m = (JSON.parse(bodyText) as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  } catch { /* nie JSON */ }
  if (status === 409) return 'Zwrotu nie można teraz zgłosić (minęło okno zwrotu albo zamówienie jest w innym stanie).'
  if (status === 422) return 'Sprawdź dane zgłoszenia zwrotu.'
  if (status === 403) return 'Nie masz uprawnień do tej operacji.'
  return 'Nie udało się wykonać operacji na zwrocie.'
}

export async function fetchReturn(orderId: string): Promise<ReturnInfo | null> {
  try {
    return (await (await call('GET', orderId)).json()) as ReturnInfo
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export const requestReturn = async (orderId: string, reason: string, note: string) =>
  (await (await call('POST', orderId, '', { reason, ...(note.trim() ? { note: note.trim() } : {}) })).json()) as ReturnInfo

export const confirmReturnReceived = async (orderId: string) => (await call('POST', orderId, '/received')).json() as Promise<ReturnInfo>

export const disputeReturn = async (orderId: string, description: string) =>
  (await call('POST', orderId, '/dispute', { description })).json() as Promise<ReturnInfo>

/** List zwrotny wymaga nagłówka logowania, więc PDF idzie przez pamięć (blob), nigdy przez link. */
export async function downloadReturnLabel(orderId: string): Promise<void> {
  const res = await call('GET', orderId, '/label')
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = 'list-zwrotny.pdf'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
