import { supabase } from './supabase'

// bidigo-api (Java, bidigo-backend/api): same origin under /api/v1 — nginx in production,
// the Vite proxy (BIDIGO_API_URL) in development.

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

/** Opens (or reuses) a Stripe Checkout session paying one of the user's pending fee settlements. */
export function startSettlementCheckout(settlementId: string) {
  return post<{ checkoutUrl: string; expiresAt?: string }>(`/fee-settlements/${settlementId}/checkout`)
}

/** Buys a promotion package for one of the user's live auctions: opens (or reuses) a Stripe Checkout. */
export function startPromotionCheckout(auctionId: string, packageId: string) {
  return post<{ promotionId: string; checkoutUrl: string; expiresAt?: string }>(`/auctions/${auctionId}/promotions`, {
    packageId,
  })
}
