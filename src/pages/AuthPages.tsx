import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ResendConfirmation } from '../components/ResendConfirmation'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  awaitsSecondConfirmation,
  isEmailNotConfirmed,
  isUserExists,
  isPlausibleEmail,
  knownAuthError,
  landing,
  passwordProblem,
  PASSWORD_MIN_LENGTH,
} from '../lib/authFlow'
import { isValidPlPhone, normalizePlPhone } from '../lib/phone'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setUnconfirmed(false)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setUnconfirmed(isEmailNotConfirmed(err))
      setError(knownAuthError(err) ?? (err instanceof Error ? err.message : 'Nie udało się zalogować'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container narrow page">
      <h1>Zaloguj się</h1>
      <p className="muted">Wejdź, żeby licytować i wystawiać aukcje.</p>
      <form className="card-form" onSubmit={onSubmit}>
        <label>
          <span className="label-text">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span className="label-text">Hasło</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Logowanie…' : 'Zaloguj'}
        </button>
      </form>
      {unconfirmed && <ResendConfirmation email={email.trim()} />}
      <p className="muted auth-notice">
        <Link to="/auth/zapomniane-haslo">Nie pamiętam hasła</Link>
      </p>
      <p className="muted">
        Nie masz konta? <Link to="/register">Zarejestruj się</Link>
      </p>
    </div>
  )
}

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!displayName.trim() || displayName.trim().length < 2) {
        throw new Error('Podaj nick (min. 2 znaki)')
      }
      if (!email.includes('@')) {
        throw new Error('Podaj prawidłowy email')
      }
      if (password.length < 6) {
        throw new Error('Hasło min. 6 znaków')
      }
      const normalized = normalizePlPhone(phone)
      if (!normalized || !isValidPlPhone(phone)) {
        throw new Error('Podaj prawidłowy numer telefonu (9 cyfr, np. 512 345 678)')
      }

      // Before the account exists: the database refuses a used number only as "Database error saving new user"
      const { data: taken } = await supabase.rpc('phone_taken', { p_phone: normalized })
      if (taken === true) throw new Error('Ten numer telefonu jest już używany. Zaloguj się lub podaj inny numer.')

      const { needsConfirmation } = await signUp(email.trim(), password, displayName.trim(), normalized)
      if (needsConfirmation) setSentTo(email.trim())
      else navigate('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nie udało się zarejestrować'
      if (/profiles_phone_unique|duplicate key.*phone/i.test(msg)) {
        setError('Ten numer telefonu jest już używany')
      } else if (/database error saving new user/i.test(msg)) {
        // Race with the pre-check, or any other failure of the profile insert
        setError('Nie udało się założyć konta. Sprawdź, czy numer telefonu nie jest już używany, i spróbuj ponownie.')
      } else if (isUserExists(err)) {
        setError('Konto z tym adresem e-mail już istnieje. Zaloguj się albo użyj „Nie pamiętam hasła”.')
      } else {
        setError(knownAuthError(err) ?? msg)
      }
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div className="container narrow page">
        <h1>Sprawdź skrzynkę</h1>
        <p role="status">
          Wysłaliśmy link potwierdzający na adres <strong>{sentTo}</strong>. Kliknij go, żeby aktywować konto.
        </p>
        <p className="muted">Nie widzisz wiadomości? Zajrzyj do folderu ze spamem albo wyślij ją jeszcze raz.</p>
        <ResendConfirmation email={sentTo} startCooling />
        <p className="muted auth-notice">
          Pomyłka w adresie? <button className="btn-link" type="button" onClick={() => setSentTo(null)}>Wróć do formularza</button>
        </p>
      </div>
    )
  }

  return (
    <div className="container narrow page">
      <h1>Dołącz do Bidigo</h1>

      <form className="card-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label>
          <span className="label-text">
            Nick / imię<span className="req"> *</span>
          </span>
          <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label>
          <span className="label-text">
            Email<span className="req"> *</span>
          </span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span className="label-text">
            Hasło<span className="req"> *</span>
          </span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          <span className="label-text">
            Numer telefonu<span className="req"> *</span>
          </span>
          <div className="phone-input-row">
            <span className="phone-prefix">+48</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              placeholder="512 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Tworzenie konta…' : 'Załóż konto'}
        </button>
      </form>

      <p className="muted">
        Masz już konto? <Link to="/login">Zaloguj się</Link>
      </p>
    </div>
  )
}

