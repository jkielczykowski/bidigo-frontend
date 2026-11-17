import { ApiError } from './bidigoApi'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { ParcelSize, SenderForm, Shipment, ShippingConfig } from './shippingModel.ts'

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
export const getSender = async () => (await call('GET', '/shipping/sender')).json() as Promise<SenderForm>
export const saveSender = async (b: { firstName: string; lastName: string; company: string }) =>
  (await call('PUT', '/shipping/sender', b)).json() as Promise<SenderForm>
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

// ---------------------------------------------------------------- one status for the whole UI

let cached: Promise<ShippingConfig> | null = null

/** Read once per page load (the backend decides; a switch flipped in the admin panel shows after a refresh). */
export function loadShippingConfig(): Promise<ShippingConfig> {
  cached ??= shippingConfig().catch((e) => {
    cached = null
    throw e
  })
  return cached
}

/**
 * Everything that shows shipments depends on this: `visible` = the switch is on (tile, routes, the "InPost" option),
 * `ready` = a buyer may pay for a delivery. Until it is known, and when it cannot be read, nothing is shown.
 */
export function useShippingStatus(signedIn: boolean) {
  const [config, setConfig] = useState<ShippingConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!signedIn) return
    let alive = true
    loadShippingConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => alive && setConfig(null))
      .finally(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [signedIn])
  return { config, loaded, visible: config?.flagEnabled === true, ready: config?.carrierReady === true, sandbox: config?.sandbox === true }
}
