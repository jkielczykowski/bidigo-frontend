import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  awaitsSecondConfirmation,
  isEmailNotConfirmed,
  isPlausibleEmail,
  isRateLimited,
  ACCOUNT_EXISTS_MESSAGE,
  isAccountExists,
  isServerError,
  isUserExists,
  parseAvailability,
  SIGNUP_FAILED_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  PHONE_TAKEN_MESSAGE,
  knownAuthError,
  parseAuthLanding,
  passwordProblem,
} from './authFlow.ts'

test('niepotwierdzony adres rozpoznawany po kodzie i po treści', () => {
  assert.equal(isEmailNotConfirmed({ code: 'email_not_confirmed', status: 400 }), true)
  assert.equal(isEmailNotConfirmed({ message: 'Email not confirmed' }), true)
  assert.equal(isEmailNotConfirmed({ code: 'invalid_credentials' }), false)
  assert.match(knownAuthError({ code: 'email_not_confirmed' }) ?? '', /nie został jeszcze potwierdzony/)
})

test('limit zapytań (429) po statusie, kodzie i treści', () => {
  assert.equal(isRateLimited({ status: 429 }), true)
  assert.equal(isRateLimited({ code: 'over_email_send_rate_limit' }), true)
  assert.equal(isRateLimited({ message: 'email rate limit exceeded' }), true)
  assert.equal(isRateLimited(new Error('boom')), false)
  assert.match(knownAuthError({ status: 429 }) ?? '', /Zbyt wiele prób/)
})

test('nieznany błąd nie jest tłumaczony, null i dziwne wartości nie wybuchają', () => {
  assert.equal(knownAuthError({ code: 'something_new', message: 'x' }), null)
  assert.equal(knownAuthError(null), null)
  assert.equal(knownAuthError('tekst'), null)
  assert.equal(knownAuthError({ code: 'invalid_credentials' }), 'Nieprawidłowy e-mail lub hasło')
})

test('siła hasła: długość, litera i cyfra', () => {
  assert.match(passwordProblem('abc1') ?? '', /min\. 8/)
  assert.match(passwordProblem('abcdefghij') ?? '', /literę i cyfrę/)
  assert.match(passwordProblem('1234567890') ?? '', /literę i cyfrę/)
  assert.equal(passwordProblem('zażółć123'), null)
})

test('adres e-mail', () => {
  assert.equal(isPlausibleEmail('jan@bidigo.pl'), true)
  assert.equal(isPlausibleEmail('jan@bidigo'), false)
  assert.equal(isPlausibleEmail('jan bidigo.pl'), false)
})

test('parametry linku z maila', () => {
  assert.deepEqual(parseAuthLanding('#access_token=a&type=recovery'), { type: 'recovery', errorCode: null, message: null })
  assert.equal(parseAuthLanding('#error=access_denied&error_code=otp_expired').errorCode, 'otp_expired')
  assert.equal(parseAuthLanding('#error=access_denied').errorCode, 'unknown')
  assert.equal(parseAuthLanding('', '?type=signup').type, 'signup')
  const msg = parseAuthLanding('#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email').message
  assert.equal(awaitsSecondConfirmation(msg), true)
  assert.equal(awaitsSecondConfirmation(null), false)
})

test('konto z tym adresem już istnieje', () => {
  assert.equal(isUserExists({ code: 'user_already_exists' }), true)
  assert.equal(isUserExists({ code: 'email_exists' }), true)
  assert.equal(isUserExists({ code: 'weak_password' }), false)
})

test('zajęty e-mail i zajęty telefon dają ten sam komunikat (nie zdradzamy, co istnieje)', () => {
  const taken = [
    { code: 'user_already_exists', status: 422, message: 'User already registered' },
    { message: 'User already registered' },
    { status: 500, message: 'Database error saving new user' },
    { message: 'duplicate key value violates unique constraint "profiles_phone_unique"' },
  ]
  for (const err of taken) assert.equal(isAccountExists(err), true)
  assert.match(ACCOUNT_EXISTS_MESSAGE, /adresem e-mail lub numerem telefonu już istnieje/)
  assert.match(ACCOUNT_EXISTS_MESSAGE, /kontakt@bidigo\.pl/)
  // rate limit and network errors stay separate
  assert.equal(isAccountExists({ status: 429, code: 'over_email_send_rate_limit' }), false)
  assert.equal(isAccountExists({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }), false)
})

test('odpowiedź signup_availability: wiersz, tablica, śmieci', () => {
  assert.deepEqual(parseAvailability([{ email_taken: true, phone_taken: false }]), { emailTaken: true, phoneTaken: false })
  assert.deepEqual(parseAvailability({ email_taken: false, phone_taken: true }), { emailTaken: false, phoneTaken: true })
  assert.equal(parseAvailability([]), null)
  assert.equal(parseAvailability(null), null)
  assert.equal(parseAvailability([{ email_taken: 'tak', phone_taken: false }]), null)
  assert.match(EMAIL_TAKEN_MESSAGE, /adres e-mail jest już zajęty/)
  assert.equal(PHONE_TAKEN_MESSAGE, 'Ten numer telefonu jest już zajęty.')
})

test('błąd 500 z signUp (prawdziwy kształt: AuthRetryableFetchError, status 500, bez kodu)', () => {
  const real = { name: 'AuthRetryableFetchError', message: 'Database error saving new user', status: 500 }
  assert.equal(isServerError(real), true)
  assert.equal(isServerError({ code: 'unexpected_failure', message: 'x' }), true)
  assert.equal(isServerError({ status: 422, code: 'user_already_exists' }), false)
  assert.equal(isServerError({ status: 429 }), false)
  assert.doesNotMatch(SIGNUP_FAILED_MESSAGE, /Database error/)
})