/** Landing of the confirmation link (sign-up and e-mail change) */
export function EmailConfirmedPage() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const changed = params.get('zmiana') === 'email'
  const failed = Boolean(landing.errorCode)
  const second = awaitsSecondConfirmation(landing.message)

  if (failed) {
    return (
      <div className="container narrow page">
        <h1>Link jest nieważny</h1>
        <p className="error" role="alert">
          Link potwierdzający wygasł albo został już użyty.
        </p>
        <p className="muted">
          Spróbuj się <Link to="/login">zalogować</Link> — jeśli adres nie jest potwierdzony, wyślemy link ponownie.
        </p>
      </div>
    )
  }

  if (second) {
    return (
      <div className="container narrow page">
        <h1>Został jeszcze jeden krok</h1>
        <p role="status">
          Potwierdziliśmy jeden adres. Kliknij jeszcze link, który wysłaliśmy na drugi adres (stary lub nowy), żeby
          dokończyć zmianę.
        </p>
      </div>
    )
  }

  return (
    <div className="container narrow page">
      <h1>{changed ? 'Nowy adres potwierdzony' : 'Adres potwierdzony'}</h1>
      <p role="status">
        {changed ? 'Twój adres e-mail został zmieniony.' : 'Dziękujemy! Konto jest aktywne.'}
        {!loading && !session && ' Zaloguj się, żeby licytować i wystawiać aukcje.'}
      </p>
      {!loading &&
        (session ? (
          <Link className="btn btn-primary" to={changed ? '/settings' : '/auctions'}>
            {changed ? 'Wróć do ustawień' : 'Przejdź do aukcji'}
          </Link>
        ) : (
          <Link className="btn btn-primary" to="/login">
            Zaloguj się
          </Link>
        ))}
    </div>
  )
}

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isPlausibleEmail(email)) {
      setError('Podaj prawidłowy adres e-mail')
      return
    }
    setBusy(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(knownAuthError(err) ?? 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="container narrow page">
        <h1>Sprawdź skrzynkę</h1>
        {/* Same text whether or not the account exists */}
        <p role="status">
          Jeśli konto z adresem <strong>{email.trim()}</strong> istnieje, wysłaliśmy na niego link do ustawienia nowego
          hasła. Link jest ważny przez ograniczony czas.
        </p>
        <p className="muted">Nie ma wiadomości? Zajrzyj do spamu albo spróbuj ponownie za minutę.</p>
        <p className="muted auth-notice">
          <Link to="/login">Wróć do logowania</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="container narrow page">
      <h1>Nie pamiętam hasła</h1>
      <p className="muted">Podaj adres e-mail konta — wyślemy link do ustawienia nowego hasła.</p>
      <form className="card-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label>
          <span className="label-text">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'forgot-error' : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" id="forgot-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Wysyłanie…' : 'Wyślij link'}
        </button>
      </form>
      <p className="muted">
        <Link to="/login">Wróć do logowania</Link>
      </p>
    </div>
  )
}

/** Landing of the reset link: Supabase signs the user in and fires PASSWORD_RECOVERY */
export function NewPasswordPage() {
  const { session, loading, recovery, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const ready = recovery || (landing.type === 'recovery' && !landing.errorCode && Boolean(session))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const problem = passwordProblem(password)
    if (problem) return setError(problem)
    if (password !== repeat) return setError('Hasła nie są takie same')
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(knownAuthError(err) ?? 'Nie udało się zmienić hasła. Spróbuj ponownie.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="container narrow page">
        <h1>Hasło zmienione</h1>
        <p role="status">Nowe hasło jest ustawione. Jesteś zalogowany.</p>
        <Link className="btn btn-primary" to="/auctions">
          Przejdź do aukcji
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container narrow page">
        <p className="muted" role="status">
          Sprawdzamy link…
        </p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="container narrow page">
        <h1>Link jest nieważny</h1>
        <p className="error" role="alert">
          Link do zmiany hasła wygasł, został już użyty albo jest niepełny.
        </p>
        <Link className="btn btn-primary" to="/auth/zapomniane-haslo">
          Wyślij nowy link
        </Link>
      </div>
    )
  }

  return (
    <div className="container narrow page">
      <h1>Ustaw nowe hasło</h1>
      <form className="card-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label>
          <span className="label-text">Nowe hasło</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            aria-describedby="new-password-hint"
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="field-hint" id="new-password-hint">
            Min. {PASSWORD_MIN_LENGTH} znaków, w tym litera i cyfra.
          </span>
        </label>
        <label>
          <span className="label-text">Powtórz hasło</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Zapisywanie…' : 'Zmień hasło'}
        </button>
      </form>
    </div>
  )
}
