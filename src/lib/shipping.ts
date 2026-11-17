import { ApiError } from './bidigoApi'
import { supabase } from './supabase'
import type { ParcelSize, Shipment, ShippingConfig } from './shippingModel.ts'

export * from './shippingModel.ts'

// Przesyłki InPost: bidigo-api /api/v1/shipments (płatność, etykieta i ShipX żyją na serwerze, tu nie ma żadnych sekretów).

// ---------------------------------------------------------------- API

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return res
}

export const shippingConfig = async () => (await call('GET', '/shipping/config')).json() as Promise<ShippingConfig>
export const listShipments = async (role: 'buyer' | 'seller') => (await call('GET', `/shipments?role=${role}`)).json() as Promise<Shipment[]>
export const shipmentByOrder = async (orderId: string) => (await call('GET', `/shipments/by-order/${orderId}`)).json() as Promise<Shipment>
export const openShipment = async (b: { orderId: string; lockerCode: string; lockerName?: string; phone: string; size: ParcelSize; protection: boolean }) =>
  (await call('POST', '/shipments', b)).json() as Promise<Shipment>
export const renewShipmentPayment = async (id: string) => (await call('POST', `/shipments/${id}/pay`)).json() as Promise<Shipment>
export const cancelShipment = async (id: string) => (await call('POST', `/shipments/${id}/cancel`)).json() as Promise<Shipment>

/** The label needs the login header, so it is fetched as a blob and saved from memory, never put in a link. */
export async function downloadLabel(id: string): Promise<void> {
  const res = await call('GET', `/shipments/${id}/label`)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = 'etykieta-inpost.pdf'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** User-facing text for a failed shipping call. */
export function shippingError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400: return 'Sprawdź kod Paczkomatu i numer telefonu (9 cyfr).'
      case 403: return 'To nie jest Twoja przesyłka.'
      case 404: return 'Nie znaleziono przesyłki.'
      case 409: return 'Tej operacji nie można teraz wykonać.'
      case 502: return 'InPost lub płatności są chwilowo niedostępne. Spróbuj za chwilę.'
      case 503: return 'Wysyłka InPost nie jest jeszcze włączona.'
    }
  }
  return 'Coś poszło nie tak. Spróbuj ponownie.'
}
