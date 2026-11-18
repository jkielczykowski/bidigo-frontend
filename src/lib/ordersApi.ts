import { supabase } from './supabase'
import { ApiError } from './bidigoApi'
import { useEffect, useState } from 'react'
import type { LockerMap, Order, Quote } from './ordersLogic'
import { checkoutErrorText } from './checkout'

// Reads and actions go straight to the database functions (rpc): the database owns the rules and the permissions.
// Only the payment (PayU: redirect to the PayU page) needs bidigo-api.

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const fetchQuote = (auctionId: string, price?: number | null) =>
  rpc<Quote | null>('order_quote', { p_auction_id: auctionId, p_price: price ?? null })

/** Limit ceny Ochrony (zł) albo null = bez limitu; publiczny, tylko do komunikatu „Ochrona obejmuje zakupy do X zł”. */
export const fetchProtectionPriceLimit = async () => {
  const v = await rpc<number | string | null>('protection_price_limit')
  return v == null ? null : Number(v)
}

export const fetchMyOrders = (role: 'buyer' | 'seller', limit = 30, offset = 0) =>
  rpc<Order[]>('my_orders', { p_role: role, p_limit: limit, p_offset: offset })

export const fetchOrder = (id: string) => rpc<Order>('order_get', { p_order_id: id })
export const fetchOrderForAuction = (auctionId: string) => rpc<Order | null>('order_for_auction', { p_auction_id: auctionId })

export const chooseDirect = (id: string) => rpc<Order>('order_choose_direct', { p_order_id: id })
export const cancelOrder = (id: string, reason: string) => rpc<Order>('order_cancel', { p_order_id: id, p_reason: reason })
export const markShipped = (id: string, tracking: string | null) => rpc<Order>('order_mark_shipped', { p_order_id: id, p_tracking: tracking })
export const confirmReceipt = (id: string) => rpc<Order>('order_confirm_receipt', { p_order_id: id })
export const reportProblem = (id: string, kind: string, description: string) =>
  rpc<Order>('order_report_problem', { p_order_id: id, p_kind: kind, p_description: description })
export const respondDispute = (id: string, response: string) => rpc<Order>('order_dispute_respond', { p_order_id: id, p_response: response })

export type CheckoutResult = { status: 'ok'; checkoutUrl: string } | { status: 'total_changed'; total: number }

/** Opens (or reuses) the payment page. 409 total_changed = the cost changed since the buyer saw it: show the new one and ask again. */
export async function startOrderCheckout(orderId: string, expectedTotal: number): Promise<CheckoutResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`/api/v1/orders/${orderId}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ expectedTotal }),
  })
  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as { status?: string; total?: number }
    if (body.status === 'total_changed' && typeof body.total === 'number') return { status: 'total_changed', total: body.total }
    throw new ApiError(409, 'Ochrona nie jest już dostępna dla tego zamówienia')
  }
  if (!res.ok) throw new ApiError(res.status, checkoutErrorText(res.status))
  const body = (await res.json()) as { checkoutUrl: string }
  return { status: 'ok', checkoutUrl: body.checkoutUrl }
}

export type PayuStatus = { provider: 'payu'; ready: boolean; testMode: boolean; marketplaceEnabled?: boolean; reason: string }

/** Whether buyers can pay through PayU right now, and whether it is the sandbox (test money). Public, no secrets. */
export async function fetchPayuStatus(): Promise<PayuStatus> {
  const res = await fetch('/api/v1/payments/payu/status')
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return (await res.json()) as PayuStatus
}

/** The seller's own PayU account state ("konto PayU do połączenia"), from the database function. */
export const fetchMyPayuAccount = () => rpc<import('./payuReturn').SellerPayuAccount>('my_payu_account')

/** SANDBOX only: connects a test PayU recipient for the seller (in production PayU verifies sellers; the server answers 403). */
export async function connectPayuSandbox(): Promise<{ status: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch('/api/v1/payments/payu/seller/connect-sandbox', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return (await res.json()) as { status: string }
}

export type CheckoutState = {
  role: 'buyer' | 'seller' | 'admin'
  delivery: { lockerCode: string; lockerName: string | null; phone?: string | null } | null
  termsAcceptedAt: string | null
  termsVersion: string
  reportWindowHours: number | null
  paymentWindowHours: number | null
  payout: { status: string; amount: number; completedAt: string | null } | null
  sellerReceives: number
  parcelSize: string | null
}

export const fetchCheckoutState = (orderId: string) => rpc<CheckoutState>('order_checkout_state', { p_order_id: orderId })
export const setOrderDelivery = (orderId: string, code: string, name: string | null, phone: string) =>
  rpc<{ lockerCode: string }>('order_set_delivery', { p_order_id: orderId, p_locker_code: code, p_locker_name: name, p_phone: phone })
export const acceptOrderTerms = (orderId: string, version: string) => rpc<{ acceptedAt: string }>('order_accept_terms', { p_order_id: orderId, p_version: version })

let lockerMapPromise: Promise<LockerMap> | null = null

/** Mapa „kategoria → czy dopuszcza Paczkomat” (po dziedziczeniu), z backendu; jedno pobranie na wczytanie strony. */
export function loadLockerMap(): Promise<LockerMap> {
  if (!lockerMapPromise) {
    lockerMapPromise = rpc<LockerMap>('categories_locker_map').catch((e) => {
      lockerMapPromise = null
      throw e
    })
  }
  return lockerMapPromise
}

/** null while loading (or when it cannot be loaded): callers then show no Paczkomat buttons — the backend refuses them anyway. */
export function useLockerMap(): LockerMap | null {
  const [map, setMap] = useState<LockerMap | null>(null)
  useEffect(() => {
    let alive = true
    loadLockerMap().then((m) => alive && setMap(m)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return map
}

export const fetchAuctionLockerAllowed = (auctionId: string) => rpc<boolean>('auction_locker_allowed', { p_auction_id: auctionId })
