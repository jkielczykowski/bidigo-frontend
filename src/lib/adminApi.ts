import { supabase } from './supabase'

// Admin panel RPCs (bidigo-backend V39__admin_panel.sql). Each one checks is_admin in the database,
// so a non-admin gets an error, never data.

/** paid | pending (do zapłaty) | overdue (zaległa, konto zablokowane) | cancelled (anulowana/umorzona) */
export type FeeState = 'paid' | 'pending' | 'overdue' | 'cancelled'

export type AdminPage<T> = { total: number; total_amount?: number; items: T[] }

export type AdminUser = {
  id: string
  username: string | null
  display_name: string | null
  email: string | null
  phone: string | null
  phone_verified: boolean
  is_admin: boolean
  created_at: string
  auction_count: number
  sold_count: number
  pending_amount: number
  overdue_amount: number
  paid_amount: number
  blocked: boolean
}

export type AdminFee = {
  id: string
  auction_id: string
  auction_title: string | null
  seller_id: string
  seller_name: string | null
  seller_email: string | null
  sale_price: number
  fee_percent: number
  fee_amount: number
  state: FeeState
  created_at: string
  due_at: string | null
  paid_at: string | null
  settlement_id: string | null
  settlement_number: string | null
  payment_intent_id: string | null
  checkout_session_id: string | null
}

export type AdminSettlement = {
  id: string
  number: string
  reason: 'threshold' | 'monthly' | 'on_request'
  seller_id: string
  seller_name: string | null
  seller_email: string | null
  amount: number
  fee_count: number
  state: FeeState
  issued_at: string
  due_at: string
  paid_at: string | null
  payment_intent_id: string | null
  checkout_session_id: string | null
}

export type AdminUserDetail = Omit<AdminUser, 'sold_count'> & {
  city: string | null
  phone_verified_at: string | null
  last_sign_in_at: string | null
  rating_avg: number
  rating_count: number
  auctions: {
    id: string
    title: string
    status: string
    moderation_status: string
    current_price: number
    bid_count: number
    created_at: string
    ends_at: string
  }[]
  fees: (Pick<AdminFee, 'id' | 'auction_id' | 'auction_title' | 'sale_price' | 'fee_percent' | 'fee_amount' | 'state' | 'created_at' | 'due_at' | 'paid_at' | 'settlement_number' | 'payment_intent_id'>)[]
  settlements: (Pick<AdminSettlement, 'id' | 'number' | 'reason' | 'amount' | 'fee_count' | 'state' | 'issued_at' | 'due_at' | 'paid_at' | 'payment_intent_id'>)[]
}

export type AdminSummary = {
  since: string | null
  grain: 'day' | 'month'
  payments_count: number
  paid_fee_count: number
  paid_amount: number
  issued_count: number
  issued_amount: number
  settlements_issued: number
  pending_count: number
  pending_amount: number
  overdue_count: number
  overdue_amount: number
  blocked_users: number
  users_total: number
  users_new: number
  series: { bucket: string; paid_amount: number; payments: number; issued_amount: number }[]
}

export type FeeFilters = {
  state?: FeeState | null
  from?: string | null
  to?: string | null
  userId?: string | null
  query?: string | null
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const PAGE_SIZE = 25

export function adminUsers(query: string, page: number, blockedOnly = false) {
  return rpc<AdminPage<AdminUser>>('admin_users', {
    p_query: query || null,
    p_blocked: blockedOnly || null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  })
}

export function adminUserDetail(id: string) {
  return rpc<AdminUserDetail | null>('admin_user_detail', { p_user_id: id })
}

function feeArgs(f: FeeFilters, page: number) {
  return {
    p_state: f.state || null,
    p_from: f.from || null,
    p_to: f.to || null,
    p_user_id: f.userId || null,
    p_query: f.query || null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  }
}

export function adminFees(f: FeeFilters, page: number) {
  return rpc<AdminPage<AdminFee>>('admin_fees', feeArgs(f, page))
}

export function adminSettlements(f: FeeFilters, page: number) {
  return rpc<AdminPage<AdminSettlement>>('admin_settlements', feeArgs(f, page))
}

export type SummaryPeriod = 'today' | '7d' | '30d' | 'all'

export const PERIODS: { id: SummaryPeriod; label: string }[] = [
  { id: 'today', label: 'Dziś' },
  { id: '7d', label: '7 dni' },
  { id: '30d', label: '30 dni' },
  { id: 'all', label: 'Wszystko' },
]

/** Start of the period: midnight in Poland for "today", N×24 h back otherwise */
export function periodStart(period: SummaryPeriod, now = new Date()): string | null {
  if (period === 'all') return null
  if (period === 'today') {
    const day = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' })
    // Warsaw offset at this moment: compare the same instant rendered in both zones
    const warsaw = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }))
    const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
    const offsetMin = Math.round((warsaw.getTime() - utc.getTime()) / 60_000)
    return new Date(Date.parse(`${day}T00:00:00Z`) - offsetMin * 60_000).toISOString()
  }
  const days = period === '7d' ? 7 : 30
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

export function adminSummary(period: SummaryPeriod) {
  return rpc<AdminSummary>('admin_fee_summary', { p_since: periodStart(period) })
}

export const STATE_LABEL: Record<FeeState, string> = {
  paid: 'Opłacona',
  pending: 'Do zapłaty',
  overdue: 'Zaległa',
  cancelled: 'Anulowana',
}

export const REASON_LABEL: Record<AdminSettlement['reason'], string> = {
  threshold: 'Próg 20 zł',
  monthly: 'Miesięczne',
  on_request: 'Na żądanie',
}

export function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/** "1 prowizja", "3 prowizje", "5 prowizji" */
export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (n === 1) return `${n} ${one}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

export function userName(u: { display_name: string | null; username: string | null }) {
  return u.display_name || u.username || 'Bez nazwy'
}
