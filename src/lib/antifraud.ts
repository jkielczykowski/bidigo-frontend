/** Anti-fraud (V90–V93): pure helpers — parsing of the database answers and the texts the user sees. No React, no network. */

export type AfLevel = 'none' | 'warning' | 'warning_block_risk' | 'blocked'

export type AfStatusName =
  | 'INCIDENT_DETECTED'
  | 'AWAITING_EXPLANATION'
  | 'UNDER_REVIEW'
  | 'VIOLATION_CONFIRMED'
  | 'VIOLATION_DISMISSED'
  | 'APPEALED'
  | 'APPEAL_ACCEPTED'
  | 'APPEAL_REJECTED'

export type AfIncident = {
  id: string
  event_type: string
  event_label: string
  status: AfStatusName
  auction_id: string
  auction_title: string | null
  created_at: string
  explanation_deadline: string | null
  can_explain: boolean
  user_explanation: string | null
  decision_reason: string | null
  strike_number: number | null
  action_taken: 'warning' | 'warning_block_risk' | 'block' | null
  appeal_deadline: string | null
  can_appeal: boolean
  appeal_text: string | null
  appeal_decision_reason: string | null
}

export type AfRating = {
  id: string
  incident_id: string
  auction_id: string
  is_system: boolean
  reason_label: string
  created_at: string
  revoked_at: string | null
}

/** public.my_antifraud_status() */
export type AfStatus = {
  enabled: boolean
  threshold: number
  window_months: number
  explanation_days: number
  appeal_days: number
  strikes: number
  blocked: boolean
  blocked_since: string | null
  level: AfLevel
  incidents: AfIncident[]
  ratings: AfRating[]
}

export const AF_EXPLANATION_MIN = 10
export const AF_APPEAL_MIN = 20
export const AF_TEXT_MAX = 2000

const STATUS_LABEL: Record<AfStatusName, string> = {
  INCIDENT_DETECTED: 'Zgłoszone',
  AWAITING_EXPLANATION: 'Czeka na Twoje wyjaśnienia',
  UNDER_REVIEW: 'W trakcie weryfikacji',
  VIOLATION_CONFIRMED: 'Naruszenie potwierdzone',
  VIOLATION_DISMISSED: 'Oddalone — bez naliczenia',
  APPEALED: 'Odwołanie w rozpatrzeniu',
  APPEAL_ACCEPTED: 'Odwołanie uwzględnione',
  APPEAL_REJECTED: 'Odwołanie odrzucone',
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as AfStatusName] ?? status
}

/** The errors raised by the database block (bids, listings) carry this hint */
export function isAccountBlockedError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { hint?: string }).hint === 'account_blocked'
}

/**
 * Answer of rpc('antifraud_signup_precheck'). true = go on, false = refuse WITHOUT saying why (the caller shows the
 * ordinary "could not create the account" text), null = unusable answer (sign-up goes on, the database is the hard stop).
 */
export function parsePrecheck(data: unknown): boolean | null {
  const row = Array.isArray(data) ? data[0] : data
  if (typeof row !== 'object' || row === null) return null
  const allowed = (row as { allowed?: unknown }).allowed
  return typeof allowed === 'boolean' ? allowed : null
}

const LEVELS: AfLevel[] = ['none', 'warning', 'warning_block_risk', 'blocked']

/** Defensive parse of my_antifraud_status(); null when it is not that shape */
export function parseAfStatus(data: unknown): AfStatus | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (typeof d.threshold !== 'number' || typeof d.strikes !== 'number' || typeof d.blocked !== 'boolean') return null
  const level = LEVELS.includes(d.level as AfLevel) ? (d.level as AfLevel) : 'none'
  return {
    enabled: d.enabled !== false,
    threshold: d.threshold,
    window_months: typeof d.window_months === 'number' ? d.window_months : 12,
    explanation_days: typeof d.explanation_days === 'number' ? d.explanation_days : 3,
    appeal_days: typeof d.appeal_days === 'number' ? d.appeal_days : 14,
    strikes: d.strikes,
    blocked: d.blocked,
    blocked_since: typeof d.blocked_since === 'string' ? d.blocked_since : null,
    level,
    incidents: Array.isArray(d.incidents) ? (d.incidents as AfIncident[]) : [],
    ratings: Array.isArray(d.ratings) ? (d.ratings as AfRating[]) : [],
  }
}

/** "1/3" */
export function strikeLabel(strikes: number, threshold: number): string {
  return `${Math.min(strikes, threshold)}/${threshold}`
}

export type AfNotice = { kind: 'warning' | 'risk' | 'blocked'; title: string; body: string }

/** The banner text for a warning (n/N), the risk of a block (N-1/N) or the block; null when there is nothing to say */
export function afNotice(s: AfStatus | null): AfNotice | null {
  if (!s || (!s.enabled && !s.blocked)) return null
  const n = strikeLabel(s.strikes, s.threshold)
  if (s.level === 'blocked') {
    return {
      kind: 'blocked',
      title: `Konto zablokowane (${n})`,
      body: 'Nie możesz licytować, kupować ani wystawiać aukcji. Możesz się odwołać i sprawdzić szczegóły.',
    }
  }
  if (s.level === 'warning_block_risk') {
    return {
      kind: 'risk',
      title: `Ostrzeżenie ${n} — grozi blokada konta`,
      body: `Masz ${s.strikes} potwierdzone naruszenia z ${s.threshold} dopuszczalnych w ciągu ${s.window_months} mies. Kolejne zablokuje licytowanie i konto.`,
    }
  }
  if (s.level === 'warning') {
    return {
      kind: 'warning',
      title: `Ostrzeżenie ${n} — negatywna ocena systemowa`,
      body: `Potwierdzono naruszenie zasad transakcji. Po ${s.threshold}. naruszeniu w ciągu ${s.window_months} mies. konto zostanie zablokowane.`,
    }
  }
  return null
}

/** Incidents the user still has to answer */
export function awaitingExplanation(s: AfStatus | null): AfIncident[] {
  return s ? s.incidents.filter((i) => i.can_explain) : []
}

export function explanationProblem(text: string): string | null {
  const t = text.trim()
  if (t.length < AF_EXPLANATION_MIN) return `Wyjaśnienie: min. ${AF_EXPLANATION_MIN} znaków`
  if (t.length > AF_TEXT_MAX) return `Wyjaśnienie: maks. ${AF_TEXT_MAX} znaków`
  return null
}

export function appealProblem(text: string): string | null {
  const t = text.trim()
  if (t.length < AF_APPEAL_MIN) return `Odwołanie: min. ${AF_APPEAL_MIN} znaków`
  if (t.length > AF_TEXT_MAX) return `Odwołanie: maks. ${AF_TEXT_MAX} znaków`
  return null
}

/** Whole days left until a deadline (0 = today / passed) */
export function daysLeft(iso: string | null, now: Date = new Date()): number {
  if (!iso) return 0
  const ms = new Date(iso).getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000)
}
