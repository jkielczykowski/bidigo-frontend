/** Pure helpers of the account flows (confirmation e-mail, password reset, e-mail change) */

/** Supabase limits confirmation e-mails per address; the button waits this long between sends */
export const RESEND_COOLDOWN_S = 60

export const PASSWORD_MIN_LENGTH = 8

type AuthErrorLike = { code?: unknown; status?: unknown; message?: unknown; name?: unknown }

function parts(err: unknown) {
  const e = (typeof err === 'object' && err !== null ? err : {}) as AuthErrorLike
  return {
    code: typeof e.code === 'string' ? e.code : '',
    status: typeof e.status === 'number' ? e.status : 0,
    message: typeof e.message === 'string' ? e.message : '',
    name: typeof e.name === 'string' ? e.name : '',
  }
}

export function isEmailNotConfirmed(err: unknown) {
  const { code, message } = parts(err)
  return code === 'email_not_confirmed' || /email not confirmed/i.test(message)
}

export function isUserExists(err: unknown) {
  const { code } = parts(err)
  return code === 'user_already_exists' || code === 'email_exists'
}

export const EMAIL_TAKEN_MESSAGE = 'Ten adres e-mail jest już zajęty. Zaloguj się lub zresetuj hasło.'
/** Any server-side failure of sign-up (5xx / "Database error…"): never show Supabase's English text */
export const SIGNUP_FAILED_MESSAGE =
  'Nie udało się założyć konta. Spróbuj ponownie za chwilę. Jeśli błąd się powtarza, napisz na kontakt@bidigo.pl.'
/** A number already confirmed by SMS on another account (request_phone_otp / claim_phone_verification, V52) */
export const PHONE_CONFIRMED_ELSEWHERE_MESSAGE = 'Ten numer telefonu jest już potwierdzony na innym koncie.'

/** Row of rpc('signup_availability') → emailTaken; null when the answer is unusable (sign-up then goes on without the check) */
export function parseAvailability(data: unknown): { emailTaken: boolean } | null {
  const row = Array.isArray(data) ? data[0] : data
  if (typeof row !== 'object' || row === null) return null
  const taken = (row as { email_taken?: unknown }).email_taken
  return typeof taken === 'boolean' ? { emailTaken: taken } : null
}

/** Server-side failure (HTTP 5xx, e.g. unexpected_failure) */
export function isServerError(err: unknown) {
  const { code, status } = parts(err)
  return status >= 500 || code === 'unexpected_failure'
}

export function isRateLimited(err: unknown) {
  const { code, status, message } = parts(err)
  return status === 429 || /rate_limit/.test(code) || /rate limit|too many requests/i.test(message)
}

/** Polish text for the auth errors we expect; null for anything else (caller picks a fallback) */
export function knownAuthError(err: unknown): string | null {
  const { code, name } = parts(err)
  if (isRateLimited(err)) {
    return 'Zbyt wiele prób w krótkim czasie. Odczekaj minutę i spróbuj ponownie.'
  }
  if (isEmailNotConfirmed(err)) {
    return 'Ten adres e-mail nie został jeszcze potwierdzony. Kliknij link w wiadomości, którą wysłaliśmy.'
  }
  if (name === 'AuthRetryableFetchError') return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.'
  switch (code) {
    case 'invalid_credentials':
      return 'Nieprawidłowy e-mail lub hasło'
    case 'weak_password':
      return `Hasło jest zbyt słabe — użyj min. ${PASSWORD_MIN_LENGTH} znaków, w tym liter i cyfr.`
    case 'same_password':
      return 'Nowe hasło musi być inne niż obecne.'
    case 'email_exists':
    case 'user_already_exists':
      return 'Ten adres e-mail jest już używany.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Podaj prawidłowy adres e-mail.'
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return 'Link wygasł lub został już użyty.'
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'user_not_found':
      return 'Sesja wygasła. Zaloguj się ponownie.'
    case 'reauthentication_needed':
      return 'Ze względów bezpieczeństwa zaloguj się ponownie i spróbuj jeszcze raz.'
    default:
      return null
  }
}

/** First problem with a new password (Polish), or null when it is acceptable */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Hasło min. ${PASSWORD_MIN_LENGTH} znaków`
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Hasło musi zawierać literę i cyfrę'
  return null
}

export function isPlausibleEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

/** What the link in a Supabase e-mail left in the URL (parsed once, before supabase-js clears the hash) */
export type AuthLanding = {
  type: string | null
  errorCode: string | null
  /** Supabase's note after the first of two e-mail-change confirmations */
  message: string | null
}

export function parseAuthLanding(hash: string, search = ''): AuthLanding {
  const h = new URLSearchParams(hash.replace(/^#/, ''))
  const q = new URLSearchParams(search)
  const get = (k: string) => h.get(k) ?? q.get(k)
  return {
    type: get('type'),
    errorCode: get('error_code') ?? (get('error') ? 'unknown' : null),
    message: get('message'),
  }
}

/** Evaluated when the app starts — supabase-js strips the hash right after */
export const landing: AuthLanding =
  typeof window === 'undefined' ? { type: null, errorCode: null, message: null } : parseAuthLanding(window.location.hash, window.location.search)

/** True when Supabase says the other address of a double-confirmed e-mail change still has to be confirmed */
export function awaitsSecondConfirmation(message: string | null) {
  return Boolean(message && /other email/i.test(message))
}
