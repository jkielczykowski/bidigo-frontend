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

/** One neutral text for a taken e-mail and a taken phone — sign-up must not reveal which one exists */
export const ACCOUNT_EXISTS_MESSAGE =
  'Konto z tym adresem e-mail lub numerem telefonu już istnieje. Zaloguj się albo zresetuj hasło. Jeśli to nie ty, napisz na kontakt@bidigo.pl.'

/** Sign-up refused because the e-mail or the phone (profiles_phone_unique) is already used */
export function isAccountExists(err: unknown) {
  const { message } = parts(err)
  return (
    isUserExists(err) ||
    /user already registered|database error saving new user|profiles_phone_unique|duplicate key.*phone/i.test(message)
  )
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
