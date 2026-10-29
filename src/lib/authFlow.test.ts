import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  awaitsSecondConfirmation,
  isEmailNotConfirmed,
  isPlausibleEmail,
  isRateLimited,
  isServerError,
  isInvalidCredentials,
  isUserExists,
  passwordChangeProblem,
  parseAvailability,
  SIGNUP_FAILED_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  PHONE_CONFIRMED_ELSEWHERE_MESSAGE,
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

test('odpowiedź signup_availability: wiersz, tablica, śmieci', () => {
  assert.deepEqual(parseAvailability([{ email_taken: true }]), { emailTaken: true })
  assert.deepEqual(parseAvailability({ email_taken: false }), { emailTaken: false })
  assert.equal(parseAvailability([]), null)
  assert.equal(parseAvailability(null), null)
  assert.equal(parseAvailability([{ email_taken: 'tak' }]), null)
  assert.match(EMAIL_TAKEN_MESSAGE, /adres e-mail jest już zajęty/)
  assert.match(PHONE_CONFIRMED_ELSEWHERE_MESSAGE, /potwierdzony na innym koncie/)
})

test('błąd 500 z signUp (prawdziwy kształt: AuthRetryableFetchError, status 500, bez kodu)', () => {
  const real = { name: 'AuthRetryableFetchError', message: 'Database error saving new user', status: 500 }
  assert.equal(isServerError(real), true)
  assert.equal(isServerError({ code: 'unexpected_failure', message: 'x' }), true)
  assert.equal(isServerError({ status: 422, code: 'user_already_exists' }), false)
  assert.equal(isServerError({ status: 429 }), false)
  assert.doesNotMatch(SIGNUP_FAILED_MESSAGE, /Database error/)
})

test('zmiana hasła: kolejność walidacji', () => {
  assert.equal(passwordChangeProblem('', 'Nowe12345', 'Nowe12345'), 'Podaj obecne hasło')
  assert.match(passwordChangeProblem('Stare1234', 'krotkie', 'krotkie') ?? '', /min\. 8/)
  assert.equal(passwordChangeProblem('Stare1234', 'Stare1234', 'Stare1234'), 'Nowe hasło musi być inne niż obecne')
  assert.equal(passwordChangeProblem('Stare1234', 'Nowe12345', 'Inne12345'), 'Hasła nie są takie same')
  assert.equal(passwordChangeProblem('Stare1234', 'Nowe12345', 'Nowe12345'), null)
})

test('błędne obecne hasło i wymóg ponownego uwierzytelnienia', () => {
  assert.equal(isInvalidCredentials({ code: 'invalid_credentials' }), true)
  assert.equal(isInvalidCredentials({ message: 'Invalid login credentials' }), true)
  assert.equal(isInvalidCredentials({ code: 'same_password' }), false)
  assert.match(knownAuthError({ code: 'reauthentication_needed' }) ?? '', /zaloguj się ponownie/)
  assert.match(knownAuthError({ code: 'same_password' }) ?? '', /inne niż obecne/)
})
